/**
 * Backtest Engine
 * Replays historical data through a strategy and computes performance metrics.
 */

import CONFIG from './config.js';
import { loadAllPairs, buildBarData } from './data.js';

/**
 * @typedef {Object} Signal
 * @property {string} pair - Pair name
 * @property {number} targetPosition - Signed USD notional (+long, -short, 0=close)
 * @property {string} [orderType] - 'market' (default)
 */

/**
 * @typedef {Object} PortfolioState
 * @property {number} cash - Available cash
 * @property {Object<string, number>} positions - pair → signed USD notional
 */

/**
 * @typedef {Object} BacktestResult
 * @property {number} score - Composite score
 * @property {number} sharpe - Annualized Sharpe ratio
 * @property {number} totalReturnPct - Total return percentage
 * @property {number} maxDrawdownPct - Maximum drawdown percentage
 * @property {number} numTrades - Number of trades executed
 * @property {number} winRate - Win rate (0-1)
 * @property {number} annualTurnover - Annual turnover ratio
 * @property {number[]} equityCurve - Daily equity values
 * @property {Object[]} trades - Trade log
 */

/**
 * Get fee config for a pair
 */
function getFees(pairName) {
  const cfg = CONFIG.backtest.fees;
  if (pairName.includes('AERO')) return cfg.aerodrome;
  if (pairName.includes('-30')) return cfg.uniswap_3000;
  return cfg.uniswap_500;
}

/**
 * Run a backtest
 * @param {Object} strategy - Strategy instance with onBar(barData, portfolio) method
 * @param {Map<string, Object[]>} allPairs - Historical data
 * @returns {BacktestResult}
 */
