import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest } from '../src/backtest.js';

// Generate simple test data
function generateTestData(numBars = 200) {
  const bars = [];
  let price = 3000;
  for (let i = 0; i < numBars; i++) {
    const change = (Math.random() - 0.5) * 60;
    price = Math.max(2000, price + change);
    bars.push({
      timestamp: 1719792000 + i * 3600, // July 1 2024 + hourly
      open: price - Math.random() * 20,
      high: price + Math.random() * 30,
      low: price - Math.random() * 30,
      close: price,
      volume: 1_000_000 + Math.random() * 2_000_000,
    });
  }
  return bars;
}

describe('Backtest Engine', () => {
  const testData = new Map([
    ['ETH/USDC', generateTestData(500)],
    ['AERO/USDC', generateTestData(500)],
  ]);

  it('runs without errors on a simple strategy', () => {
    const strategy = {
      onBar: () => [], // No-op strategy
    };
    const result = runBacktest(strategy, testData);
    assert.ok(result);
    assert.equal(result.numTrades, 0);
    assert.equal(result.score, -999); // <10 trades → hard cutoff
  });

  it('handles a basic buy-and-hold strategy', () => {
    let bought = false;
    const strategy = {
      onBar: (barData, portfolio) => {
        if (!bought) {
          bought = true;
          return [{ pair: 'ETH/USDC', targetPosition: 10000 }];
        }
        return [];
      },
    };
    const result = runBacktest(strategy, testData);
    assert.ok(result);
    assert.ok(result.numTrades >= 1);
  });

  it('tracks equity correctly', () => {
    const strategy = { onBar: () => [] };
    const result = runBacktest(strategy, testData);
    assert.ok(result.equityCurve.length > 0);
    assert.equal(result.equityCurve[0], 100_000); // Initial capital
  });

  it('applies scoring formula', () => {
    // Strategy that generates many trades
    let barCount = 0;
    const strategy = {
      onBar: (barData, portfolio) => {
        barCount++;
        if (barCount % 10 === 0) {
          const pos = portfolio.positions['ETH/USDC'] || 0;
          return [{ pair: 'ETH/USDC', targetPosition: pos === 0 ? 5000 : 0 }];
        }
        return [];
      },
    };
    const result = runBacktest(strategy, testData);
    assert.ok(typeof result.score === 'number');
    assert.ok(typeof result.sharpe === 'number');
    assert.ok(result.maxDrawdownPct >= 0);
  });

  it('returns -999 for fewer than 10 trades', () => {
    const strategy = {
      onBar: (barData, portfolio) => {
        if (!portfolio.positions['ETH/USDC']) {
          return [{ pair: 'ETH/USDC', targetPosition: 10000 }];
        }
        return [];
      },
    };
    const result = runBacktest(strategy, testData);
    // Only 1 trade (open) → hard cutoff
    if (result.numTrades < 10) {
      assert.equal(result.score, -999);
    }
  });
});
