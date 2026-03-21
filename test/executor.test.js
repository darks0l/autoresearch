import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { executeSignals, getExecutionState, resetExecutionState } from '../src/executor.js';

describe('Execution Engine', () => {
  beforeEach(() => {
    resetExecutionState();
  });

  describe('executeSignals', () => {
    it('executes paper buy signal', async () => {
      const signals = [{ pair: 'ETH/USDC', targetPosition: 10000 }];
      const market = { 'ETH/USDC': { close: 2000 } };
      const results = await executeSignals(signals, market, { liveMode: false });
      assert.equal(results.length, 1);
      assert.equal(results[0].success, true);
      assert.equal(results[0].mode, 'paper');
      assert.equal(results[0].action, 'buy');
    });

    it('executes paper close signal', async () => {
      // First buy
      await executeSignals([{ pair: 'ETH/USDC', targetPosition: 500 }], { 'ETH/USDC': { close: 2000 } }, { liveMode: false, perTradeLimitUsd: 1000 });
      // Then close
      const results = await executeSignals([{ pair: 'ETH/USDC', targetPosition: 0 }], { 'ETH/USDC': { close: 2100 } }, { liveMode: false, perTradeLimitUsd: 1000 });
      assert.equal(results[0].action, 'close');
    });

    it('executes close signal', async () => {
      await executeSignals([{ pair: 'ETH/USDC', targetPosition: 10000 }], { 'ETH/USDC': { close: 2000 } }, { liveMode: false });
      const results = await executeSignals([{ pair: 'ETH/USDC', targetPosition: 0 }], { 'ETH/USDC': { close: 2050 } }, { liveMode: false });
      assert.equal(results[0].action, 'close');
    });

    it('rejects disallowed pairs', async () => {
      const results = await executeSignals(
        [{ pair: 'DOGE/USDC', targetPosition: 1000 }],
        {},
        { liveMode: false, allowedPairs: ['ETH/USDC'] }
      );
      assert.equal(results[0].success, false);
      assert.equal(results[0].mode, 'rejected');
    });

    it('skips tiny trades', async () => {
      const results = await executeSignals(
        [{ pair: 'ETH/USDC', targetPosition: 5 }],
        { 'ETH/USDC': { close: 2000 } },
        { liveMode: false, minTradeUsd: 10 }
      );
      assert.equal(results[0].action, 'skip');
    });

    it('clamps oversized trades', async () => {
      const results = await executeSignals(
        [{ pair: 'ETH/USDC', targetPosition: 10000 }],
        { 'ETH/USDC': { close: 2000 } },
        { liveMode: false, perTradeLimitUsd: 500 }
      );
      assert.equal(results[0].success, true);
    });
  });

  describe('execution state', () => {
    it('tracks positions', async () => {
      await executeSignals([{ pair: 'ETH/USDC', targetPosition: 10000 }], { 'ETH/USDC': { close: 2000 } }, { liveMode: false });
      const state = getExecutionState();
      assert.ok(state.positions['ETH/USDC']);
      assert.equal(state.positions['ETH/USDC'].side, 'long');
    });

    it('tracks trade count', async () => {
      await executeSignals([{ pair: 'ETH/USDC', targetPosition: 10000 }], { 'ETH/USDC': { close: 2000 } }, { liveMode: false });
      await executeSignals([{ pair: 'ETH/USDC', targetPosition: 0 }], { 'ETH/USDC': { close: 2050 } }, { liveMode: false });
      const state = getExecutionState();
      assert.equal(state.tradeCount, 2);
    });

    it('resets properly', async () => {
      await executeSignals([{ pair: 'ETH/USDC', targetPosition: 10000 }], { 'ETH/USDC': { close: 2000 } }, { liveMode: false });
      resetExecutionState();
      const state = getExecutionState();
      assert.equal(state.tradeCount, 0);
      assert.deepEqual(state.positions, {});
    });
  });
});
