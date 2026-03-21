/**
 * strategy-regime.js — Regime-Aware Adaptive Strategy
 * 
 * Adapts between VWAP mean-reversion (proven 0.74 score) and EMA momentum
 * based on detected market regime. Position sizing scales with volatility.
 * 
 * Regimes:
 * - mean_reverting → VWAP reversion (our bread and butter)
 * - trending_up/down → EMA momentum following
 * - high_volatility → reduced position size, wider stops
 * - low_volatility → skip (no edge, save on fees)
 */
import { vwap, rsi, atr, ema, macd, bollingerBands } from '../src/indicators.js';
import { detectRegime } from '../src/regime.js';

export class Strategy {
  constructor() {
    // VWAP mean-reversion params (proven best from 75 experiments)
    this.vwapPeriod = 20;
    this.deviationThreshold = 0.022;
    this.exitThreshold = 0.015;
    this.rsiPeriod = 10;
    this.basePositionSize = 0.15;
    this.cooldown = 3;
    this.atrPeriod = 5;

    // Momentum params (for trending regimes)
    this.fastEmaPeriod = 12;
    this.slowEmaPeriod = 26;
    this.momentumPositionSize = 0.12;
    this.momentumExitBars = 8;

    // Regime adaptation
    this.regimeConfidenceThreshold = 0.55;
    this.highVolPositionScale = 0.5;    // Halve size in high vol
    this.trendPositionScale = 1.2;       // Slightly larger in confirmed trends

    // State tracking
    this.lastTradeBar = {};
    this.entryBar = {};
    this.currentRegimes = {};
  }

  onBar(barData, portfolio) {
    const signals = [];
    const totalEquity = portfolio.cash +
      Object.values(portfolio.positions).reduce((sum, pos) => sum + Math.abs(pos), 0);

    for (const [pair, data] of Object.entries(barData)) {
      if (!data.history || data.history.length < 60) continue;

      const closes = data.history.map(b => b.close);
      const highs = data.history.map(b => b.high);
      const lows = data.history.map(b => b.low);
      const volumes = data.history.map(b => b.volume);
      const idx = closes.length - 1;

      // Detect current regime
      const regimeData = detectRegime(closes, highs, lows, volumes, {
        fastEma: this.fastEmaPeriod,
        slowEma: this.slowEmaPeriod,
        atrPeriod: this.atrPeriod,
        lookback: 100,
      });
      this.currentRegimes[pair] = regimeData;

      const { regime, confidence } = regimeData;
      const currentPos = portfolio.positions[pair] || 0;
      const lastTrade = this.lastTradeBar[pair] || -Infinity;

      // Cooldown check
      if (idx - lastTrade < this.cooldown) continue;

      // Low volatility = no edge, skip
      if (regime === 'low_volatility' && confidence > this.regimeConfidenceThreshold) {
        // Close any open positions and sit out
        if (currentPos !== 0) {
          signals.push({ pair, targetPosition: 0 });
          this.lastTradeBar[pair] = idx;
        }
        continue;
      }

      // Route to appropriate sub-strategy
      let signal = null;

      if ((regime === 'trending_up' || regime === 'trending_down') && confidence > this.regimeConfidenceThreshold) {
        signal = this._momentumSignal(pair, closes, highs, lows, volumes, idx, totalEquity, currentPos, regime);
      } else {
        // Default: mean-reversion (works in mean_reverting, high_volatility, and uncertain regimes)
        signal = this._meanReversionSignal(pair, closes, highs, lows, volumes, idx, totalEquity, currentPos, regime);
      }

      if (signal) {
        signals.push(signal);
        this.lastTradeBar[pair] = idx;
        if (signal.targetPosition !== 0) {
          this.entryBar[pair] = idx;
        }
      }
    }

    return signals;
  }

