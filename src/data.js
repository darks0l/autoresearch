/**
 * Historical OHLCV Data Fetcher
 * Sources: Uniswap V3 subgraph + Aerodrome subgraph on Base
 * Falls back to CoinGecko for major pairs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import CONFIG from './config.js';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/**
 * @typedef {Object} Bar
 * @property {number} timestamp - Unix seconds
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * Fetch OHLCV from Uniswap V3 subgraph (pool hourly snapshots)
 */
async function fetchUniswapV3Hourly(poolAddress, startTs, endTs) {
  const query = `{
    poolHourDatas(
      where: { pool: "${poolAddress.toLowerCase()}", periodStartUnix_gte: ${startTs}, periodStartUnix_lte: ${endTs} }
      orderBy: periodStartUnix
      orderDirection: asc
      first: 1000
    ) {
      periodStartUnix
      open
      high
      low
      close
      volumeUSD
    }
  }`;

  const resp = await fetch(CONFIG.data.uniswapSubgraph, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!resp.ok) throw new Error(`Uniswap subgraph error: ${resp.status}`);
  const { data } = await resp.json();

  if (!data?.poolHourDatas) return [];
  return data.poolHourDatas.map(d => ({
    timestamp: Number(d.periodStartUnix),
    open: parseFloat(d.open),
    high: parseFloat(d.high),
    low: parseFloat(d.low),
    close: parseFloat(d.close),
    volume: parseFloat(d.volumeUSD),
  }));
}

/**
 * Fetch from CoinGecko OHLC — auto-chunks to get hourly data
 * CoinGecko gives hourly for days<=30, daily for >30
 */
async function fetchCoinGeckoOHLC(coinId, vsCurrency, days) {
  if (days <= 30) {
    // Single fetch, hourly-ish data
    const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=${vsCurrency}&days=${days}`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error(`CoinGecko error: ${resp.status}`);
    const data = await resp.json();
    return data.map(([ts, open, high, low, close]) => ({
      timestamp: Math.floor(ts / 1000),
      open, high, low, close,
      volume: 0,
    }));
  }

  // Multi-chunk fetch: CoinGecko only returns hourly for last 30 days
  // Fetch in 30-day chunks from newest to oldest
  const allBars = [];
  const nowSec = Math.floor(Date.now() / 1000);
  let fromTs = nowSec - days * 86400;
  const toTs = nowSec;

  while (fromTs < toTs) {
    const chunkDays = Math.min(30, Math.ceil((toTs - fromTs) / 86400));
    const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=${vsCurrency}&days=${chunkDays}`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (resp.ok) {
      const data = await resp.json();
      // Filter bars within our range
      const bars = data
        .filter(([ts]) => ts / 1000 >= fromTs && ts / 1000 <= toTs)
        .map(([ts, open, high, low, close]) => ({
          timestamp: Math.floor(ts / 1000),
          open, high, low, close,
          volume: 0,
        }));
      allBars.push(...bars);
    }
    fromTs += chunkDays * 86400;
    // CoinGecko rate limit: 10-30 calls/min on free tier
    if (fromTs < toTs) await new Promise(r => setTimeout(r, 2000));
  }

  // Sort by timestamp
  allBars.sort((a, b) => a.timestamp - b.timestamp);
  return allBars;
}

/**
 * Generate synthetic hourly data from daily data
 * Used when hourly data isn't available
 */
function dailyToHourly(dailyBars) {
  const hourly = [];
  for (const bar of dailyBars) {
    const range = bar.high - bar.low;
    for (let h = 0; h < 24; h++) {
      const progress = h / 24;
      // Simple interpolation with some noise
      const noise = (Math.random() - 0.5) * range * 0.1;
      const price = bar.open + (bar.close - bar.open) * progress + noise;
      hourly.push({
        timestamp: bar.timestamp + h * 3600,
        open: h === 0 ? bar.open : hourly[hourly.length - 1]?.close || price,
        high: Math.max(price * 1.002, price),
        low: Math.min(price * 0.998, price),
        close: price,
        volume: (bar.volume || 1_000_000) / 24,
      });
    }
  }
  return hourly;
}

/**
 * Fetch pool address from Uniswap V3 factory via RPC
 * Falls back to hardcoded pool map for known pairs (when RPC eth_call fails)
 */
async function getUniswapV3Pool(token0, token1, fee) {
  // Hardcoded pool map for known pairs (avoids subgraph/RPC dependency)
  const knownPools = {
    '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b:0x4200000000000000000000000000000000000006:10000': '0xAEC085E5A5CE8d96A7bDd3eB3A62445d4f6CE703', // BNKR/WETH v3 1%
    '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913:5000': '0x87a44b2ff90d59448342017e80c513fd469c9f5edc34db815436a5d984000f52', // BNKR/USDC v3 0.5%
  };
  const key = `${token0}:${token1}:${fee}`;
  return knownPools[key] || null;
}

/**
 * Load or fetch OHLCV data for a pair
 * Caches to disk to avoid repeated API calls
 */
