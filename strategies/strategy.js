/**
 * strategy-ensemble.js — Ensemble Voting + Dual-Timeframe Strategy
 * 
 * STRUCTURAL CHANGES from single-indicator approach:
 * 1. Dual-timeframe: Long EMA (100) as macro trend, short indicators for entry
 * 2. Ensemble voting: 3 independent sub-strategies vote on entries/exits
 * 3. Conviction-weighted sizing: more votes = larger position
 * 4. Multi-signal exit: any exit sub-signal triggers close (fail-fast)
 * 
 * Sub-strategies:
 *   A) Donchian Breakout — price exceeds N-bar high in macro uptrend
 *   B) RSI Dip-Buy — oversold pullback while trend intact
 *   C) MACD Momentum — histogram expanding with bullish cross
 * 
 * Each votes independently. 1 vote = small entry, 2 = normal, 3 = max conviction.
 * Macro trend (100-EMA slope) must be non-negative for any entry.
 */
import { rsi, atr, ema, sma, macd, roc } from '../src/indicators.js';

export class Strategy {
  constructor() {
    // Macro trend filter (replaces true multi-timeframe with longer EMA)
    this.macroEmaPeriod = 100;     // ~4 days of 1h data
    this.macroSlopeWindow = 10;    // 10-bar slope of macro EMA
    
    // Sub-strategy A: Donchian Breakout
    this.donchianLookback = 20;
    
    // Sub-strategy B: RSI Dip-Buy
    this.rsiPeriod = 10;           // Faster RSI (from exp070 finding)
    this.rsiOversold = 40;
    this.rsiOverbought = 75;
    
    // Sub-strategy C: MACD Momentum
    this.macdFast = 8;             // Slightly faster than standard
    this.macdSlow = 21;
    this.macdSignal = 9;
    
    // Risk management
    this.atrPeriod = 5;            // Fast ATR (from exp074 finding)
    this.atrTrailMultiple = 1.5;   // Tight trail (from exp128 finding)
    this.atrProfitMultiple = 2.5;
    this.basePositionSize = 0.12;
    this.maxPositions = 3;
    this.cooldown = 4;
    
    // Conviction sizing multipliers
    this.convictionScale = { 1: 0.6, 2: 1.0, 3: 1.4 };
    
    // State
    this.lastTradeBar = {};
    this.stops = {};
    this.peaks = {};
    this.entries = {};
    this.entryVotes = {};          // Track what voted for entry
  }

  /**
   * Macro trend direction from long EMA slope
   * Returns: true if uptrend (safe to enter), false if not
   */
  isMacroUptrend(emaLongVals, idx) {
    if (idx < this.macroSlopeWindow || isNaN(emaLongVals[idx])) return false;
    const prev = emaLongVals[idx - this.macroSlopeWindow];
    if (isNaN(prev) || prev === 0) return false;
    const slope = (emaLongVals[idx] - prev) / prev;
    return slope > -0.001; // Allow flat or rising (not strongly falling)
  }

  /**
   * Sub-strategy A: Donchian Channel Breakout
   */
  voteDonchian(highs, closes, idx) {
    if (idx < this.donchianLookback) return 0;
    const channelHigh = Math.max(...highs.slice(idx - this.donchianLookback, idx));
    return closes[idx] >= channelHigh * 0.998 ? 1 : 0;
  }

  /**
   * Sub-strategy B: RSI Dip-Buy in uptrend
   */
  voteRSI(rsiValues, emaFast, emaSlow, idx) {
    const r = rsiValues[idx];
    if (isNaN(r) || isNaN(emaFast[idx]) || isNaN(emaSlow[idx])) return 0;
    return (r < this.rsiOversold && emaFast[idx] > emaSlow[idx]) ? 1 : 0;
  }

