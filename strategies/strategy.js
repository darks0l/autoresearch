/**
 * strategy-adaptive.js — Adaptive strategy for real Base DEX data
 * 
 * Design philosophy: Don't fight the trend.
 * - Long-only bias in crypto uptrends
 * - Momentum breakout entries (Donchian channel)
 * - ATR trailing stops
 * - Regime-based position sizing (Hurst exponent)
 * - Skip shorting unless clear mean-reversion pair
 */
import { rsi, atr, ema, sma, bollingerBands } from '../src/indicators.js';

export class Strategy {
  constructor() {
    this.lookback = 20;        // Donchian channel lookback
    this.emaFast = 10;
    this.emaSlow = 30;
    this.rsiPeriod = 14;
    this.atrPeriod = 14;
    this.atrTrailMultiple = 1.5;
    this.basePositionSize = 0.10;
    this.cooldown = 6;
    this.maxPositions = 3;
    this.hurstLookback = 30;   // Lookback for Hurst calculation
    this.lastTradeBar = {};
    this.stops = {};
    this.peaks = {};
  }

  // Calculate Hurst exponent using R/S analysis
  calculateHurst(prices) {
    if (prices.length < this.hurstLookback) return 0.5; // Neutral default
    
    const data = prices.slice(-this.hurstLookback);
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    
    // Mean-centered cumulative deviation
    let cumDev = 0;
    const cumDevs = [];
    for (let i = 0; i < n; i++) {
      cumDev += data[i] - mean;
      cumDevs.push(cumDev);
    }
    
    // Range
    const range = Math.max(...cumDevs) - Math.min(...cumDevs);
    
    // Standard deviation
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0 || range === 0) return 0.5;
    
    // R/S ratio
    const rs = range / stdDev;
    
    // Hurst = log(R/S) / log(n/2)
    const hurst = Math.log(rs) / Math.log(n / 2);
    
    // Clamp to reasonable range
    return Math.max(0.3, Math.min(0.8, hurst));
  }

  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);
    const openPositions = Object.values(portfolio.positions).filter(p => p !== 0).length;

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 55) continue;

      const closes = data.history.map(b => b.close);
      const highs = data.history.map(b => b.high);
      const lows = data.history.map(b => b.low);
      const idx = closes.length - 1;
      const price = closes[idx];

      // Indicators
      const emaFastVals = ema(closes, this.emaFast);
      const emaSlowVals = ema(closes, this.emaSlow);
      const rsiValues = rsi(closes, this.rsiPeriod);
      const atrValues = atr(highs, lows, closes, this.atrPeriod);

      const f = emaFastVals[idx];
      const s = emaSlowVals[idx];
      const r = rsiValues[idx];
      const a = atrValues[idx];

      if (isNaN(f) || isNaN(s) || isNaN(r) || isNaN(a)) continue;

      const last = this.lastTradeBar[pair] || -Infinity;
      if (idx - last < this.cooldown) continue;

      const currentPos = portfolio.positions[pair] || 0;
      const uptrend = f > s;

      // Donchian channel
      const channelHighs = highs.slice(Math.max(0, idx - this.lookback), idx);
      const channelLows = lows.slice(Math.max(0, idx - this.lookback), idx);
      const channelHigh = Math.max(...channelHighs);
      const channelLow = Math.min(...channelLows);

      // Calculate Hurst exponent for regime detection
      const hurst = this.calculateHurst(closes);
      
      // Regime-based position sizing multiplier
      // Hurst > 0.5: trending (increase size)
      // Hurst < 0.5: mean-reverting (decrease size)
      // Scale from 0.5x to 1.5x based on Hurst
      const regimeMultiplier = 0.5 + 2.0 * (hurst - 0.3) / 0.5; // Maps 0.3-0.8 to 0.5-1.5
      
      // ATR sizing
      const atrPct = a / price;
      const volScale = Math.min(1.8, Math.max(0.4, 0.015 / atrPct));
      const maxPos = totalEquity * this.basePositionSize * volScale * regimeMultiplier;

      // Manage existing position
      if (currentPos > 0) {
        // Update peak
        if (!this.peaks[pair] || price > this.peaks[pair]) {
          this.peaks[pair] = price;
          this.stops[pair] = price - this.atrTrailMultiple * a;
        }

        // Stop hit or trend reversal
        if (price <= (this.stops[pair] || 0) || (!uptrend && r > 65)) {
          signals.push({ pair, targetPosition: 0 });
          this.lastTradeBar[pair] = idx;
          delete this.stops[pair];
          delete this.peaks[pair];
          continue;
        }
        continue; // Hold position
      }

      // New entries: long only in uptrend
      if (uptrend && currentPos <= 0 && openPositions < this.maxPositions) {
        // Breakout entry: price breaks above Donchian high
        const breakout = price >= channelHigh * 0.998;
        // Dip entry: RSI pulls back in uptrend
        const dipBuy = r < 40 && price > s;

        if (breakout || dipBuy) {
          signals.push({ pair, targetPosition: maxPos });
          this.lastTradeBar[pair] = idx;
          this.peaks[pair] = price;
          this.stops[pair] = price - this.atrTrailMultiple * a;
        }
      }
    }
    return signals;
  }
}

export default { Strategy };