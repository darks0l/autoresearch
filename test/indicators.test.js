import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sma, ema, rsi, macd, bollingerBands, atr, vwap, roc, stddev, percentileRank } from '../src/indicators.js';

describe('SMA', () => {
  it('computes correct simple moving average', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = sma(values, 3);
    assert.equal(result[0], NaN);
    assert.equal(result[1], NaN);
    assert.equal(result[2], 2); // (1+2+3)/3
    assert.equal(result[3], 3); // (2+3+4)/3
    assert.equal(result[9], 9); // (8+9+10)/3
  });

  it('returns NaN for insufficient data', () => {
    const result = sma([1, 2], 5);
    assert.ok(isNaN(result[0]));
    assert.ok(isNaN(result[1]));
  });
});

describe('EMA', () => {
  it('computes exponential moving average', () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const result = ema(values, 3);
    assert.ok(!isNaN(result[2]));
    assert.ok(result[10] > result[2]); // trending up
  });
});

describe('RSI', () => {
  it('computes RSI in 0-100 range', () => {
    // Strongly trending up → RSI should be high
    const up = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const result = rsi(up, 14);
    const lastValid = result.filter(v => !isNaN(v)).pop();
    assert.ok(lastValid > 50, `Expected RSI > 50, got ${lastValid}`);
  });

  it('handles flat data', () => {
    const flat = new Array(50).fill(100);
    const result = rsi(flat, 14);
    // No change → RSI should be 100 (no losses) or NaN
    const lastValid = result.filter(v => !isNaN(v)).pop();
    assert.ok(lastValid === 100 || lastValid === undefined);
  });
});

describe('MACD', () => {
  it('returns macd, signal, and histogram arrays', () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = macd(values);
    assert.ok(Array.isArray(result.macd));
    assert.ok(Array.isArray(result.signal));
    assert.ok(Array.isArray(result.histogram));
    assert.equal(result.macd.length, values.length);
  });
});

describe('Bollinger Bands', () => {
  it('upper > middle > lower', () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + Math.random() * 10);
    const bb = bollingerBands(values, 20, 2);
    const idx = 30;
    assert.ok(bb.upper[idx] > bb.middle[idx]);
    assert.ok(bb.middle[idx] > bb.lower[idx]);
  });

  it('width is positive', () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + Math.random() * 10);
    const bb = bollingerBands(values, 20, 2);
    const validWidths = bb.width.filter(w => !isNaN(w));
    assert.ok(validWidths.every(w => w > 0));
  });
});

describe('ATR', () => {
  it('computes average true range', () => {
    const highs = Array.from({ length: 30 }, () => 105 + Math.random() * 5);
    const lows = Array.from({ length: 30 }, () => 95 + Math.random() * 5);
    const closes = Array.from({ length: 30 }, () => 100 + Math.random() * 5);
    const result = atr(highs, lows, closes, 14);
    const valid = result.filter(v => !isNaN(v));
    assert.ok(valid.length > 0);
    assert.ok(valid.every(v => v > 0));
  });
});

describe('VWAP', () => {
  it('is close to price with uniform volume', () => {
    const closes = Array.from({ length: 30 }, () => 100);
    const volumes = new Array(30).fill(1000);
    const result = vwap(closes, volumes, 20);
    const valid = result.filter(v => !isNaN(v));
    assert.ok(valid.every(v => Math.abs(v - 100) < 0.01));
  });
});

describe('ROC', () => {
  it('computes rate of change', () => {
    const values = [100, 110, 121, 133.1];
    const result = roc(values, 1);
    assert.ok(isNaN(result[0]));
    assert.ok(Math.abs(result[1] - 10) < 0.01); // 10% gain
  });
});

describe('Percentile Rank', () => {
  it('returns values between 0-100', () => {
    const values = Array.from({ length: 50 }, (_, i) => i);
    const result = percentileRank(values, 20);
    const valid = result.filter(v => !isNaN(v));
    assert.ok(valid.every(v => v >= 0 && v <= 100));
  });
});
