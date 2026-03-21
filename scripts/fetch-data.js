#!/usr/bin/env node
/**
 * Fetch and cache historical OHLCV data for all configured pairs
 */

import { loadAllPairs } from '../src/data.js';

console.log('Fetching historical data for all configured pairs...\n');

const pairs = await loadAllPairs('1h');

console.log(`\nDone. ${pairs.size} pairs loaded:`);
for (const [name, bars] of pairs) {
  const first = bars[0];
  const last = bars[bars.length - 1];
  console.log(`  ${name}: ${bars.length} bars (${new Date(first.timestamp * 1000).toISOString().slice(0, 10)} → ${new Date(last.timestamp * 1000).toISOString().slice(0, 10)})`);
}
