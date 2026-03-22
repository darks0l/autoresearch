/**
 * strategy-dual-regime-adaptive.js — Dual Strategy Portfolio Allocation
 * 
 * STRUCTURAL CHANGE: Run TWO independent strategies in parallel:
 * 1. Pure Trend Breakout (existing logic)
 * 2. Counter-Trend Mean-Reversion (Bollinger Band bounces)
 * 
 * Capital allocation dynamically adjusts based on Hurst exponent:
 * - Hurst > 0.55 (trending): 70% breakout, 30% mean-reversion
 * - Hurst < 0.45 (ranging): 30% breakout, 70% mean-reversion
 * - Hurst 0.45-0.55 (neutral): 50% breakout, 50% mean-reversion
 * 
 * Each strategy maintains independent positions and risk management.
 */
import { rsi, atr, ema, sma, macd, roc, percentileRank, bollingerBands, stddev } from '../src/indicators.js';

export class Strategy {
  constructor() {
    // Hurst exponent for regime detection
    this.hurstLookback = 50;
    
    // Breakout strategy parameters
    this.trendEmaPeriod = 50;
    this.breakoutLookbackLow = 15;
    this.breakoutLookbackHigh = 25;
    this.volRegimeThreshold = 70;
    this.atrPeriod = 10;
    this.atrPercentileLookback = 50;
    this.atrPercentileThreshold = 60;
    this.rocPeriod = 10;
    this.atrTrailMultiple = 1.5;
    this.atrProfitMultipleMin = 2.0;
    this.atrProfitMultipleMax = 4.0;
    this.trendStrengthThreshold = 0.10;
    
    // Mean-reversion strategy parameters
    this.bbPeriod = 20;
    this.bbStdDev = 2.0;
    this.rsiPeriod = 14;
    this.rsiOversold = 30;
    this.rsiOverbought = 70;
    this.mrProfitTarget = 0.015; // 1.5% profit target
    this.mrStopLoss = 0.01; // 1% stop loss
    
    // Portfolio allocation
    this.basePositionSize = 0.15;
    this.maxPositions = 3;
    this.cooldown = 3;
    
    // State tracking (separate for each strategy)
    this.breakout = {
      lastTradeBar: {},
      stops: {},
      peaks: {},
      entries: {}
    };
    
    this.meanRev = {
      lastTradeBar: {},
      entries: {},
      targets: {},
      stops: {}
    };
  }