export function runBacktest(strategy, allPairs) {
  const { initialCapital, scoring } = CONFIG.backtest;

  // Portfolio state
  let cash = initialCapital;
  const positions = {}; // pair → { size: USD notional, entryPrice: number }
  const trades = [];
  const dailyReturns = [];
  const equityCurve = [initialCapital];

  // Find the shortest dataset length (all pairs must align)
  const maxBars = Math.min(...[...allPairs.values()].map(bars => bars.length));

  if (maxBars < 50) {
    return {
      score: -999,
      sharpe: 0,
      totalReturnPct: 0,
      maxDrawdownPct: 100,
      numTrades: 0,
      winRate: 0,
      annualTurnover: 0,
      equityCurve: [initialCapital],
      trades: [],
      error: 'Insufficient data',
    };
  }

  let prevEquity = initialCapital;
  let dayStart = null;
  let dayEquity = initialCapital;
  let totalTurnover = 0;

  // Run through each bar
  for (let i = 0; i < maxBars; i++) {
    const barData = buildBarData(allPairs, i);

    // Calculate current equity
    let equity = cash;
    for (const [pair, pos] of Object.entries(positions)) {
      if (barData[pair]) {
        const currentPrice = barData[pair].close;
        const entryPrice = pos.entryPrice;
        const pnl = pos.size > 0
          ? pos.size * (currentPrice / entryPrice - 1)
          : -pos.size * (1 - currentPrice / entryPrice);
        equity += Math.abs(pos.size) + pnl;
      }
    }

    // Track daily returns
    const firstBar = [...allPairs.values()][0][i];
    const currentDay = Math.floor(firstBar.timestamp / 86400);
    if (dayStart === null) dayStart = currentDay;

    if (currentDay !== dayStart) {
      const dailyReturn = (equity - dayEquity) / dayEquity;
      dailyReturns.push(dailyReturn);
      dayStart = currentDay;
      dayEquity = equity;
    }

    equityCurve.push(equity);

    // Build portfolio state
    const portfolioState = {
      cash,
      positions: Object.fromEntries(
        Object.entries(positions).map(([pair, pos]) => [pair, pos.size])
      ),
    };

    // Get signals from strategy
    let signals = [];
    try {
      signals = strategy.onBar(barData, portfolioState) || [];
    } catch (e) {
      // Strategy error — skip this bar
      continue;
    }

    // Execute signals
    for (const signal of signals) {
      const { pair, targetPosition } = signal;
      if (!barData[pair]) continue;

      const currentPos = positions[pair]?.size || 0;
      const delta = targetPosition - currentPos;

      if (Math.abs(delta) < 10) continue; // Skip tiny changes

      const fees = getFees(pair);
      const feeBps = delta > 0 ? fees.taker : fees.maker;
      const slippageBps = fees.slippage;
      const totalCostBps = feeBps + slippageBps;
      const cost = Math.abs(delta) * totalCostBps / 10000;

      // Track turnover
      totalTurnover += Math.abs(delta);

      // Close existing position if direction changes
      if (currentPos !== 0 && Math.sign(targetPosition) !== Math.sign(currentPos)) {
        const pos = positions[pair];
        const currentPrice = barData[pair].close;
        const pnl = pos.size > 0
          ? pos.size * (currentPrice / pos.entryPrice - 1)
          : -pos.size * (1 - currentPrice / pos.entryPrice);
        cash += Math.abs(pos.size) + pnl - cost;

        trades.push({
          bar: i,
          pair,
          side: pos.size > 0 ? 'close_long' : 'close_short',
          size: Math.abs(pos.size),
          price: currentPrice,
          pnl,
          fee: cost,
        });

        delete positions[pair];
      }

      // Open/adjust position
      if (targetPosition !== 0) {
        const price = barData[pair].close;
        const newSize = targetPosition;
        const capitalNeeded = Math.abs(newSize) + cost;

        if (capitalNeeded > cash) continue; // Insufficient funds

        cash -= capitalNeeded;
        positions[pair] = {
          size: newSize,
          entryPrice: price,
        };

        trades.push({
          bar: i,
          pair,
          side: newSize > 0 ? 'long' : 'short',
          size: Math.abs(newSize),
          price,
          fee: cost,
        });
      }
    }

    prevEquity = equity;
  }

  // Final equity
  let finalEquity = cash;
  const lastBarData = buildBarData(allPairs, maxBars - 1);
  for (const [pair, pos] of Object.entries(positions)) {
    if (lastBarData[pair]) {
      const currentPrice = lastBarData[pair].close;
      const pnl = pos.size > 0
        ? pos.size * (currentPrice / pos.entryPrice - 1)
        : -pos.size * (1 - currentPrice / pos.entryPrice);
      finalEquity += Math.abs(pos.size) + pnl;
    }
  }

  // Calculate metrics
  const totalReturnPct = ((finalEquity - initialCapital) / initialCapital) * 100;

  // Max drawdown
  let peak = initialCapital;
  let maxDrawdownPct = 0;
  for (const eq of equityCurve) {
    if (eq > peak) peak = eq;
    const dd = ((peak - eq) / peak) * 100;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  // Sharpe ratio (annualized)
  let sharpe = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / dailyReturns.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(365) : 0;
  }

  // Win rate
  const closeTrades = trades.filter(t => t.side.startsWith('close_'));
  const wins = closeTrades.filter(t => t.pnl > 0).length;
  const winRate = closeTrades.length > 0 ? wins / closeTrades.length : 0;

  // Annual turnover ratio
  const daysInData = dailyReturns.length || 1;
  const annualTurnover = (totalTurnover / initialCapital) * (365 / daysInData);

  // Compute score
  let score;
  const numTrades = trades.length;

  // Hard cutoffs
  if (numTrades < scoring.minTrades || maxDrawdownPct > scoring.maxDrawdown || totalReturnPct < -scoring.maxLoss) {
    score = -999;
  } else {
    const tradeFactor = Math.sqrt(Math.min(numTrades / scoring.tradeFloor, 1.0));
    const drawdownPenalty = Math.max(0, maxDrawdownPct - scoring.drawdownThreshold) * scoring.drawdownPenalty;
    const turnoverPenalty = Math.max(0, annualTurnover - scoring.turnoverCap) * scoring.turnoverPenalty;
    score = sharpe * tradeFactor - drawdownPenalty - turnoverPenalty;
  }

  return {
    score: Math.round(score * 1000) / 1000,
    sharpe: Math.round(sharpe * 1000) / 1000,
    totalReturnPct: Math.round(totalReturnPct * 1000) / 1000,
    maxDrawdownPct: Math.round(maxDrawdownPct * 1000) / 1000,
    numTrades,
    winRate: Math.round(winRate * 1000) / 1000,
    annualTurnover: Math.round(annualTurnover * 1000) / 1000,
    equityCurve,
    trades,
  };
}

/**
 * Score summary as formatted string
 */
export function formatResult(result) {
  return [
    `score: ${result.score}`,
    `sharpe: ${result.sharpe}`,
    `total_return_pct: ${result.totalReturnPct}`,
    `max_drawdown_pct: ${result.maxDrawdownPct}`,
    `num_trades: ${result.numTrades}`,
    `win_rate: ${(result.winRate * 100).toFixed(1)}%`,
    `annual_turnover: ${result.annualTurnover}`,
  ].join('\n');
}

/**
 * Run backtest from strategy file path
 */
export async function backtestFromFile(strategyPath, dataOverride) {
  const { default: StrategyModule } = await import(`file://${strategyPath}`);
  const StrategyClass = StrategyModule.Strategy || StrategyModule.default || StrategyModule;
  const strategy = new StrategyClass();

  const allPairs = dataOverride || await loadAllPairs('1h');
  return runBacktest(strategy, allPairs);
}

export default { runBacktest, formatResult, backtestFromFile };
