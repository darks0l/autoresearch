// Pair Discovery Module — scan top Base DEX pools or manually add pairs
// Two modes: manual (user/agent adds pairs) and auto-discovery (scan by volume/TVL)

import { CONFIG } from './config.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CUSTOM_PAIRS_PATH = join(__dirname, '..', 'data', 'custom-pairs.json');

// Well-known Base tokens for name resolution
const KNOWN_TOKENS = {
  '0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18 },
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': { symbol: 'USDbC', decimals: 6 },
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': { symbol: 'cbETH', decimals: 18 },
  '0x940181a94a35a4569e4529a3cdfb74e38fd98631': { symbol: 'AERO', decimals: 18 },
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { symbol: 'DAI', decimals: 18 },
  '0x4ed4e862860bed51a9570b96d89af5e1b0efefed': { symbol: 'DEGEN', decimals: 18 },
  '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b': { symbol: 'VIRTUAL', decimals: 18 },
  '0x532f27101965dd16442e59d40670faf5ebb142e4': { symbol: 'BRETT', decimals: 18 },
  '0x3c281a39944a2319aa653d81cfd93ca10983d234': { symbol: 'MORPHO', decimals: 18 },
  '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4': { symbol: 'TOSHI', decimals: 18 },
  '0x9e1028f5f1d5ede59748ffcee5532509976840e0': { symbol: 'COMP', decimals: 18 },
};

/**
 * Load custom pairs from disk
 */
export function loadCustomPairs() {
  if (!existsSync(CUSTOM_PAIRS_PATH)) return [];
  try {
    return JSON.parse(readFileSync(CUSTOM_PAIRS_PATH, 'utf8'));
  } catch { return []; }
}

/**
 * Save custom pairs to disk
 */
function saveCustomPairs(pairs) {
  const dir = dirname(CUSTOM_PAIRS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CUSTOM_PAIRS_PATH, JSON.stringify(pairs, null, 2));
}

/**
 * Add a pair manually
 * @param {Object} pair - { name, token0, token1, dex, fee?, stable? }
 * @returns {Object} result with status
 */
export function addPair(pair) {
  if (!pair.name || !pair.token0 || !pair.token1) {
    return { success: false, error: 'name, token0, and token1 are required' };
  }

  // Normalize addresses
  pair.token0 = pair.token0.toLowerCase();
  pair.token1 = pair.token1.toLowerCase();
  pair.dex = pair.dex || 'uniswap';
  if (pair.dex === 'uniswap' && !pair.fee) pair.fee = 3000;

  const customs = loadCustomPairs();

  // Check for duplicates (same tokens + dex + fee)
  const exists = [...CONFIG.data.pairs, ...customs].find(p =>
    p.token0.toLowerCase() === pair.token0 &&
    p.token1.toLowerCase() === pair.token1 &&
    p.dex === pair.dex &&
    (p.fee || 0) === (pair.fee || 0)
  );

  if (exists) {
    return { success: false, error: `Pair ${pair.name} already exists` };
  }

  pair.addedAt = new Date().toISOString();
  pair.source = 'manual';
  customs.push(pair);
  saveCustomPairs(customs);

  return { success: true, pair, total: CONFIG.data.pairs.length + customs.length };
}

/**
 * Remove a custom pair by name
 */
export function removePair(name) {
  const customs = loadCustomPairs();
  const idx = customs.findIndex(p => p.name === name);
  if (idx === -1) return { success: false, error: `Custom pair ${name} not found` };
  customs.splice(idx, 1);
  saveCustomPairs(customs);
  return { success: true, removed: name };
}

/**
 * List all active pairs (built-in + custom)
 */
export function listPairs() {
  const customs = loadCustomPairs();
  const builtIn = CONFIG.data.pairs.map(p => ({ ...p, source: 'built-in' }));
  return [...builtIn, ...customs];
}

/**
 * Discover top pools from Uniswap V3 on Base via subgraph
 * @param {Object} opts - { minTvlUsd, minVolumeUsd24h, maxPools, dex }
 */
