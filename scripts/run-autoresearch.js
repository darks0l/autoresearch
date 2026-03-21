#!/usr/bin/env node
/**
 * Launch autonomous research loop
 * Usage: node scripts/run-autoresearch.js [--max 50] [--target 10.0]
 */

import { runAutoresearch } from '../src/controller.js';
import { formatBatchReport } from '../src/reporter.js';

const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const targetIdx = args.indexOf('--target');

const maxExperiments = maxIdx >= 0 ? parseInt(args[maxIdx + 1]) : 50;
const scoreTarget = targetIdx >= 0 ? parseFloat(args[targetIdx + 1]) : undefined;

if (scoreTarget) {
  const { default: CONFIG } = await import('../src/config.js');
  CONFIG.research.scoreTarget = scoreTarget;
}

console.log(`AutoResearch starting — max ${maxExperiments} experiments`);

await runAutoresearch({
  maxExperiments,
  onExperiment: (record, count, max) => {
    // Log progress
    const pct = ((count / max) * 100).toFixed(0);
    process.stdout.write(`\r  Progress: ${count}/${max} (${pct}%) | Latest: ${record.id} (${record.kept ? 'kept' : 'reverted'})`);
  },
  onBatch: (results, batchNum, index) => {
    console.log('\n' + formatBatchReport(results, batchNum, index));
  },
});
