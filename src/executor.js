/**
 * Production Execution Engine
 * Bridges autoresearch strategies to live Bankr wallet execution on Base DEX.
 * 
 * Flow: Strategy signals → position sizing → risk checks → Bankr LLM swap → confirmation
 * 
 * Uses Bankr as the swap/execution layer:
 * - Natural language prompts to Bankr LLM for trade execution
 * - Portfolio tracking via Bankr wallet
 * - Risk management (max position, daily loss limit, per-trade limit)
 */

import CONFIG from './config.js';
import { callLLM, getBalance } from './bankr.js';

/**
 * @typedef {Object} ExecutionConfig
 * @property {boolean} liveMode - Paper or live trading
 * @property {number} maxPositionPct - Max % of portfolio per position (default 15%)
 * @property {number} dailyLossLimit - Max daily drawdown % before stopping (default 5%)
 * @property {number} perTradeLimitUsd - Max USD per single trade (default 500)
 * @property {number} minTradeUsd - Minimum trade size (default 10)
 * @property {string[]} allowedPairs - Whitelisted trading pairs
 * @property {number} confirmationTimeoutMs - Wait for on-chain confirmation
 */

const DEFAULT_EXEC_CONFIG = {
  liveMode: false,
  maxPositionPct: 0.15,
  dailyLossLimit: 5.0,
  perTradeLimitUsd: 500,
  minTradeUsd: 10,
  allowedPairs: ['ETH/USDC', 'AERO/USDC', 'cbETH/WETH'],
  confirmationTimeoutMs: 30_000,
  slippageBps: 50,  // 0.5% max slippage
};

/**
 * Token address mapping for Base
 */
const BASE_TOKENS = {
  ETH: '0x4200000000000000000000000000000000000006',   // WETH on Base
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  AERO: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
};

/**
 * Execution state tracker
 */
class ExecutionState {
  constructor() {
    this.dailyPnL = 0;
    this.tradeCount = 0;
    this.positions = new Map();  // pair → { size, entryPrice, side, entryTime }
    this.tradeLog = [];
    this.startOfDay = this._today();
    this.halted = false;
    this.haltReason = '';
  }

  _today() {
    return new Date().toISOString().slice(0, 10);
  }

  resetDaily() {
    const today = this._today();
    if (today !== this.startOfDay) {
      this.dailyPnL = 0;
      this.tradeCount = 0;
      this.startOfDay = today;
      this.halted = false;
      this.haltReason = '';
    }
  }

  logTrade(trade) {
    this.tradeLog.push({ ...trade, timestamp: Date.now() });
    this.tradeCount++;
  }
}

const state = new ExecutionState();

/**
 * Execute strategy signals via Bankr
 * @param {Object[]} signals - Strategy signals from onBar()
 * @param {Object} marketData - Current market prices
 * @param {Object} execConfig - Execution configuration
 * @returns {Object[]} Execution results
 */
export async function executeSignals(signals, marketData = {}, execConfig = {}) {
  const config = { ...DEFAULT_EXEC_CONFIG, ...execConfig };
  state.resetDaily();

  if (state.halted) {
    console.log(`  [HALTED] ${state.haltReason}`);
    return [];
  }

  const results = [];

  for (const signal of signals) {
    try {
      const result = await executeSingleSignal(signal, marketData, config);
      results.push(result);
    } catch (e) {
      console.error(`  [EXEC ERROR] ${signal.pair}: ${e.message}`);
      results.push({
        pair: signal.pair,
        success: false,
        error: e.message,
        mode: config.liveMode ? 'live' : 'paper',
      });
    }
  }

  return results;
}

/**
 * Execute a single signal with risk checks
 */
async function executeSingleSignal(signal, marketData, config) {
  const { pair, targetPosition } = signal;

  // Validate pair
  if (!config.allowedPairs.includes(pair)) {
    return { pair, success: false, error: `Pair ${pair} not in allowlist`, mode: 'rejected' };
  }

  const currentPos = state.positions.get(pair);
  const currentSize = currentPos?.size || 0;
  const positionDelta = targetPosition - currentSize;

  // Skip tiny trades
  if (Math.abs(positionDelta) < config.minTradeUsd) {
    return { pair, success: true, action: 'skip', reason: 'Below minimum trade size', mode: 'skip' };
  }

  // Per-trade limit
  if (Math.abs(positionDelta) > config.perTradeLimitUsd) {
    const clampedDelta = Math.sign(positionDelta) * config.perTradeLimitUsd;
    console.log(`  [RISK] Clamped ${pair} trade from $${positionDelta.toFixed(0)} to $${clampedDelta.toFixed(0)}`);
    signal.targetPosition = currentSize + clampedDelta;
  }

  // Daily loss limit check
  if (state.dailyPnL < -config.dailyLossLimit) {
    state.halted = true;
    state.haltReason = `Daily loss limit hit: ${state.dailyPnL.toFixed(2)}%`;
    return { pair, success: false, error: state.haltReason, mode: 'halted' };
  }

  // Get current balance for position size validation
  const balance = await getBalance();
  if (balance.available && config.liveMode) {
    const totalValue = (balance.eth * (marketData['ETH/USDC']?.close || 2000)) + balance.usdc;
    const maxPosition = totalValue * config.maxPositionPct;
    if (Math.abs(signal.targetPosition) > maxPosition) {
      console.log(`  [RISK] Position capped at $${maxPosition.toFixed(0)} (${(config.maxPositionPct * 100)}% of $${totalValue.toFixed(0)})`);
      signal.targetPosition = Math.sign(signal.targetPosition) * maxPosition;
    }
  }

  // Execute
  if (!config.liveMode) {
    return executePaperTrade(signal, currentPos, marketData);
  } else {
    return executeLiveTrade(signal, currentPos, marketData, config);
  }
}