  /**
   * Sub-strategy C: MACD Momentum
   */
  voteMACD(macdData, idx) {
    const h = macdData.histogram[idx];
    const prevH = idx > 0 ? macdData.histogram[idx - 1] : NaN;
    const m = macdData.macd[idx];
    const s = macdData.signal[idx];
    if (isNaN(h) || isNaN(prevH) || isNaN(m) || isNaN(s)) return 0;
    // Bullish: MACD above signal AND histogram expanding (or just turned positive)
    return (m > s && (h > prevH || (prevH <= 0 && h > 0))) ? 1 : 0;
  }

  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);
    const openPositions = Object.values(portfolio.positions).filter(p => p !== 0).length;

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 110) continue;

      const closes = data.history.map(b => b.close);
      const highs = data.history.map(b => b.high);
      const lows = data.history.map(b => b.low);
      const idx = closes.length - 1;
      const price = closes[idx];

      // Compute all indicators once
      const emaFastVals = ema(closes, 10);
      const emaSlowVals = ema(closes, 30);
      const emaLongVals = ema(closes, this.macroEmaPeriod);
      const rsiValues = rsi(closes, this.rsiPeriod);
      const atrValues = atr(highs, lows, closes, this.atrPeriod);
      const macdData = macd(closes, this.macdFast, this.macdSlow, this.macdSignal);

      const a = atrValues[idx];
      if (isNaN(a)) continue;

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
        
        // Hard stop
        if (this.stops[pair] && price <= this.stops[pair]) exit = true;
        // Profit target
        if (price >= entryPrice + this.atrProfitMultiple * a) exit = true;
        // RSI overbought
        if (!isNaN(rsiValues[idx]) && rsiValues[idx] > this.rsiOverbought) exit = true;
        // MACD deep bearish — only exit on sustained bearish momentum
        const mh = macdData.histogram[idx];
        const mph = idx > 0 ? macdData.histogram[idx - 1] : NaN;
        const mh2 = idx > 1 ? macdData.histogram[idx - 2] : NaN;
        if (!isNaN(mh) && !isNaN(mph) && !isNaN(mh2) && mh < 0 && mph < 0 && mh2 < 0) exit = true;
        // Macro trend reversal — only exit if strongly bearish
        const macroSlope = (emaLongVals[idx] - emaLongVals[Math.max(0, idx - this.macroSlopeWindow)]) / (emaLongVals[Math.max(0, idx - this.macroSlopeWindow)] || 1);
        if (macroSlope < -0.005) exit = true;

        if (exit) {
          signals.push({ pair, targetPosition: 0 });
          this.lastTradeBar[pair] = idx;
          delete this.stops[pair];
          delete this.peaks[pair];
          delete this.entries[pair];
          delete this.entryVotes[pair];
        }
        continue;
      }

      // === ENTRY LOGIC ===
      if (idx - last < this.cooldown) continue;
      if (openPositions >= this.maxPositions) continue;
      
      // Macro trend gate
      if (!this.isMacroUptrend(emaLongVals, idx)) continue;

      // Ensemble voting
      const vA = this.voteDonchian(highs, closes, idx);
      const vB = this.voteRSI(rsiValues, emaFastVals, emaSlowVals, idx);
      const vC = this.voteMACD(macdData, idx);
      const totalVotes = vA + vB + vC;

      if (totalVotes < 2) continue; // Require 2+ votes for entry

      // Conviction-weighted position sizing
      const convMultiplier = this.convictionScale[totalVotes] || 1.0;
      const atrPct = a / price;
      const volScale = Math.min(2.0, Math.max(0.5, 0.015 / atrPct));
      const maxPos = totalEquity * this.basePositionSize * volScale * convMultiplier;

      signals.push({ pair, targetPosition: maxPos });
      this.lastTradeBar[pair] = idx;
      this.peaks[pair] = price;
      this.stops[pair] = price - this.atrTrailMultiple * a;
      this.entries[pair] = price;
      this.entryVotes[pair] = { donchian: vA, rsi: vB, macd: vC };
    }
    return signals;
  }
}

export default { Strategy };
