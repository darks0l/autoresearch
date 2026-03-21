#!/usr/bin/env node
/**
 * Run the full autoresearch loop with Bankr LLM Gateway
 * Usage: node scripts/run-autoresearch.js [--max N]
 */

import { runAutoresearch } from '../src/controller.js';
import { formatBatchReport, formatFinalReport } from '../src/reporter.js';

const maxArg = process.argv.find((a, i) => process.argv[i - 1] === '--max');
const maxExperiments = maxArg ? parseInt(maxArg) : 30;

console.log(`AutoResearch starting — ${maxExperiments} experiments`);
console.log(`Bankr LLM: ${process.env.BANKR_API_KEY ? 'configured ✓' : 'NOT SET ✗'}`);
console.log(`Model: claude-sonnet-4-6 via llm.bankr.bot\n`);

try {
  const result = await runAutoresearch({
    maxExperiments,
    onExperiment: (record, current, total) => {
      const pct = ((current / total) * 100).toFixed(0);
      console.log(`  [${pct}%] ${current}/${total} — ${record.kept ? '✓' : '✗'} ${record.id}`);
    },
    onBatch: (batchResults, batchNum, index) => {
      console.log(`\n--- Batch ${batchNum} Report ---`);
      console.log(formatBatchReport(batchResults, batchNum, index));
    },
  });

  console.log('\n' + formatFinalReport(result));
} catch (e) {
  console.error(`Fatal error: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
}