  calculateHurst(prices, lookback) {
    if (prices.length < lookback) return 0.5;
    
    const returns = [];
    for (let i = 1; i < lookback; i++) {
      returns.push(Math.log(prices[prices.length - lookback + i] / prices[prices.length - lookback + i - 1]));
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const cumDev = [];
    let sum = 0;
    for (let i = 0; i < returns.length; i++) {
      sum += returns[i] - mean;
      cumDev.push(sum);
    }
    
    const range = Math.max(...cumDev) - Math.min(...cumDev);
    const std = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length);
    
    if (std === 0 || range === 0) return 0.5;
    const rs = range / std;
    return Math.log(rs) / Math.log(returns.length);
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

      // Calculate Hurst exponent for regime detection
      const hurst = this.calculateHurst(closes, this.hurstLookback);
      
      // Determine allocation weights
      let breakoutWeight = 0.5;
      let meanRevWeight = 0.5;
      
      if (hurst > 0.55) {
        breakoutWeight = 0.7;
        meanRevWeight = 0.3;
      } else if (hurst < 0.45) {
        breakoutWeight = 0.3;
        meanRevWeight = 0.7;
      }

      // Compute common indicators
      const trendEma = ema(closes, this.trendEmaPeriod);
      const atrValues = atr(highs, lows, closes, this.atrPeriod);
      const atrPercentile = percentileRank(atrValues, this.atrPercentileLookback);
      const rocValues = roc(closes, this.rocPeriod);
      const bb = bollingerBands(closes, this.bbPeriod, this.bbStdDev);
      const rsiValues = rsi(closes, this.rsiPeriod);

      const a = atrValues[idx];
      const trendEmaVal = trendEma[idx];
      const atrPctRank = atrPercentile[idx];
      const rocVal = rocValues[idx];
      const bbUpper = bb.upper[idx];
      const bbLower = bb.lower[idx];
      const bbMiddle = bb.middle[idx];
      const rsiVal = rsiValues[idx];

      if (isNaN(a) || isNaN(trendEmaVal)) continue;

      const currentPos = portfolio.positions[pair] || 0;

      // === BREAKOUT STRATEGY MANAGEMENT ===
      const breakoutPos = currentPos > 0 && this.breakout.entries[pair] ? currentPos : 0;
      
      if (breakoutPos > 0) {
        if (!this.breakout.peaks[pair] || price > this.breakout.peaks[pair]) {
          this.breakout.peaks[pair] = price;
          this.breakout.stops[pair] = price - this.atrTrailMultiple * a;
        }

        const entryPrice = this.breakout.entries[pair];
        let exit = false;
        
        if (this.breakout.stops[pair] && price <= this.breakout.stops[pair]) exit = true;
        
        const trendStrength = (price - trendEmaVal) / trendEmaVal;
        let profitMultiple = this.atrProfitMultipleMin;
        if (trendStrength >= this.trendStrengthThreshold) {
          profitMultiple = this.atrProfitMultipleMax;
        } else if (trendStrength > 0) {
          profitMultiple = this.atrProfitMultipleMin + 
            (this.atrProfitMultipleMax - this.atrProfitMultipleMin) * (trendStrength / this.trendStrengthThreshold);
        }
        
        if (price >= entryPrice + profitMultiple * a) exit = true;
        if (price < trendEmaVal) exit = true;

        if (exit) {
          signals.push({ pair, targetPosition: 0 });
          this.breakout.lastTradeBar[pair] = idx;
          delete this.breakout.stops[pair];
          delete this.breakout.peaks[pair];
          delete this.breakout.entries[pair];
          continue;
        }
      }

      // === MEAN-REVERSION STRATEGY MANAGEMENT ===
      const meanRevPos = currentPos < 0 && this.meanRev.entries[pair] ? currentPos : 0;
      
      if (meanRevPos < 0) {
        const entryPrice = this.meanRev.entries[pair];
        const targetPrice = this.meanRev.targets[pair];
        const stopPrice = this.meanRev.stops[pair];
        
        let exit = false;
        if (price >= targetPrice) exit = true;
        if (price >= stopPrice) exit = true;
        if (!isNaN(rsiVal) && rsiVal > this.rsiOverbought) exit = true;

        if (exit) {
          signals.push({ pair, targetPosition: 0 });
          this.meanRev.lastTradeBar[pair] = idx;
          delete this.meanRev.entries[pair];
          delete this.meanRev.targets[pair];
          delete this.meanRev.stops[pair];
          continue;
        }
      }

      if (currentPos !== 0) continue;

      // === BREAKOUT ENTRY LOGIC ===
      const breakoutLast = this.breakout.lastTradeBar[pair] || -Infinity;
      if (idx - breakoutLast >= this.cooldown && openPositions < this.maxPositions) {
        if (price >= trendEmaVal && !isNaN(atrPctRank)) {
          const breakoutLookback = atrPctRank >= this.volRegimeThreshold 
            ? this.breakoutLookbackLow 
            : this.breakoutLookbackHigh;
          
          if (idx >= breakoutLookback) {
            const channelHigh = Math.max(...highs.slice(idx - breakoutLookback, idx));
            if (price >= channelHigh * 0.998 && atrPctRank >= this.atrPercentileThreshold) {
              if (!isNaN(rocVal) && rocVal > 0) {
                const atrPct = a / price;
                const volScale = Math.min(2.0, Math.max(0.5, 0.015 / atrPct));
                const maxPos = totalEquity * this.basePositionSize * breakoutWeight * volScale;

                signals.push({ pair, targetPosition: maxPos });
                this.breakout.lastTradeBar[pair] = idx;
                this.breakout.peaks[pair] = price;
                this.breakout.stops[pair] = price - this.atrTrailMultiple * a;
                this.breakout.entries[pair] = price;
                continue;
              }
            }
          }
        }
      }

      // === MEAN-REVERSION ENTRY LOGIC ===
      const meanRevLast = this.meanRev.lastTradeBar[pair] || -Infinity;
      if (idx - meanRevLast >= this.cooldown && openPositions < this.maxPositions) {
        if (!isNaN(bbLower) && !isNaN(rsiVal)) {
          // Short on overbought bounce from upper band
          if (price >= bbUpper * 0.998 && rsiVal > this.rsiOverbought) {
            const maxPos = totalEquity * this.basePositionSize * meanRevWeight;
            
            signals.push({ pair, targetPosition: -maxPos });
            this.meanRev.lastTradeBar[pair] = idx;
            this.meanRev.entries[pair] = price;
            this.meanRev.targets[pair] = price * (1 - this.mrProfitTarget);
            this.meanRev.stops[pair] = price * (1 + this.mrStopLoss);
            continue;
          }
        }
      }
    }
    
    return signals;
  }
}

export default { Strategy };