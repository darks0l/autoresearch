/**
 * strategy.js — Exp 18: Deviation 0.02 + ATR position sizing 0.15
 */
import { vwap, rsi, atr } from '../src/indicators.js';

export class Strategy {
  constructor() {
    this.vwapPeriod = 20;
    this.deviationThreshold = 0.02;
    this.rsiPeriod = 14;
    this.basePositionSize = 0.15;
    this.cooldown = 3;
    this.atrPeriod = 14;
    this.lastTradeBar = {};
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
      const volumes = data.history.map(b => b.volume);
      const idx = closes.length - 1;
      const vwapValues = vwap(closes, volumes, this.vwapPeriod);
      const rsiValues = rsi(closes, this.rsiPeriod);
      const atrValues = atr(highs, lows, closes, this.atrPeriod);
      const currentVwap = vwapValues[idx];
      const currentRsi = rsiValues[idx];
      const currentAtr = atrValues[idx];
      const price = closes[idx];
      if (isNaN(currentVwap) || isNaN(currentRsi) || isNaN(currentAtr)) continue;
      const lastTrade = this.lastTradeBar[pair] || -Infinity;
      if (idx - lastTrade < this.cooldown) continue;
      const deviation = (price - currentVwap) / currentVwap;
      const currentPos = portfolio.positions[pair] || 0;
      const atrPct = currentAtr / price;
      const volScale = Math.min(2.0, Math.max(0.5, 0.02 / atrPct));
      const maxPos = totalEquity * this.basePositionSize * volScale;
      
      if (deviation < -this.deviationThreshold && currentRsi < 40 && currentPos <= 0) {
        signals.push({ pair, targetPosition: maxPos });
        this.lastTradeBar[pair] = idx;
      } else if (deviation > this.deviationThreshold && currentRsi > 60 && currentPos >= 0) {
        signals.push({ pair, targetPosition: -maxPos });
        this.lastTradeBar[pair] = idx;
      } else if (currentPos !== 0 && Math.abs(deviation) < 0.005) {
        signals.push({ pair, targetPosition: 0 });
        this.lastTradeBar[pair] = idx;
      }
    }
    return signals;
  }
}
export default { Strategy };
