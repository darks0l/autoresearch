/**
 * Technical Indicators Library
 * Pure functions — no external dependencies, just math on arrays.
 */

/**
 * Simple Moving Average
 * @param {number[]} values - Price array
 * @param {number} period - Lookback period
 * @returns {number[]} SMA values (NaN for insufficient data)
 */
export function sma(values, period) {
  const result = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result[i] = sum / period;
  }
  return result;
}

/**
 * Exponential Moving Average
 * @param {number[]} values
 * @param {number} period
 * @returns {number[]}
 */
export function ema(values, period) {
  const result = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

/**
 * Relative Strength Index
 * @param {number[]} closes - Close prices
 * @param {number} period - RSI period (default 14)
 * @returns {number[]}
 */
export function rsi(closes, period = 14) {
  const result = new Array(closes.length).fill(NaN);
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  if (gains.length < period) return result;

  // Initial average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    result[i + 1] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * @param {number[]} closes
 * @param {number} fast - Fast EMA period (default 12)
 * @param {number} slow - Slow EMA period (default 26)
 * @param {number} signal - Signal line period (default 9)
 * @returns {{ macd: number[], signal: number[], histogram: number[] }}
 */
export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine = fastEma.map((f, i) => (isNaN(f) || isNaN(slowEma[i])) ? NaN : f - slowEma[i]);

  // Signal line = EMA of MACD line (only on valid values)
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalEma = ema(validMacd, signal);

  // Map signal back to original indices
  const signalLine = new Array(closes.length).fill(NaN);
  let vi = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (!isNaN(macdLine[i])) {
      signalLine[i] = signalEma[vi] || NaN;
      vi++;
    }
  }

  const histogram = macdLine.map((m, i) => (isNaN(m) || isNaN(signalLine[i])) ? NaN : m - signalLine[i]);

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Bollinger Bands
 * @param {number[]} closes
 * @param {number} period - SMA period (default 20)
 * @param {number} stdDev - Standard deviation multiplier (default 2)
 * @returns {{ upper: number[], middle: number[], lower: number[], width: number[] }}
 */
export function bollingerBands(closes, period = 20, stdDev = 2) {
  const middle = sma(closes, period);
  const upper = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);
  const width = new Array(closes.length).fill(NaN);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + stdDev * sd;
    lower[i] = mean - stdDev * sd;
    width[i] = mean > 0 ? (upper[i] - lower[i]) / mean : 0;
  }

  return { upper, middle, lower, width };
}

/**
 * Average True Range
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} period - ATR period (default 14)
 * @returns {number[]}
 */
export function atr(highs, lows, closes, period = 14) {
  const tr = new Array(closes.length).fill(NaN);
  tr[0] = highs[0] - lows[0];

  for (let i = 1; i < closes.length; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  // Wilder's smoothing (RMA)
  const result = new Array(closes.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  result[period - 1] = sum / period;

  for (let i = period; i < closes.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
  }
  return result;
}

/**
 * Volume Weighted Average Price
 * @param {number[]} closes
 * @param {number[]} volumes
 * @param {number} period - Rolling window (default 20)
 * @returns {number[]}
 */
export function vwap(closes, volumes, period = 20) {
  const result = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let sumPV = 0, sumV = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumPV += closes[j] * volumes[j];
      sumV += volumes[j];
    }
    result[i] = sumV > 0 ? sumPV / sumV : closes[i];
  }
  return result;
}

/**
 * Rate of Change (momentum)
 * @param {number[]} values
 * @param {number} period
 * @returns {number[]}
 */
export function roc(values, period = 10) {
  const result = new Array(values.length).fill(NaN);
  for (let i = period; i < values.length; i++) {
    result[i] = values[i - period] !== 0 ? (values[i] - values[i - period]) / values[i - period] * 100 : 0;
  }
  return result;
}

/**
 * Standard Deviation
 * @param {number[]} values
 * @param {number} period
 * @returns {number[]}
 */
export function stddev(values, period = 20) {
  const result = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    result[i] = Math.sqrt(variance);
  }
  return result;
}

/**
 * Percentile rank of a value within a rolling window
 * @param {number[]} values
 * @param {number} period
 * @returns {number[]} 0-100 percentile
 */
export function percentileRank(values, period = 100) {
  const result = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const current = values[i];
    const below = window.filter(v => v < current).length;
    result[i] = (below / period) * 100;
  }
  return result;
}
