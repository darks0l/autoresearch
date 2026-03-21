#!/usr/bin/env node
/**
 * Run all benchmark strategies and display comparison table
 */

import { readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBacktest } from '../src/backtest.js';
import { loadAllPairs } from '../src/data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCHMARK_DIR = resolve(__dirname, '../strategies/benchmarks');
const STRATEGY_PATH = resolve(__dirname, '../strategies/strategy.js');

async function main() {
  console.log('Loading data...');
  const allPairs = await loadAllPairs('1h');

  const results = [];

  // Run current strategy
  console.log('\nRunning current strategy...');
  try {
    const { Strategy } = await import(`file://${STRATEGY_PATH}`);
    const strategy = new Strategy();
    const result = runBacktest(strategy, allPairs);
    results.push({ name: '→ CURRENT', ...result });
  } catch (e) {
    console.error(`Current strategy error: ${e.message}`);
  }

  // Run benchmarks
  const benchmarkFiles = readdirSync(BENCHMARK_DIR).filter(f => f.endsWith('.js'));
  for (const file of benchmarkFiles) {
    const name = file.replace('.js', '');
    console.log(`Running ${name}...`);
    try {
      const { Strategy } = await import(`file://${join(BENCHMARK_DIR, file)}`);
      const strategy = new Strategy();
      const result = runBacktest(strategy, allPairs);
      results.push({ name, ...result });
    } catch (e) {
      console.error(`${name} error: ${e.message}`);
    }
  }

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  // Display table
  console.log('\n╔══════════════════════╦═════════╦═════════╦══════════╦════════╦═══════════╗');
  console.log('║ Strategy             ║ Score   ║ Sharpe  ║ Return % ║ Max DD ║ Trades    ║');
  console.log('╠══════════════════════╬═════════╬═════════╬══════════╬════════╬═══════════╣');

  for (const r of results) {
    const name = r.name.padEnd(20).slice(0, 20);
    const score = String(r.score).padStart(7);
    const sharpe = String(r.sharpe).padStart(7);
    const ret = (r.totalReturnPct?.toFixed(1) || '0.0').padStart(8);
    const dd = (r.maxDrawdownPct?.toFixed(1) || '0.0').padStart(6);
    const trades = String(r.numTrades || 0).padStart(9);
    console.log(`║ ${name} ║ ${score} ║ ${sharpe} ║ ${ret} ║ ${dd} ║ ${trades} ║`);
  }

  console.log('╚══════════════════════╩═════════╩═════════╩══════════╩════════╩═══════════╝');
}

main().catch(console.error);