/**
 * Paper trade execution (simulation)
 */
function executePaperTrade(signal, currentPos, marketData) {
  const { pair, targetPosition } = signal;
  const currentSize = currentPos?.size || 0;
  const delta = targetPosition - currentSize;
  const action = targetPosition === 0 ? 'close' : delta > 0 ? 'buy' : 'sell';

  const price = marketData[pair]?.close || 0;

  // Track P&L on close
  if (action === 'close' && currentPos) {
    const pnl = currentPos.side === 'long'
      ? (price - currentPos.entryPrice) / currentPos.entryPrice * 100
      : (currentPos.entryPrice - price) / currentPos.entryPrice * 100;
    state.dailyPnL += pnl * (Math.abs(currentPos.size) / 100000); // Scaled to portfolio
  }

  // Update position state
  if (targetPosition === 0) {
    state.positions.delete(pair);
  } else {
    state.positions.set(pair, {
      size: targetPosition,
      entryPrice: price,
      side: targetPosition > 0 ? 'long' : 'short',
      entryTime: Date.now(),
    });
  }

  const trade = {
    pair,
    action,
    size: Math.abs(delta),
    targetPosition,
    price,
    success: true,
    mode: 'paper',
  };
  state.logTrade(trade);

  console.log(`  [paper] ${action.toUpperCase()} ${pair}: $${Math.abs(delta).toFixed(0)} @ $${price.toFixed(2)}`);
  return trade;
}

/**
 * Live trade execution via Bankr LLM
 * Sends natural language swap command to Bankr
 */
async function executeLiveTrade(signal, currentPos, marketData, config) {
  const { pair, targetPosition } = signal;
  const currentSize = currentPos?.size || 0;
  const delta = targetPosition - currentSize;
  const action = targetPosition === 0 ? 'close' : delta > 0 ? 'buy' : 'sell';

  // Parse pair into tokens
  const [baseToken, quoteToken] = pair.replace('-30', '').split('/');

  // Build Bankr swap prompt
  let swapPrompt;
  const absAmount = Math.abs(delta);

  if (action === 'close') {
    // Close position: sell the base token back
    const posSize = Math.abs(currentSize);
    if (currentPos?.side === 'long') {
      swapPrompt = `Swap ${(posSize / (marketData[pair]?.close || 2000)).toFixed(6)} ${baseToken} to ${quoteToken} on Base with max ${config.slippageBps / 100}% slippage`;
    } else {
      swapPrompt = `Swap ${posSize.toFixed(2)} ${quoteToken} to ${baseToken} on Base with max ${config.slippageBps / 100}% slippage`;
    }
  } else if (action === 'buy') {
    swapPrompt = `Swap ${absAmount.toFixed(2)} ${quoteToken} to ${baseToken} on Base with max ${config.slippageBps / 100}% slippage`;
  } else {
    swapPrompt = `Swap ${(absAmount / (marketData[pair]?.close || 2000)).toFixed(6)} ${baseToken} to ${quoteToken} on Base with max ${config.slippageBps / 100}% slippage`;
  }

  console.log(`  [LIVE] Executing: ${swapPrompt}`);

  try {
    // Send swap command to Bankr LLM
    const response = await callLLM(swapPrompt, {
      model: 'claude-haiku-4.5',
      maxTokens: 1000,
    });

    // Parse response for tx hash or confirmation
    const txMatch = response.match(/0x[a-fA-F0-9]{64}/);
    const txHash = txMatch?.[0] || null;
    const success = response.toLowerCase().includes('success') ||
                    response.toLowerCase().includes('swapped') ||
                    response.toLowerCase().includes('completed') ||
                    !!txHash;

    // Update position state
    if (success) {
      if (targetPosition === 0) {
        state.positions.delete(pair);
      } else {
        state.positions.set(pair, {
          size: targetPosition,
          entryPrice: marketData[pair]?.close || 0,
          side: targetPosition > 0 ? 'long' : 'short',
          entryTime: Date.now(),
        });
      }
    }

    const trade = {
      pair,
      action,
      size: absAmount,
      targetPosition,
      price: marketData[pair]?.close || 0,
      success,
      mode: 'live',
      txHash,
      bankrResponse: response.slice(0, 200),
    };
    state.logTrade(trade);

    console.log(`  [LIVE] ${success ? '✓' : '✗'} ${action.toUpperCase()} ${pair}: $${absAmount.toFixed(0)}${txHash ? ` tx: ${txHash.slice(0, 10)}...` : ''}`);
    return trade;
  } catch (e) {
    console.error(`  [LIVE ERROR] ${e.message}`);
    return {
      pair,
      action,
      size: absAmount,
      success: false,
      mode: 'live',
      error: e.message,
    };
  }
}

