#!/usr/bin/env node

/**
 * AutoResearch Daemon
 * Runs continuous experiment batches with configurable models.
 * Designed to be triggered by cron or run as a persistent process.
 * 
 * Usage:
 *   node scripts/daemon.js [--batch 10] [--model claude-sonnet-4.5] [--target 2.0]
 */

import { runAutoresearch } from '../src/controller.js';
import { getLLMCredits } from '../src/bankr.js';
import CONFIG from '../src/config.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STATE_FILE = join(ROOT, 'data', 'daemon-state.json');

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const BATCH_SIZE = parseInt(getArg('batch', '10'));
const MODEL = getArg('model', 'claude-sonnet-4.5');
const SCORE_TARGET = parseFloat(getArg('target', '2.0'));
const MIN_CREDITS = parseFloat(getArg('min-credits', '0.50'));

// Load or init daemon state
function loadState() {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  }
  return {
    totalRuns: 0,
    totalExperiments: 0,
    totalKept: 0,
    bestScore: 0,
    bestExperiment: null,
    startedAt: new Date().toISOString(),
    lastRunAt: null,
    history: []
  };
}

function saveState(state) {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  console.log(`\n🌑 AutoResearch Daemon`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Batch: ${BATCH_SIZE} experiments`);
  console.log(`   Target: ${SCORE_TARGET}`);
  console.log(`   Min credits: $${MIN_CREDITS}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);

  // Check credits
  const credits = await getLLMCredits();
  console.log(`   Credits: $${credits.credits || 'unknown'}`);
  
  if (credits.available && typeof credits.credits === 'number' && credits.credits < MIN_CREDITS) {
    console.log(`\n⚠️  Credits below $${MIN_CREDITS} threshold. Skipping run.`);
    process.exit(0);
  }
  
  if (!credits.available) {
    console.log(`   Credit check unavailable — proceeding anyway`);
  }

  // Override config for this run
  CONFIG.bankr.useBankrLLM = true;
  CONFIG.research.mutationModel = MODEL;
  CONFIG.research.maxExperiments = BATCH_SIZE;
  CONFIG.research.scoreTarget = SCORE_TARGET;

  const state = loadState();
  state.totalRuns++;
  state.lastRunAt = new Date().toISOString();

  let batchKept = 0;
  let batchBest = 0;
  let batchExperiments = 0;

  try {
    await runAutoresearch({
      onExperiment: (exp) => {
        batchExperiments++;
        state.totalExperiments++;
        if (exp.kept) {
          batchKept++;
          state.totalKept++;
        }
        const score = exp.score ?? exp.result?.score ?? 0;
        if (score > batchBest) batchBest = score;
        if (score > state.bestScore) {
          state.bestScore = score;
          state.bestExperiment = exp.id;
        }
      },
      onBatch: (results, batchNum, index) => {
        console.log(`\n   Batch ${batchNum} complete. Kept: ${results.filter(r => r.kept).length}/${results.length}`);
      }
    });
  } catch (err) {
    console.error(`\n❌ Run error: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }

  // Log this run
  state.history.push({
    run: state.totalRuns,
    at: state.lastRunAt,
    model: MODEL,
    experiments: batchExperiments,
    kept: batchKept,
    bestScore: batchBest,
    hitRate: batchExperiments > 0 ? ((batchKept / batchExperiments) * 100).toFixed(1) + '%' : '0%'
  });

  // Keep only last 50 runs in history
  if (state.history.length > 50) {
    state.history = state.history.slice(-50);
  }

  saveState(state);

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  DAEMON RUN #${state.totalRuns} COMPLETE`);
  console.log(`  This batch: ${batchExperiments} experiments, ${batchKept} kept (${batchExperiments > 0 ? ((batchKept / batchExperiments) * 100).toFixed(1) : 0}%)`);
  console.log(`  Best this run: ${batchBest.toFixed(3)}`);
  console.log(`  All-time best: ${state.bestScore.toFixed(3)} (${state.bestExperiment})`);
  console.log(`  Total: ${state.totalExperiments} experiments across ${state.totalRuns} runs`);
  console.log(`═══════════════════════════════════════════\n`);

  // Auto-sync results to GitHub
  try {
    const { execSync } = await import('child_process');
    console.log('📤 Syncing results to GitHub...');
    execSync('node scripts/sync-results.js', { cwd: process.cwd(), encoding: 'utf-8', timeout: 60000 });
    console.log('✅ Results synced to GitHub');
  } catch (syncErr) {
    console.error('⚠️  GitHub sync failed:', syncErr.message);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
