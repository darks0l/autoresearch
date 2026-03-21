/**
 * strategy.js — THE MUTABLE FILE
 *
 * This is the single file the autoresearch agent modifies.
 * Each experiment = one atomic change to this file.
 *
 * Rules:
 * - Only edit this file
 * - Do not modify backtest.js, data.js, indicators.js, or benchmarks/
 * - No new dependencies — only what's available in indicators.js
 * - Each on_bar() call gets 500 bars of history per pair
 *
 * Available indicators (import from '../src/indicators.js'):
 *   sma, ema, rsi, macd, bollingerBands, atr, vwap, roc, stddev, percentileRank
 */

import { rsi, ema, bollingerBands, atr, vwap, roc } from '../src/indicators.js';

export class Strategy {
  constructor() {
    // === PARAMETERS (tune these) ===
    this.rsiPeriod = 14;
    this.rsiOverbought = 70;
    this.rsiOversold = 30;
    this.emaPeriodFast = 12;
    this.emaPeriodSlow = 26;
    this.positionSize = 0.1; // fraction of portfolio per trade
    this.cooldown = 5;       // bars between trades per pair
    this.atrTrailingStop = 3.5;

    // === STATE ===
    this.lastTradeBar = {}; // pair → last trade bar index
  }

  /**
   * Called once per bar across all pairs.
   *
   * @param {Object} barData - { 'ETH/USDC': { open, high, low, close, volume, history: [...] }, ... }
   * @param {{ cash: number, positions: Object<string, number> }} portfolio
   * @returns {{ pair: string, targetPosition: number, orderType?: string }[]}
   */
  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 50) continue;

      const closes = data.history.map(b => b.close);
      const highs = data.history.map(b => b.high);
      const lows = data.history.map(b => b.low);
      const volumes = data.history.map(b => b.volume);
      const barIndex = data.history.length - 1;

      // Calculate indicators
      const rsiValues = rsi(closes, this.rsiPeriod);
      const emaFast = ema(closes, this.emaPeriodFast);
      const emaSlow = ema(closes, this.emaPeriodSlow);

      const currentRsi = rsiValues[barIndex];
      const currentEmaFast = emaFast[barIndex];
      const currentEmaSlow = emaSlow[barIndex];

      if (isNaN(currentRsi) || isNaN(currentEmaFast) || isNaN(currentEmaSlow)) continue;

      // Cooldown check
      const lastTrade = this.lastTradeBar[pair] || -Infinity;
      if (barIndex - lastTrade < this.cooldown) continue;

      const currentPos = portfolio.positions[pair] || 0;
      const maxPosition = totalEquity * this.positionSize;

      // === ENTRY LOGIC ===
      // Long: RSI oversold + fast EMA > slow EMA (momentum confirmation)
      if (currentRsi < this.rsiOversold && currentEmaFast > currentEmaSlow && currentPos <= 0) {
        signals.push({ pair, targetPosition: maxPosition });
        this.lastTradeBar[pair] = barIndex;
      }
      // Short: RSI overbought + fast EMA < slow EMA
      else if (currentRsi > this.rsiOverbought && currentEmaFast < currentEmaSlow && currentPos >= 0) {
        signals.push({ pair, targetPosition: -maxPosition });
        this.lastTradeBar[pair] = barIndex;
      }
      // Close: RSI crosses back to neutral from extreme
      else if (currentPos > 0 && currentRsi > 50 && currentEmaFast < currentEmaSlow) {
        signals.push({ pair, targetPosition: 0 });
        this.lastTradeBar[pair] = barIndex;
      }
      else if (currentPos < 0 && currentRsi < 50 && currentEmaFast > currentEmaSlow) {
        signals.push({ pair, targetPosition: 0 });
        this.lastTradeBar[pair] = barIndex;
      }
    }

    return signals;
  }
}

export default { Strategy };
