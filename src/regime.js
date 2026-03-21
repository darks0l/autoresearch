/**
 * Regime Detection Module
 * Identifies market regimes to adapt strategy behavior dynamically.
 * 
 * Regimes: trending_up, trending_down, mean_reverting, high_volatility, low_volatility
 */

import { ema, atr, stddev, percentileRank, rsi } from './indicators.js';

/**
 * Detect current market regime from price history
 * @param {number[]} closes - Close prices
 * @param {number[]} highs - High prices
 * @param {number[]} lows - Low prices
 * @param {number[]} volumes - Volume data
 * @param {Object} params - Detection parameters
 * @returns {{ regime: string, confidence: number, metrics: Object }}
 */
export function detectRegime(closes, highs, lows, volumes, params = {}) {
  const {
    fastEma = 20,
    slowEma = 50,
    atrPeriod = 14,
    lookback = 100,
    hurstLags = 50,
  } = params;

  if (closes.length < slowEma + 10) {
    return { regime: 'unknown', confidence: 0, metrics: {} };
  }

  const idx = closes.length - 1;

  // 1. Trend detection
  const trend = trendStrength(closes, fastEma, slowEma);

  // 2. Volatility regime
  const volRegime = volatilityRegime(highs, lows, closes, atrPeriod, lookback);

  // 3. Mean-reversion detection via Hurst exponent
  const hurst = hurstExponent(closes.slice(-Math.min(closes.length, lookback * 2)), hurstLags);

  // 4. RSI regime (extreme values indicate trending)
  const rsiValues = rsi(closes, 14);
  const currentRsi = rsiValues[idx];

  // Combined regime determination
  const metrics = {
    trendScore: trend.score,
    trendDirection: trend.direction,
    volatilityPercentile: volRegime.percentile,
    volatilityState: volRegime.state,
    hurstExponent: hurst,
    rsi: currentRsi,
  };

  // Decision logic with confidence scoring
  let regime = 'mean_reverting';
  let confidence = 0.5;

  // Strong trend overrides everything
  if (Math.abs(trend.score) > 0.6) {
    regime = trend.direction === 'up' ? 'trending_up' : 'trending_down';
    confidence = Math.min(0.95, 0.5 + Math.abs(trend.score) * 0.4);
  }
  // Hurst < 0.4 = strong mean reversion
  else if (hurst < 0.4) {
    regime = 'mean_reverting';
    confidence = Math.min(0.9, 0.5 + (0.5 - hurst) * 2);
  }
  // Hurst > 0.6 = trending (use trend direction)
  else if (hurst > 0.6) {
    regime = trend.direction === 'up' ? 'trending_up' : 'trending_down';
    confidence = Math.min(0.85, 0.4 + (hurst - 0.5) * 1.5);
  }

  // High volatility overlay — modifies regime
  if (volRegime.percentile > 80) {
    if (regime === 'mean_reverting') {
      regime = 'high_volatility';
      confidence = Math.min(0.9, confidence * 0.8 + 0.2);
    }
  } else if (volRegime.percentile < 20) {
    if (regime === 'mean_reverting') {
      regime = 'low_volatility';
      confidence = Math.min(0.85, confidence * 0.7 + 0.15);
    }
  }

  return { regime, confidence, metrics };
}

/**
 * Trend strength using dual EMA crossover + slope
 * @returns {{ score: number, direction: string }}
 * score: -1 (strong down) to +1 (strong up), 0 = no trend
 */
export function trendStrength(closes, fastPeriod = 20, slowPeriod = 50) {
  if (closes.length < slowPeriod + 5) {
    return { score: 0, direction: 'flat' };
  }

  const fastEmaValues = ema(closes, fastPeriod);
  const slowEmaValues = ema(closes, slowPeriod);
  const idx = closes.length - 1;

  const fastVal = fastEmaValues[idx];
  const slowVal = slowEmaValues[idx];

  if (isNaN(fastVal) || isNaN(slowVal) || slowVal === 0) {
    return { score: 0, direction: 'flat' };
  }

  // EMA spread normalized by price
  const spread = (fastVal - slowVal) / slowVal;

  // Slope of slow EMA over last 10 bars (trend persistence)
  const slopeWindow = 10;
  const prevSlow = slowEmaValues[idx - slopeWindow];
  const slope = (!isNaN(prevSlow) && prevSlow > 0) 
    ? (slowVal - prevSlow) / prevSlow 
    : 0;

  // Combined score: spread (0.6 weight) + slope (0.4 weight)
  const rawScore = spread * 15 * 0.6 + slope * 100 * 0.4;
  const score = Math.max(-1, Math.min(1, rawScore));
  const direction = score > 0.1 ? 'up' : score < -0.1 ? 'down' : 'flat';

  return { score, direction };
}

