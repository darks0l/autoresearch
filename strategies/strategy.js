/**
 * strategy-pure-trend-breakout.js — Simplified Trend-Following Breakout
 * 
 * STRUCTURAL CHANGE: Eliminate mean-reversion components entirely.
 * Focus on high-conviction breakouts in established uptrends only.
 * 
 * Entry Logic:
 * 1. Price breaks above dynamic Donchian upper band (adaptive lookback)
 * 2. Price is above 50-period EMA (macro trend confirmation)
 * 3. ATR is in top 60th percentile (strong volatility breakout)
 * 4. Optional momentum filter: 10-period ROC > 0
 * 
 * Exit Logic:
 * 1. Trailing stop at 1.5x ATR below peak
 * 2. Adaptive profit target: 2.0x-4.0x ATR based on trend strength
 * 3. Price falls below 50-period EMA (trend reversal)
 * 
 * Position Sizing:
 * - Base size scaled by inverse volatility
 * - Single conviction level (no voting)
 * - Maximum 3 concurrent positions
 */
import { rsi, atr, ema, sma, macd, roc, percentileRank } from '../src/indicators.js';

export class Strategy {
  constructor() {
    // Trend filter
    this.trendEmaPeriod = 50;
    
    // Breakout detection (adaptive)
    this.breakoutLookbackLow = 15;
    this.breakoutLookbackHigh = 25;
    this.volRegimeThreshold = 70;
    
    // Volatility expansion filter
    this.atrPeriod = 10;
    this.atrPercentileLookback = 50;
    this.atrPercentileThreshold = 60;
    
    // Momentum filter
    this.rocPeriod = 10;
    
    // Risk management
    this.atrTrailMultiple = 1.5;
    this.atrProfitMultipleMin = 2.0;
    this.atrProfitMultipleMax = 4.0;
    this.trendStrengthThreshold = 0.10;  // 10% above trend EMA for max profit target
    
    // Position sizing
    this.basePositionSize = 0.15;
    this.maxPositions = 3;
    this.cooldown = 3;
    
    // State
    this.lastTradeBar = {};
    this.stops = {};
    this.peaks = {};
    this.entries = {};
  }

  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);
    const openPositions = Object.values(portfolio.positions).filter(p => p !== 0).length;

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 60) continue;

      const closes = data.history.map(b => b.close);
      const highs = data.history.map(b => b.high);
      const lows = data.history.map(b => b.low);
      const idx = closes.length - 1;
      const price = closes[idx];

      // Compute indicators
      const trendEma = ema(closes, this.trendEmaPeriod);
      const atrValues = atr(highs, lows, closes, this.atrPeriod);
      const atrPercentile = percentileRank(atrValues, this.atrPercentileLookback);
      const rocValues = roc(closes, this.rocPeriod);

      const a = atrValues[idx];
      const trendEmaVal = trendEma[idx];
      const atrPctRank = atrPercentile[idx];
      const rocVal = rocValues[idx];

      if (isNaN(a) || isNaN(trendEmaVal) || isNaN(atrPctRank)) continue;

      const currentPos = portfolio.positions[pair] || 0;
      const last = this.lastTradeBar[pair] || -Infinity;

      // === MANAGE EXISTING POSITION ===
      if (currentPos > 0) {
        // Update trailing stop
        if (!this.peaks[pair] || price > this.peaks[pair]) {
          this.peaks[pair] = price;
          this.stops[pair] = price - this.atrTrailMultiple * a;
        }

        const entryPrice = this.entries[pair] || price;
        let exit = false;
        
        // Hard trailing stop
        if (this.stops[pair] && price <= this.stops[pair]) exit = true;
        
        // Adaptive profit target based on trend strength
        const trendStrength = (price - trendEmaVal) / trendEmaVal;
        let profitMultiple = this.atrProfitMultipleMin;
        
        if (trendStrength >= this.trendStrengthThreshold) {
          // Strong trend: use maximum profit target
          profitMultiple = this.atrProfitMultipleMax;
        } else if (trendStrength > 0) {
          // Moderate trend: interpolate between min and max
          const ratio = trendStrength / this.trendStrengthThreshold;
          profitMultiple = this.atrProfitMultipleMin + 
            (this.atrProfitMultipleMax - this.atrProfitMultipleMin) * ratio;
        }
        
        if (price >= entryPrice + profitMultiple * a) exit = true;
        
        // Trend reversal - price below trend EMA
        if (price < trendEmaVal) exit = true;

        if (exit) {
          signals.push({ pair, targetPosition: 0 });
          this.lastTradeBar[pair] = idx;
          delete this.stops[pair];
          delete this.peaks[pair];
          delete this.entries[pair];
        }
        continue;
      }

      // === ENTRY LOGIC ===
      if (idx - last < this.cooldown) continue;
      if (openPositions >= this.maxPositions) continue;

      // 1. Trend filter: price must be above trend EMA
      if (price < trendEmaVal) continue;

      // 2. Adaptive breakout filter based on volatility regime
      const breakoutLookback = atrPctRank >= this.volRegimeThreshold 
        ? this.breakoutLookbackLow   // High vol: shorter lookback (more sensitive)
        : this.breakoutLookbackHigh;  // Low vol: longer lookback (more conservative)
      
      if (idx < breakoutLookback) continue;
      const channelHigh = Math.max(...highs.slice(idx - breakoutLookback, idx));
      if (price < channelHigh * 0.998) continue;

      // 3. Volatility expansion: ATR must be in top percentile
      if (atrPctRank < this.atrPercentileThreshold) continue;

      // 4. Momentum filter: positive rate of change
      if (isNaN(rocVal) || rocVal <= 0) continue;

      // Position sizing with volatility scaling
      const atrPct = a / price;
      const volScale = Math.min(2.0, Math.max(0.5, 0.015 / atrPct));
      const maxPos = totalEquity * this.basePositionSize * volScale;

      signals.push({ pair, targetPosition: maxPos });
      this.lastTradeBar[pair] = idx;
      this.peaks[pair] = price;
      this.stops[pair] = price - this.atrTrailMultiple * a;
      this.entries[pair] = price;
    }
    return signals;
  }
}

export default { Strategy };