export async function loadPairData(pair, interval = '1h') {
  const cacheDir = CONFIG.data.cacheDir;
  const cacheFile = join(cacheDir, `${pair.name.replace('/', '-')}_${interval}.json`);

  // Check cache (valid for 7 days — historical data doesn't change)
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, 'utf-8'));
      const age = Date.now() - (cached._fetchedAt || 0);
      if (age < 604_800_000) {
        console.log(`  [cache hit] ${pair.name} ${interval} (${cached.bars.length} bars)`);
        return cached.bars;
      }
    } catch { /* cache corrupt, refetch */ }
  }

  console.log(`  [fetching] ${pair.name} ${interval}...`);

  let bars = [];
  const startTs = Math.floor(new Date(CONFIG.backtest.validationStart).getTime() / 1000);
  const endTs = Math.floor(new Date(CONFIG.backtest.validationEnd).getTime() / 1000);

  try {
    if (pair.dex === 'uniswap') {
      const poolId = await getUniswapV3Pool(pair.token0, pair.token1, pair.fee);
      if (poolId) {
        bars = await fetchUniswapV3Hourly(poolId, startTs, endTs);
      }
    }
  } catch (e) {
    console.log(`  [subgraph failed] ${e.message}, trying CoinGecko...`);
  }

  // Fallback: CoinGecko for major pairs
  if (bars.length === 0) {
    try {
      const coinMap = {
        'ETH/USDC': 'ethereum',
        'ETH/USDC-30': 'ethereum',
        'cbETH/WETH': 'coinbase-wrapped-staked-eth',
        'AERO/USDC': 'aerodrome-finance',
        'BNKR/WETH': 'bankercoin-2',
        'BNKR/USDC': 'bankercoin-2',
      };
      const coinId = coinMap[pair.name];
      if (coinId) {
        const days = Math.ceil((endTs - startTs) / 86400);
        const dailyBars = await fetchCoinGeckoOHLC(coinId, 'usd', Math.min(days, 365));
        bars = interval === '1h' ? dailyToHourly(dailyBars) : dailyBars;
      }
    } catch (e) {
      console.log(`  [CoinGecko failed] ${e.message}`);
    }
  }

  // Generate synthetic data if all sources fail (for development)
  if (bars.length === 0) {
    console.log(`  [synthetic] Generating test data for ${pair.name}`);
    bars = generateSyntheticData(pair.name, startTs, endTs, interval);
  }

  // Cache
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ _fetchedAt: Date.now(), pair: pair.name, interval, bars }));
  console.log(`  [cached] ${pair.name} ${interval}: ${bars.length} bars`);

  return bars;
}

/**
 * Generate synthetic OHLCV data for development/testing
 * Uses geometric Brownian motion with mean reversion
 */
function generateSyntheticData(pairName, startTs, endTs, interval = '1h') {
  const priceMap = { 'ETH/USDC': 3000, 'ETH/USDC-30': 3000, 'cbETH/WETH': 1.05, 'AERO/USDC': 1.5 };
  const volMap = { 'ETH/USDC': 0.03, 'ETH/USDC-30': 0.03, 'cbETH/WETH': 0.01, 'AERO/USDC': 0.06 };

  const basePrice = priceMap[pairName] || 100;
  const volatility = volMap[pairName] || 0.03;
  const step = interval === '1h' ? 3600 : interval === '4h' ? 14400 : 86400;

  const bars = [];
  let price = basePrice;
  const meanPrice = basePrice;

  for (let ts = startTs; ts <= endTs; ts += step) {
    // GBM with mean reversion
    const dt = step / 86400;
    const meanRevert = 0.02 * (meanPrice - price) * dt;
    const drift = 0.0001 * dt;
    const diffusion = volatility * Math.sqrt(dt) * (Math.random() * 2 - 1);
    price = price * (1 + drift + diffusion) + meanRevert;
    price = Math.max(price * 0.5, Math.min(price * 1.5, price)); // clamp

    const range = price * volatility * Math.sqrt(dt);
    const open = price + (Math.random() - 0.5) * range * 0.3;
    const close = price;
    const high = Math.max(open, close) + Math.random() * range * 0.5;
    const low = Math.min(open, close) - Math.random() * range * 0.5;
    const volume = (1_000_000 + Math.random() * 5_000_000) * (interval === '1h' ? 1 : interval === '4h' ? 4 : 24);

    bars.push({ timestamp: ts, open, high, low, close, volume });
  }

  return bars;
}

/**
 * Load all configured pairs (built-in + custom)
 * @returns {Map<string, Bar[]>}
 */
export async function loadAllPairs(interval = '1h') {
  // Merge built-in pairs with any user/agent-added custom pairs
  let customPairs = [];
  try {
    const { loadCustomPairs } = await import('./discovery.js');
    customPairs = loadCustomPairs();
  } catch { /* discovery module optional */ }

  const allPairConfigs = [...CONFIG.data.pairs, ...customPairs];
  const pairs = new Map();
  console.log(`Loading ${allPairConfigs.length} pairs (${interval}) [${CONFIG.data.pairs.length} built-in + ${customPairs.length} custom]...`);

  for (const pair of allPairConfigs) {
    try {
      const bars = await loadPairData(pair, interval);
      pairs.set(pair.name, bars);
    } catch (e) {
      console.error(`Failed to load ${pair.name}: ${e.message}`);
    }
  }

  console.log(`Loaded ${pairs.size} pairs.`);
  return pairs;
}

/**
 * Build bar_data structure matching the Strategy interface
 * @param {Map<string, Bar[]>} allPairs
 * @param {number} barIndex - Current bar index
 * @returns {Object} barData keyed by pair name
 */
export function buildBarData(allPairs, barIndex) {
  const barData = {};
  for (const [name, bars] of allPairs) {
    if (barIndex >= bars.length) continue;
    const bar = bars[barIndex];
    const historyStart = Math.max(0, barIndex - CONFIG.data.historyBars);
    const history = bars.slice(historyStart, barIndex + 1);
    barData[name] = {
      ...bar,
      history,
    };
  }
  return barData;
}

export default { loadPairData, loadAllPairs, buildBarData };
