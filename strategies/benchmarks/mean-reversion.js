/**
 * Benchmark: Mean Reversion
 * Buy when price drops below lower Bollinger Band, sell when above upper
 */
import { bollingerBands } from '../../src/indicators.js';

export class Strategy {
  constructor() {
    this.bbPeriod = 20;
    this.bbStdDev = 2;
    this.positionSize = 0.1;
  }

  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 30) continue;

      const closes = data.history.map(b => b.close);
      const bb = bollingerBands(closes, this.bbPeriod, this.bbStdDev);
      const idx = closes.length - 1;
      const price = closes[idx];

      if (isNaN(bb.upper[idx]) || isNaN(bb.lower[idx])) continue;

      const currentPos = portfolio.positions[pair] || 0;
      const maxPos = totalEquity * this.positionSize;

      // Buy at lower band, sell at upper
      if (price < bb.lower[idx] && currentPos <= 0) {
        signals.push({ pair, targetPosition: maxPos });
      } else if (price > bb.upper[idx] && currentPos >= 0) {
        signals.push({ pair, targetPosition: -maxPos });
      } else if (currentPos !== 0 && price > bb.middle[idx] && price < bb.upper[idx]) {
        // Close at middle band
        if (currentPos > 0) signals.push({ pair, targetPosition: 0 });
      } else if (currentPos !== 0 && price < bb.middle[idx] && price > bb.lower[idx]) {
        if (currentPos < 0) signals.push({ pair, targetPosition: 0 });
      }
    }
    return signals;
  }
}

export default { Strategy };
