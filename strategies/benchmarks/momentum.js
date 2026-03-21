/**
 * Benchmark: Simple Momentum
 * Buy when price > SMA(20), sell when price < SMA(20)
 */
import { sma } from '../../src/indicators.js';

export class Strategy {
  constructor() {
    this.smaPeriod = 20;
    this.positionSize = 0.15;
  }

  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 30) continue;

      const closes = data.history.map(b => b.close);
      const smaValues = sma(closes, this.smaPeriod);
      const current = closes[closes.length - 1];
      const currentSma = smaValues[smaValues.length - 1];

      if (isNaN(currentSma)) continue;

      const currentPos = portfolio.positions[pair] || 0;
      const maxPos = totalEquity * this.positionSize;

      if (current > currentSma && currentPos <= 0) {
        signals.push({ pair, targetPosition: maxPos });
      } else if (current < currentSma && currentPos >= 0) {
        signals.push({ pair, targetPosition: -maxPos });
      }
    }
    return signals;
  }
}

export default { Strategy };
