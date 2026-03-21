import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { addPair, removePair, listPairs, loadCustomPairs } from '../src/discovery.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CUSTOM_PAIRS_PATH = join(__dirname, '..', 'data', 'custom-pairs.json');

describe('Pair Discovery', () => {
  let backup = null;

  before(() => {
    // Backup existing custom pairs
    if (existsSync(CUSTOM_PAIRS_PATH)) {
      backup = JSON.parse(readFileSync(CUSTOM_PAIRS_PATH, 'utf8'));
    }
    // Start clean
    const dir = dirname(CUSTOM_PAIRS_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CUSTOM_PAIRS_PATH, '[]');
  });

  after(() => {
    // Restore backup
    if (backup) {
      writeFileSync(CUSTOM_PAIRS_PATH, JSON.stringify(backup, null, 2));
    } else if (existsSync(CUSTOM_PAIRS_PATH)) {
      writeFileSync(CUSTOM_PAIRS_PATH, '[]');
    }
  });

  it('should list built-in pairs', () => {
    const pairs = listPairs();
    assert.ok(pairs.length >= 4, 'Should have at least 4 built-in pairs');
    assert.ok(pairs.some(p => p.name === 'ETH/USDC'), 'Should include ETH/USDC');
  });

  it('should add a custom pair', () => {
    const result = addPair({
      name: 'TEST/WETH',
      token0: '0x1234567890abcdef1234567890abcdef12345678',
      token1: '0x4200000000000000000000000000000000000006',
      dex: 'uniswap',
      fee: 3000,
    });
    assert.ok(result.success, 'Should succeed');
    assert.equal(result.total, 5, 'Should have 5 total pairs');
  });

  it('should reject duplicate pairs', () => {
    const result = addPair({
      name: 'TEST/WETH-DUP',
      token0: '0x1234567890abcdef1234567890abcdef12345678',
      token1: '0x4200000000000000000000000000000000000006',
      dex: 'uniswap',
      fee: 3000,
    });
    assert.ok(!result.success, 'Should fail on duplicate');
  });

  it('should require name, token0, token1', () => {
    const result = addPair({ name: 'NOPE' });
    assert.ok(!result.success, 'Should fail without tokens');
  });

  it('should remove custom pairs', () => {
    const result = removePair('TEST/WETH');
    assert.ok(result.success, 'Should succeed');
    const pairs = loadCustomPairs();
    assert.equal(pairs.length, 0, 'Should be empty after removal');
  });

  it('should fail to remove non-existent pair', () => {
    const result = removePair('DOES_NOT_EXIST');
    assert.ok(!result.success, 'Should fail');
  });

  it('should persist custom pairs to disk', () => {
    addPair({
      name: 'PERSIST/TEST',
      token0: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      token1: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    // Re-load from disk
    const loaded = loadCustomPairs();
    assert.ok(loaded.some(p => p.name === 'PERSIST/TEST'), 'Should persist');
    // Cleanup
    removePair('PERSIST/TEST');
  });
});
