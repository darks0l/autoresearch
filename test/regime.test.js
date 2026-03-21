import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectRegime, trendStrength, volatilityRegime, hurstExponent, regimeSummary } from '../src/regime.js';

// Helper: generate trending price series
function trendingUp(n = 200, start = 100, drift = 0.002) {
  const closes = [start];
  for (let i = 1; i < n; i++) {
    closes.push(closes[i - 1] * (1 + drift + (Math.random() - 0.4) * 0.005));
  }
  return closes;
}

function trendingDown(n = 200, start = 100, drift = -0.002) {
  return trendingUp(n, start, drift);
}

function meanReverting(n = 200, center = 100, amplitude = 2) {
  const closes = [];
  for (let i = 0; i < n; i++) {
    closes.push(center + Math.sin(i * 0.3) * amplitude + (Math.random() - 0.5) * 0.5);
  }
  return closes;
}

function makeOHLCV(closes) {
  const highs = closes.map(c => c * (1 + Math.random() * 0.005));
  const lows = closes.map(c => c * (1 - Math.random() * 0.005));
  const volumes = closes.map(() => 1000000 + Math.random() * 5000000);
  return { highs, lows, volumes };
}

describe('Regime Detection', () => {
  describe('trendStrength', () => {
    it('detects uptrend', () => {
      const closes = trendingUp(200);
      const result = trendStrength(closes);
      assert.equal(result.direction, 'up');
      assert.ok(result.score > 0.1, `Expected positive score, got ${result.score}`);
    });

    it('detects downtrend', () => {
      const closes = trendingDown(200);
      const result = trendStrength(closes);
      assert.equal(result.direction, 'down');
      assert.ok(result.score < -0.1, `Expected negative score, got ${result.score}`);
    });

    it('returns flat for sideways', () => {
      const closes = meanReverting(200, 100, 0.5);
      const result = trendStrength(closes);
      assert.ok(Math.abs(result.score) < 0.5, `Expected near-zero score, got ${result.score}`);
    });
  });

  describe('volatilityRegime', () => {
    it('detects high volatility', () => {
      // Start calm, then spike
      const n = 200;
      const closes = [];
      const highs = [];
      const lows = [];
      for (let i = 0; i < n; i++) {
        const base = 100;
        const vol = i > 150 ? 5 : 0.5;  // Spike vol at end
        closes.push(base + (Math.random() - 0.5) * vol);
        highs.push(closes[i] + Math.random() * vol);
        lows.push(closes[i] - Math.random() * vol);
      }
      const result = volatilityRegime(highs, lows, closes);
      assert.ok(result.percentile > 50, `Expected high percentile, got ${result.percentile}`);
    });

    it('returns valid state', () => {
      const closes = trendingUp(200);
      const { highs, lows } = makeOHLCV(closes);
      const result = volatilityRegime(highs, lows, closes);
      assert.ok(['high', 'elevated', 'normal', 'subdued', 'low'].includes(result.state));
      assert.ok(result.percentile >= 0 && result.percentile <= 100);
    });
  });

  describe('hurstExponent', () => {
    it('returns ~0.5 for random walk', () => {
      const series = [100];
      for (let i = 1; i < 300; i++) {
        series.push(series[i - 1] * (1 + (Math.random() - 0.5) * 0.01));
      }
      const h = hurstExponent(series);
      // Random walk should be near 0.5 (±0.2 tolerance for small sample)
      assert.ok(h > 0.2 && h < 0.8, `Expected ~0.5, got ${h}`);
    });

    it('returns > 0.5 for trending series', () => {
      const series = trendingUp(300, 100, 0.003);
      const h = hurstExponent(series);
      assert.ok(h > 0.3, `Expected > 0.3 for trend, got ${h}`);
    });

    it('returns value in valid range', () => {
      const series = meanReverting(300);
      const h = hurstExponent(series);
      assert.ok(h >= 0.01 && h <= 0.99, `Hurst out of range: ${h}`);
    });
  });

  describe('detectRegime', () => {
    it('returns valid regime for trending data', () => {
      const closes = trendingUp(200);
      const { highs, lows, volumes } = makeOHLCV(closes);
      const result = detectRegime(closes, highs, lows, volumes);
      assert.ok(['trending_up', 'trending_down', 'mean_reverting', 'high_volatility', 'low_volatility', 'unknown'].includes(result.regime));
      assert.ok(result.confidence >= 0 && result.confidence <= 1);
      assert.ok(result.metrics.trendScore !== undefined);
    });

    it('returns valid regime for mean-reverting data', () => {
      const closes = meanReverting(200);
      const { highs, lows, volumes } = makeOHLCV(closes);
      const result = detectRegime(closes, highs, lows, volumes);
      assert.ok(result.confidence > 0);
    });

    it('handles insufficient data', () => {
      const result = detectRegime([100, 101, 102], [101, 102, 103], [99, 100, 101], [1000, 1000, 1000]);
      assert.equal(result.regime, 'unknown');
      assert.equal(result.confidence, 0);
    });
  });

  describe('regimeSummary', () => {
    it('formats readable summary', () => {
      const closes = trendingUp(200);
      const { highs, lows, volumes } = makeOHLCV(closes);
      const result = detectRegime(closes, highs, lows, volumes);
      const summary = regimeSummary(result);
      assert.ok(summary.includes('Regime:'));
      assert.ok(summary.includes('Trend:'));
      assert.ok(summary.includes('Hurst:'));
    });
  });
});