export async function discoverPools(opts = {}) {
  const {
    minTvlUsd = 100_000,
    minVolumeUsd24h = 50_000,
    maxPools = 20,
    dex = 'all',  // 'uniswap', 'aerodrome', 'all'
  } = opts;

  const results = [];

  // Uniswap V3 subgraph query
  if (dex === 'all' || dex === 'uniswap') {
    try {
      const query = `{
        pools(
          first: ${maxPools}
          orderBy: totalValueLockedUSD
          orderDirection: desc
          where: { totalValueLockedUSD_gt: "${minTvlUsd}" }
        ) {
          id
          token0 { id symbol decimals }
          token1 { id symbol decimals }
          feeTier
          totalValueLockedUSD
          volumeUSD
          txCount
        }
      }`;

      const resp = await fetch(CONFIG.data.uniswapSubgraph, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const pools = data?.data?.pools || [];
        for (const pool of pools) {
          results.push({
            name: `${pool.token0.symbol}/${pool.token1.symbol}`,
            token0: pool.token0.id,
            token1: pool.token1.id,
            dex: 'uniswap',
            fee: parseInt(pool.feeTier),
            tvlUsd: parseFloat(pool.totalValueLockedUSD),
            volumeUsd: parseFloat(pool.volumeUSD),
            txCount: parseInt(pool.txCount),
            poolAddress: pool.id,
            source: 'discovery',
          });
        }
      }
    } catch (e) {
      console.error('Uniswap subgraph discovery failed:', e.message);
    }
  }

  // Aerodrome via DeFiLlama (more reliable than subgraph)
  if (dex === 'all' || dex === 'aerodrome') {
    try {
      const resp = await fetch('https://api.llama.fi/protocol/aerodrome');
      if (resp.ok) {
        const data = await resp.json();
        // DeFiLlama gives TVL breakdown but not individual pools
        // Fall back to noting Aerodrome is available
        if (data.tvl && data.tvl.length > 0) {
          const latestTvl = data.tvl[data.tvl.length - 1];
          results.push({
            name: 'AERODROME_ECOSYSTEM',
            dex: 'aerodrome',
            tvlUsd: latestTvl.totalLiquidityUSD || 0,
            note: 'Aerodrome pool-level discovery requires on-chain scan. Use addPair() for specific Aerodrome pools.',
            source: 'discovery',
          });
        }
      }
    } catch (e) {
      console.error('Aerodrome discovery failed:', e.message);
    }
  }

  return results;
}

/**
 * Auto-discover and add top pools (opt-in feature)
 * Scans Uniswap V3 subgraph, filters by TVL/volume, adds missing pairs
 */
export async function autoDiscoverAndAdd(opts = {}) {
  const {
    minTvlUsd = 500_000,
    maxNewPairs = 5,
    excludeStables = false,
  } = opts;

  const STABLECOINS = new Set(['USDC', 'USDbC', 'DAI', 'USDT', 'crvUSD']);

  const pools = await discoverPools({ minTvlUsd, maxPools: 30 });
  const currentPairs = listPairs();
  const currentKeys = new Set(currentPairs.map(p =>
    `${p.token0.toLowerCase()}-${p.token1.toLowerCase()}-${p.dex}-${p.fee || 0}`
  ));

  const added = [];

  for (const pool of pools) {
    if (added.length >= maxNewPairs) break;
    if (!pool.token0 || !pool.token1) continue;

    // Skip stable-stable pairs if requested
    if (excludeStables) {
      const t0sym = pool.name.split('/')[0];
      const t1sym = pool.name.split('/')[1];
      if (STABLECOINS.has(t0sym) && STABLECOINS.has(t1sym)) continue;
    }

    const key = `${pool.token0.toLowerCase()}-${pool.token1.toLowerCase()}-${pool.dex}-${pool.fee || 0}`;
    if (currentKeys.has(key)) continue;

    const feeSuffix = pool.fee && pool.fee !== 3000 ? `-${pool.fee / 100}` : '';
    const pairName = `${pool.name}${feeSuffix}`;

    const result = addPair({
      name: pairName,
      token0: pool.token0,
      token1: pool.token1,
      dex: pool.dex,
      fee: pool.fee,
      tvlUsd: pool.tvlUsd,
      poolAddress: pool.poolAddress,
    });

    if (result.success) {
      added.push({ name: pairName, tvlUsd: pool.tvlUsd });
      currentKeys.add(key);
    }
  }

  return {
    scanned: pools.length,
    added: added.length,
    pairs: added,
    totalActive: listPairs().length,
  };
}

export default { addPair, removePair, listPairs, discoverPools, autoDiscoverAndAdd, loadCustomPairs };
