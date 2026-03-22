import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Server module', () => {
  it('should export PRICES with correct endpoints', async () => {
    const { PRICES } = await import('../src/server.js');
    assert.ok(PRICES['/strategy/discover']);
    assert.ok(PRICES['/strategy/validate']);
    assert.ok(PRICES['/strategy/signal']);
    assert.equal(PRICES['/strategy/discover'].amount, '2000000');
    assert.equal(PRICES['/strategy/validate'].amount, '500000');
    assert.equal(PRICES['/strategy/signal'].amount, '100000');
  });

  it('should export correct RECEIVER_WALLET', async () => {
    const { RECEIVER_WALLET } = await import('../src/server.js');
    assert.equal(RECEIVER_WALLET, '0x3e6e304421993D7E95a77982E11C93610DD4fFC5');
  });

  it('should export server instance', async () => {
    const { server } = await import('../src/server.js');
    assert.ok(server);
    assert.equal(typeof server.listen, 'function');
  });

  it('should have correct pricing (2 USDC for discover)', async () => {
    const { PRICES } = await import('../src/server.js');
    const amount = parseInt(PRICES['/strategy/discover'].amount);
    assert.equal(amount / 1e6, 2.0); // 2 USDC
  });

  it('should have correct pricing (0.50 USDC for validate)', async () => {
    const { PRICES } = await import('../src/server.js');
    const amount = parseInt(PRICES['/strategy/validate'].amount);
    assert.equal(amount / 1e6, 0.5); // 0.50 USDC
  });

  it('should have correct pricing (0.10 USDC for signal)', async () => {
    const { PRICES } = await import('../src/server.js');
    const amount = parseInt(PRICES['/strategy/signal'].amount);
    assert.equal(amount / 1e6, 0.1); // 0.10 USDC
  });
});