  /**
   * VWAP Mean-Reversion — our proven core (score 0.74)
   */
  _meanReversionSignal(pair, closes, highs, lows, volumes, idx, totalEquity, currentPos, regime) {
    const vwapValues = vwap(closes, volumes, this.vwapPeriod);
    const rsiValues = rsi(closes, this.rsiPeriod);
    const atrValues = atr(highs, lows, closes, this.atrPeriod);

    const currentVwap = vwapValues[idx];
    const currentRsi = rsiValues[idx];
    const currentAtr = atrValues[idx];
    const price = closes[idx];

    if (isNaN(currentVwap) || isNaN(currentRsi) || isNaN(currentAtr)) return null;

    const deviation = (price - currentVwap) / currentVwap;
    const atrPct = currentAtr / price;
    const volScale = Math.min(2.0, Math.max(0.5, 0.02 / atrPct));

    // Scale position size based on regime
    let sizeMultiplier = 1.0;
    if (regime === 'high_volatility') sizeMultiplier = this.highVolPositionScale;

    const maxPos = totalEquity * this.basePositionSize * volScale * sizeMultiplier;

    // In high-vol, widen the deviation threshold slightly
    const devThreshold = regime === 'high_volatility'
      ? this.deviationThreshold * 1.3
      : this.deviationThreshold;

    if (deviation < -devThreshold && currentRsi < 40 && currentPos <= 0) {
      return { pair, targetPosition: maxPos };
    } else if (deviation > devThreshold && currentRsi > 60 && currentPos >= 0) {
      return { pair, targetPosition: -maxPos };
    } else if (currentPos !== 0 && Math.abs(deviation) < this.exitThreshold) {
      return { pair, targetPosition: 0 };
    }

    return null;
  }

  /**
   * EMA Momentum — for confirmed trending regimes
   */
  _momentumSignal(pair, closes, highs, lows, volumes, idx, totalEquity, currentPos, regime) {
    const fastEmaValues = ema(closes, this.fastEmaPeriod);
    const slowEmaValues = ema(closes, this.slowEmaPeriod);
    const atrValues = atr(highs, lows, closes, this.atrPeriod);
    const rsiValues = rsi(closes, this.rsiPeriod);

    const fastVal = fastEmaValues[idx];
    const slowVal = slowEmaValues[idx];
    const prevFast = fastEmaValues[idx - 1];
    const prevSlow = slowEmaValues[idx - 1];
    const currentAtr = atrValues[idx];
    const currentRsi = rsiValues[idx];
    const price = closes[idx];

    if ([fastVal, slowVal, prevFast, prevSlow, currentAtr].some(isNaN)) return null;

    const atrPct = currentAtr / price;
    const volScale = Math.min(2.0, Math.max(0.5, 0.02 / atrPct));
    const maxPos = totalEquity * this.momentumPositionSize * volScale * this.trendPositionScale;

    // Trend following with EMA crossover
    const bullishCross = fastVal > slowVal && prevFast <= prevSlow;
    const bearishCross = fastVal < slowVal && prevFast >= prevSlow;
    const isBullTrend = regime === 'trending_up';

    // Enter on crossover OR if already trending and no position
    if (isBullTrend && currentPos <= 0) {
      if (bullishCross || (fastVal > slowVal && currentRsi > 50 && currentRsi < 75)) {
        return { pair, targetPosition: maxPos };
      }
    } else if (!isBullTrend && currentPos >= 0) {
      if (bearishCross || (fastVal < slowVal && currentRsi < 50 && currentRsi > 25)) {
        return { pair, targetPosition: -maxPos };
      }
    }

    // Time-based exit for momentum trades
    const entryBar = this.entryBar[pair] || 0;
    if (currentPos !== 0 && (idx - entryBar) > this.momentumExitBars) {
      // Exit if trend is fading
      const trendFading = (currentPos > 0 && fastVal < slowVal) || (currentPos < 0 && fastVal > slowVal);
      if (trendFading) {
        return { pair, targetPosition: 0 };
      }
    }

    // RSI extreme exit
    if (currentPos > 0 && currentRsi > 80) return { pair, targetPosition: 0 };
    if (currentPos < 0 && currentRsi < 20) return { pair, targetPosition: 0 };

    return null;
  }
}

export default { Strategy };
