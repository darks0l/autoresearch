/**
 * strategy-trend.js — Trend-following strategy for real data
 * 
 * Key insight: Real crypto data trends (ETH +12.4% in 30 days).
 * VWAP reversion fails because it shorts uptrends.
 * 
 * This strategy:
 * 1. Only trades with the trend (EMA crossover)
 * 2. Uses RSI for entry timing (buy dips in uptrend, sell rips in downtrend)
 * 3. ATR-based position sizing (inverse volatility)
 * 4. Trailing stop based on ATR
 */
import { rsi, atr, ema } from '../src/indicators.js';

export class Strategy {
  constructor() {
    this.fastEma = 12;
    this.slowEma = 26;
    this.rsiPeriod = 14;
    this.rsiBuyZone = 45;     // buy when RSI dips below this in uptrend
    this.rsiSellZone = 55;    // sell when RSI rises above this in downtrend
    this.atrPeriod = 14;
    this.basePositionSize = 0.12;
    this.atrStopMultiple = 2.5; // trailing stop = 2.5 * ATR
    this.cooldown = 4;
    this.lastTradeBar = {};
    this.trailingStops = {};    // pair → stop price
    this.entryPrices = {};      // pair → entry price
  }

  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 30) continue;

      const closes = data.history.map(b => b.close);
      const highs = data.history.map(b => b.high);
      const lows = data.history.map(b => b.low);
      const idx = closes.length - 1;
      const price = closes[idx];

      // Indicators
      const fastEmaVals = ema(closes, this.fastEma);
      const slowEmaVals = ema(closes, this.slowEma);
      const rsiValues = rsi(closes, this.rsiPeriod);
      const atrValues = atr(highs, lows, closes, this.atrPeriod);

      const currentFastEma = fastEmaVals[idx];
      const currentSlowEma = slowEmaVals[idx];
      const currentRsi = rsiValues[idx];
      const currentAtr = atrValues[idx];

      if (isNaN(currentFastEma) || isNaN(currentSlowEma) || isNaN(currentRsi) || isNaN(currentAtr)) continue;

      const lastTrade = this.lastTradeBar[pair] || -Infinity;
      if (idx - lastTrade < this.cooldown) continue;

      const currentPos = portfolio.positions[pair] || 0;
      const uptrend = currentFastEma > currentSlowEma;
      const downtrend = currentFastEma < currentSlowEma;

      // ATR-based position sizing (inverse volatility)
      const atrPct = currentAtr / price;
      const volScale = Math.min(2.0, Math.max(0.5, 0.015 / atrPct));
      const maxPos = totalEquity * this.basePositionSize * volScale;

      // Check trailing stops
      if (currentPos > 0 && this.trailingStops[pair]) {
        // Update trailing stop (only moves up for longs)
        const newStop = price - this.atrStopMultiple * currentAtr;
        if (newStop > this.trailingStops[pair]) {
          this.trailingStops[pair] = newStop;
        }
        // Check if stopped out
        if (price <= this.trailingStops[pair]) {
          signals.push({ pair, targetPosition: 0 });
          this.lastTradeBar[pair] = idx;
          delete this.trailingStops[pair];
          delete this.entryPrices[pair];
          continue;
        }
      } else if (currentPos < 0 && this.trailingStops[pair]) {
        // Update trailing stop (only moves down for shorts)
        const newStop = price + this.atrStopMultiple * currentAtr;
        if (newStop < this.trailingStops[pair]) {
          this.trailingStops[pair] = newStop;
        }
        if (price >= this.trailingStops[pair]) {
          signals.push({ pair, targetPosition: 0 });
          this.lastTradeBar[pair] = idx;
          delete this.trailingStops[pair];
          delete this.entryPrices[pair];
          continue;
        }
      }

      // Exit on trend reversal
      if (currentPos > 0 && downtrend) {
        signals.push({ pair, targetPosition: 0 });
        this.lastTradeBar[pair] = idx;
        delete this.trailingStops[pair];
        delete this.entryPrices[pair];
        continue;
      }
      if (currentPos < 0 && uptrend) {
        signals.push({ pair, targetPosition: 0 });
        this.lastTradeBar[pair] = idx;
        delete this.trailingStops[pair];
        delete this.entryPrices[pair];
        continue;
      }

      // Entry: buy dips in uptrend
      if (uptrend && currentRsi < this.rsiBuyZone && currentPos <= 0) {
        signals.push({ pair, targetPosition: maxPos });
        this.lastTradeBar[pair] = idx;
        this.trailingStops[pair] = price - this.atrStopMultiple * currentAtr;
        this.entryPrices[pair] = price;
      }

      // Entry: sell rips in downtrend (only for non-trending pairs)
      if (downtrend && currentRsi > this.rsiSellZone && currentPos >= 0) {
        // Only short volatile/mean-reverting pairs, not trending ETH
        if (pair.includes('AERO') || pair.includes('cbETH')) {
          signals.push({ pair, targetPosition: -maxPos * 0.5 }); // smaller shorts
          this.lastTradeBar[pair] = idx;
          this.trailingStops[pair] = price + this.atrStopMultiple * currentAtr;
          this.entryPrices[pair] = price;
        }
      }
    }
    return signals;
  }
}

export default { Strategy };
