#!/usr/bin/env node
/**
 * Pair Management CLI
 * 
 * Usage:
 *   node scripts/pairs.js list                              — show all active pairs
 *   node scripts/pairs.js add "DEGEN/WETH" 0x4ed4... 0x4200... uniswap 3000
 *   node scripts/pairs.js remove "DEGEN/WETH"               — remove a custom pair
 *   node scripts/pairs.js discover                           — scan top Base DEX pools
 *   node scripts/pairs.js auto                               — auto-discover and add top pools
 *   node scripts/pairs.js auto --max 3 --min-tvl 1000000     — with filters
 */

import { addPair, removePair, listPairs, discoverPools, autoDiscoverAndAdd } from '../src/discovery.js';

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'list': {
    const pairs = listPairs();
    console.log(`\n📊 Active Trading Pairs (${pairs.length})\n`);
    for (const p of pairs) {
      const src = p.source === 'built-in' ? '🔒' : '➕';
      const fee = p.fee ? ` (${p.fee / 10000}%)` : '';
      const tvl = p.tvlUsd ? ` | TVL: $${(p.tvlUsd / 1e6).toFixed(1)}M` : '';
      console.log(`  ${src} ${p.name} — ${p.dex}${fee}${tvl}`);
    }
    console.log(`\n  🔒 = built-in  ➕ = custom\n`);
    break;
  }

  case 'add': {
    const [name, token0, token1, dex, fee] = args;
    if (!name || !token0 || !token1) {
      console.log('Usage: node scripts/pairs.js add "NAME" TOKEN0_ADDR TOKEN1_ADDR [dex] [fee]');
      console.log('Example: node scripts/pairs.js add "DEGEN/WETH" 0x4ed4e862860bed51a9570b96d89af5e1b0efefed 0x4200000000000000000000000000000000000006 uniswap 3000');
      process.exit(1);
    }
    const result = addPair({ name, token0, token1, dex: dex || 'uniswap', fee: fee ? parseInt(fee) : 3000 });
    if (result.success) {
      console.log(`✅ Added ${name} — total active pairs: ${result.total}`);
    } else {
      console.log(`❌ ${result.error}`);
    }
    break;
  }

  case 'remove': {
    const [name] = args;
    if (!name) {
      console.log('Usage: node scripts/pairs.js remove "PAIR_NAME"');
      process.exit(1);
    }
    const result = removePair(name);
    if (result.success) {
      console.log(`✅ Removed ${name}`);
    } else {
      console.log(`❌ ${result.error}`);
    }
    break;
  }

  case 'discover': {
    console.log('🔍 Scanning top Base DEX pools...\n');
    const pools = await discoverPools({ maxPools: 20, minTvlUsd: 100_000 });
    if (pools.length === 0) {
      console.log('No pools found (subgraph may be rate-limited). Try again in a minute.');
      break;
    }
    for (const p of pools) {
      if (p.note) {
        console.log(`  ℹ️  ${p.dex}: ${p.note}`);
        continue;
      }
      const tvl = p.tvlUsd ? `TVL: $${(p.tvlUsd / 1e6).toFixed(1)}M` : '';
      const vol = p.volumeUsd ? `Vol: $${(p.volumeUsd / 1e6).toFixed(1)}M` : '';
      console.log(`  ${p.name} — ${p.dex} (${p.fee / 10000}%) | ${tvl} | ${vol}`);
    }
    console.log(`\n  Found ${pools.length} pools. Use 'auto' to add top ones automatically.`);
    break;
  }

  case 'auto': {
    const maxIdx = args.indexOf('--max');
    const tvlIdx = args.indexOf('--min-tvl');
    const maxNew = maxIdx >= 0 ? parseInt(args[maxIdx + 1]) : 5;
    const minTvl = tvlIdx >= 0 ? parseInt(args[tvlIdx + 1]) : 500_000;

    console.log(`🤖 Auto-discovering top pools (min TVL: $${(minTvl / 1e6).toFixed(1)}M, max new: ${maxNew})...\n`);
    const result = await autoDiscoverAndAdd({ minTvlUsd: minTvl, maxNewPairs: maxNew });
    console.log(`  Scanned: ${result.scanned} pools`);
    console.log(`  Added: ${result.added} new pairs`);
    for (const p of result.pairs) {
      console.log(`    ➕ ${p.name} (TVL: $${(p.tvlUsd / 1e6).toFixed(1)}M)`);
    }
    console.log(`  Total active: ${result.totalActive} pairs`);
    break;
  }

  default:
    console.log(`
📊 Pair Management — AutoResearch

Commands:
  list                              Show all active pairs (built-in + custom)
  add NAME TOKEN0 TOKEN1 [DEX] [FEE]  Add a custom pair
  remove NAME                       Remove a custom pair
  discover                          Scan top Base DEX pools by TVL
  auto [--max N] [--min-tvl N]      Auto-discover and add top pools

Examples:
  node scripts/pairs.js list
  node scripts/pairs.js add "DEGEN/WETH" 0x4ed4e862... 0x4200... uniswap 3000
  node scripts/pairs.js discover
  node scripts/pairs.js auto --max 3 --min-tvl 1000000
`);
}