/**
 * Volatility regime using ATR percentile ranking
 * @returns {{ percentile: number, state: string, currentAtr: number }}
 */
export function volatilityRegime(highs, lows, closes, atrPeriod = 14, lookback = 100) {
  const atrValues = atr(highs, lows, closes, atrPeriod);
  const idx = atrValues.length - 1;
  const currentAtr = atrValues[idx];

  if (isNaN(currentAtr)) {
    return { percentile: 50, state: 'normal', currentAtr: 0 };
  }

  // Percentile rank of current ATR vs recent history
  const validAtrs = atrValues
    .slice(Math.max(0, idx - lookback), idx + 1)
    .filter(v => !isNaN(v));

  if (validAtrs.length < 10) {
    return { percentile: 50, state: 'normal', currentAtr };
  }

  const below = validAtrs.filter(v => v < currentAtr).length;
  const percentile = (below / validAtrs.length) * 100;

  let state = 'normal';
  if (percentile > 80) state = 'high';
  else if (percentile > 60) state = 'elevated';
  else if (percentile < 20) state = 'low';
  else if (percentile < 40) state = 'subdued';

  return { percentile, state, currentAtr };
}

/**
 * Hurst exponent estimation via Rescaled Range (R/S) analysis
 * H < 0.5: mean-reverting
 * H ≈ 0.5: random walk
 * H > 0.5: trending/persistent
 * @param {number[]} series - Price series
 * @param {number} maxLag - Maximum lag for R/S calculation
 * @returns {number} Hurst exponent estimate (0-1)
 */
export function hurstExponent(series, maxLag = 50) {
  if (series.length < maxLag + 10) {
    return 0.5; // Not enough data, assume random walk
  }

  // Convert to returns
  const returns = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1] !== 0) {
      returns.push(Math.log(series[i] / series[i - 1]));
    }
  }

  if (returns.length < maxLag) return 0.5;

  const lags = [];
  const rsValues = [];

  // Calculate R/S for different window sizes
  for (let n = 10; n <= Math.min(maxLag, Math.floor(returns.length / 2)); n += 2) {
    const numBlocks = Math.floor(returns.length / n);
    if (numBlocks < 1) continue;

    let rsSum = 0;
    let validBlocks = 0;

    for (let b = 0; b < numBlocks; b++) {
      const block = returns.slice(b * n, (b + 1) * n);
      const mean = block.reduce((a, c) => a + c, 0) / n;
      
      // Standard deviation
      const variance = block.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
      const sd = Math.sqrt(variance);
      if (sd === 0) continue;

      // Cumulative deviations
      let cumDev = 0;
      let maxCum = -Infinity;
      let minCum = Infinity;
      for (const r of block) {
        cumDev += r - mean;
        maxCum = Math.max(maxCum, cumDev);
        minCum = Math.min(minCum, cumDev);
      }

      const range = maxCum - minCum;
      rsSum += range / sd;
      validBlocks++;
    }

    if (validBlocks > 0) {
      lags.push(Math.log(n));
      rsValues.push(Math.log(rsSum / validBlocks));
    }
  }

  if (lags.length < 3) return 0.5;

  // Linear regression: log(R/S) = H * log(n) + c
  const n = lags.length;
  const sumX = lags.reduce((a, b) => a + b, 0);
  const sumY = rsValues.reduce((a, b) => a + b, 0);
  const sumXY = lags.reduce((sum, x, i) => sum + x * rsValues[i], 0);
  const sumX2 = lags.reduce((sum, x) => sum + x * x, 0);

  const hurst = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Clamp to valid range
  return Math.max(0.01, Math.min(0.99, hurst));
}

/**
 * Get regime summary string for LLM context
 */
export function regimeSummary(regimeData) {
  const { regime, confidence, metrics } = regimeData;
  const pct = (confidence * 100).toFixed(0);
  const lines = [
    `Regime: ${regime} (${pct}% confidence)`,
    `  Trend: ${metrics.trendDirection} (score ${metrics.trendScore?.toFixed(3)})`,
    `  Volatility: ${metrics.volatilityState} (${metrics.volatilityPercentile?.toFixed(0)}th pctl)`,
    `  Hurst: ${metrics.hurstExponent?.toFixed(3)} (${metrics.hurstExponent < 0.45 ? 'mean-reverting' : metrics.hurstExponent > 0.55 ? 'trending' : 'random walk'})`,
    `  RSI: ${metrics.rsi?.toFixed(1)}`,
  ];
  return lines.join('\n');
}

export default { detectRegime, trendStrength, volatilityRegime, hurstExponent, regimeSummary };