/**
 * Get current execution state summary
 */
export function getExecutionState() {
  const positions = {};
  for (const [pair, pos] of state.positions) {
    positions[pair] = { ...pos };
  }

  return {
    halted: state.halted,
    haltReason: state.haltReason,
    dailyPnL: state.dailyPnL,
    tradeCount: state.tradeCount,
    positions,
    recentTrades: state.tradeLog.slice(-10),
  };
}

/**
 * Reset execution state (for testing or new session)
 */
export function resetExecutionState() {
  state.dailyPnL = 0;
  state.tradeCount = 0;
  state.positions.clear();
  state.tradeLog = [];
  state.halted = false;
  state.haltReason = '';
}

/**
 * Run live trading loop
 * Connects strategy → market data → execution in a continuous loop
 * @param {Object} strategy - Strategy instance with onBar()
 * @param {Function} dataFetcher - Function that returns current market data
 * @param {Object} execConfig - Execution config overrides
 * @param {Object} options - Loop options
 */
export async function runLiveLoop(strategy, dataFetcher, execConfig = {}, options = {}) {
  const {
    intervalMs = 3600_000,  // 1 hour default (matches hourly bars)
    maxIterations = Infinity,
    onTrade,
    onCycle,
  } = options;

  const config = { ...DEFAULT_EXEC_CONFIG, ...execConfig };

  console.log('═══════════════════════════════════════════');
  console.log('  AUTORESEARCH — Live Execution Engine');
  console.log(`  Mode: ${config.liveMode ? '🔴 LIVE' : '📄 PAPER'}`);
  console.log(`  Interval: ${intervalMs / 1000}s`);
  console.log(`  Max position: ${config.maxPositionPct * 100}%`);
  console.log(`  Daily loss limit: ${config.dailyLossLimit}%`);
  console.log(`  Per-trade limit: $${config.perTradeLimitUsd}`);
  console.log('═══════════════════════════════════════════\n');

  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    const cycleStart = Date.now();

    try {
      // Fetch current market data
      const marketData = await dataFetcher();

      // Build portfolio state from execution state
      const portfolio = {
        cash: 100_000, // Will be replaced by real Bankr balance in live mode
        positions: {},
      };

      if (config.liveMode) {
        const balance = await getBalance();
        if (balance.available) {
          portfolio.cash = balance.usdc + (balance.eth * (marketData['ETH/USDC']?.close || 2000));
        }
      }

      // Copy current positions
      for (const [pair, pos] of state.positions) {
        portfolio.positions[pair] = pos.size;
      }

      // Get strategy signals
      const signals = strategy.onBar(marketData, portfolio);

      // Execute signals
      if (signals.length > 0) {
        const results = await executeSignals(signals, marketData, config);
        if (onTrade) {
          for (const result of results) {
            await onTrade(result);
          }
        }
      }

      if (onCycle) {
        await onCycle({
          iteration,
          signalCount: signals.length,
          state: getExecutionState(),
          elapsed: Date.now() - cycleStart,
        });
      }

    } catch (e) {
      console.error(`  [CYCLE ${iteration}] Error: ${e.message}`);
    }

    // Wait for next interval
    if (iteration < maxIterations) {
      const elapsed = Date.now() - cycleStart;
      const waitMs = Math.max(1000, intervalMs - elapsed);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  LIVE LOOP COMPLETE');
  console.log(`  Iterations: ${iteration}`);
  console.log(`  Trades: ${state.tradeCount}`);
  console.log(`  Daily P&L: ${state.dailyPnL.toFixed(2)}%`);
  console.log('═══════════════════════════════════════════');

  return getExecutionState();
}

export default { executeSignals, getExecutionState, resetExecutionState, runLiveLoop };
