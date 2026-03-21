/**
 * Benchmark: VWAP Reversion
 * Trade mean reversion to VWAP with volume confirmation
 */
import { vwap, rsi } from '../../src/indicators.js';

export class Strategy {
  constructor() {
    this.vwapPeriod = 20;
    this.deviationThreshold = 0.02; // 2% deviation from VWAP
    this.rsiPeriod = 14;
    this.positionSize = 0.1;
    this.cooldown = 3;
    this.lastTradeBar = {};
  }

  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 30) continue;

      const closes = data.history.map(b => b.close);
      const volumes = data.history.map(b => b.volume);
      const idx = closes.length - 1;

      const vwapValues = vwap(closes, volumes, this.vwapPeriod);
      const rsiValues = rsi(closes, this.rsiPeriod);
      const currentVwap = vwapValues[idx];
      const currentRsi = rsiValues[idx];
      const price = closes[idx];

      if (isNaN(currentVwap) || isNaN(currentRsi)) continue;

      const lastTrade = this.lastTradeBar[pair] || -Infinity;
      if (idx - lastTrade < this.cooldown) continue;

      const deviation = (price - currentVwap) / currentVwap;
      const currentPos = portfolio.positions[pair] || 0;
      const maxPos = totalEquity * this.positionSize;

      // Buy below VWAP with RSI confirmation
      if (deviation < -this.deviationThreshold && currentRsi < 40 && currentPos <= 0) {
        signals.push({ pair, targetPosition: maxPos });
        this.lastTradeBar[pair] = idx;
      }
      // Sell above VWAP with RSI confirmation
      else if (deviation > this.deviationThreshold && currentRsi > 60 && currentPos >= 0) {
        signals.push({ pair, targetPosition: -maxPos });
        this.lastTradeBar[pair] = idx;
      }
      // Close when back to VWAP
      else if (currentPos !== 0 && Math.abs(deviation) < 0.005) {
        signals.push({ pair, targetPosition: 0 });
        this.lastTradeBar[pair] = idx;
      }
    }
    return signals;
  }
}

export default { Strategy };
