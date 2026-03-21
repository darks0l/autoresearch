/**
 * Experiment Memory Layer
 * Logs experiments to files for LCM (Lossless Context Management) to index.
 * Provides query interface for the agent to learn from past experiments.
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import CONFIG from './config.js';

const LOG_DIR = CONFIG.research.logDir;

/**
 * @typedef {Object} ExperimentRecord
 * @property {string} id - Experiment ID (exp001, exp002, ...)
 * @property {number} timestamp - Unix ms
 * @property {string} hypothesis - What was tried
 * @property {string} mutation - Description of strategy change
 * @property {string} diff - Code diff (before/after key lines)
 * @property {Object} result - Backtest result
 * @property {boolean} kept - Whether the change was kept
 * @property {string} [reason] - Why it was kept/reverted
 * @property {Object} [parameters] - Key parameter values at time of experiment
 */

/**
 * Initialize experiment log directory
 */
export async function initMemory() {
  await mkdir(LOG_DIR, { recursive: true });
  const indexPath = join(LOG_DIR, 'index.json');
  if (!existsSync(indexPath)) {
    await writeFile(indexPath, JSON.stringify({
      version: 1,
      created: Date.now(),
      bestScore: -Infinity,
      bestExperiment: null,
      totalExperiments: 0,
      experiments: [],
    }, null, 2));
  }
}

/**
 * Load the experiment index
 */
export async function loadIndex() {
  const indexPath = join(LOG_DIR, 'index.json');
  if (!existsSync(indexPath)) {
    await initMemory();
  }
  return JSON.parse(await readFile(indexPath, 'utf-8'));
}

/**
 * Get next experiment ID
 */
export async function nextExperimentId() {
  const index = await loadIndex();
  const num = (index.totalExperiments || 0) + 1;
  return `exp${String(num).padStart(3, '0')}`;
}

/**
 * Log an experiment
 */
export async function logExperiment(record) {
  const index = await loadIndex();

  // Update index
  index.totalExperiments = (index.totalExperiments || 0) + 1;
  index.experiments.push({
    id: record.id,
    timestamp: record.timestamp,
    score: record.result.score,
    sharpe: record.result.sharpe,
    kept: record.kept,
    hypothesis: record.hypothesis,
  });

  if (record.kept && record.result.score > (index.bestScore || -Infinity)) {
    index.bestScore = record.result.score;
    index.bestExperiment = record.id;
  }

  // Write index
  await writeFile(join(LOG_DIR, 'index.json'), JSON.stringify(index, null, 2));

  // Write full experiment record
  await writeFile(
    join(LOG_DIR, `${record.id}.json`),
    JSON.stringify(record, null, 2)
  );

  // Write human-readable log (LCM can index this)
  const logLine = [
    `[${new Date(record.timestamp).toISOString()}]`,
    record.kept ? '✓ KEPT' : '✗ REVERTED',
    `${record.id}: ${record.hypothesis}`,
    `→ score=${record.result.score} sharpe=${record.result.sharpe}`,
    `dd=${record.result.maxDrawdownPct}% trades=${record.result.numTrades}`,
    record.reason ? `(${record.reason})` : '',
  ].join(' ');

  const logPath = join(LOG_DIR, 'experiment-log.md');
  const existing = existsSync(logPath) ? await readFile(logPath, 'utf-8') : '# Experiment Log\n\n';
  await writeFile(logPath, existing + logLine + '\n');

  return record;
}

/**
 * Query experiment history — returns relevant experiments for LLM context
 * @param {Object} options
 * @param {string} [options.query] - Text query (e.g. "RSI period changes")
 * @param {boolean} [options.keptOnly] - Only return kept experiments
 * @param {number} [options.minScore] - Minimum score filter
 * @param {number} [options.limit] - Max results
 * @returns {ExperimentRecord[]}
 */
export async function queryExperiments(options = {}) {
  const { query, keptOnly = false, minScore, limit = 20 } = options;
  const index = await loadIndex();

  let experiments = index.experiments;

  if (keptOnly) {
    experiments = experiments.filter(e => e.kept);
  }

  if (minScore !== undefined) {
    experiments = experiments.filter(e => e.score >= minScore);
  }

  if (query) {
    const q = query.toLowerCase();
    experiments = experiments.filter(e =>
      e.hypothesis?.toLowerCase().includes(q)
    );
  }

  // Sort by score descending
  experiments.sort((a, b) => b.score - a.score);

  // Load full records for top results
  const results = [];
  for (const exp of experiments.slice(0, limit)) {
    const recordPath = join(LOG_DIR, `${exp.id}.json`);
    if (existsSync(recordPath)) {
      results.push(JSON.parse(await readFile(recordPath, 'utf-8')));
    } else {
      results.push(exp);
    }
  }

  return results;
}

/**
 * Get experiment summary for LLM context
 * Concise format suitable for injection into mutation prompts
 */
export async function getExperimentSummary() {
  const index = await loadIndex();
  if (index.totalExperiments === 0) {
    return 'No experiments run yet. Starting from baseline strategy.';
  }

  const kept = index.experiments.filter(e => e.kept);
  const reverted = index.experiments.filter(e => !e.kept);
  const topExperiments = [...index.experiments]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const recentReverted = reverted.slice(-5).map(e => `  - ${e.id}: ${e.hypothesis} (score: ${e.score})`);

  return [
    `## Experiment History (${index.totalExperiments} total, ${kept.length} kept, ${reverted.length} reverted)`,
    `Best score: ${index.bestScore} (${index.bestExperiment})`,
    '',
    '### Top Experiments:',
    ...topExperiments.map(e => `  - ${e.id}: ${e.hypothesis} → score=${e.score} ${e.kept ? '✓' : '✗'}`),
    '',
    '### Recent Failures (avoid repeating):',
    ...recentReverted,
  ].join('\n');
}

/**
 * Get pattern insights from experiment history
 * Analyzes what types of changes tend to improve vs hurt performance
 */
export async function getPatternInsights() {
  const experiments = await queryExperiments({ limit: 100 });
  if (experiments.length < 5) return 'Not enough experiments for pattern analysis.';

  const improvements = experiments.filter(e => e.kept && e.result?.score > 0);
  const failures = experiments.filter(e => !e.kept);

  const insights = [];

  // Parameter frequency in successful experiments
  const paramCounts = {};
  for (const exp of improvements) {
    if (exp.parameters) {
      for (const [key, value] of Object.entries(exp.parameters)) {
        paramCounts[key] = paramCounts[key] || {};
        paramCounts[key][value] = (paramCounts[key][value] || 0) + 1;
      }
    }
  }

  if (Object.keys(paramCounts).length > 0) {
    insights.push('### Successful Parameter Ranges:');
    for (const [param, values] of Object.entries(paramCounts)) {
      const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
      insights.push(`  - ${param}: most successful values = ${sorted.slice(0, 3).map(([v, c]) => `${v} (${c}x)`).join(', ')}`);
    }
  }

  // Common failure patterns
  const failHypotheses = failures.map(e => e.hypothesis || '').join(' ').toLowerCase();
  const failKeywords = {};
  for (const word of failHypotheses.split(/\s+/)) {
    if (word.length > 3) failKeywords[word] = (failKeywords[word] || 0) + 1;
  }

  const topFailWords = Object.entries(failKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  if (topFailWords.length > 0) {
    insights.push(`\n### Common Failure Themes: ${topFailWords.join(', ')}`);
  }

  return insights.join('\n') || 'Patterns emerging, need more data.';
}

export default {
  initMemory, loadIndex, nextExperimentId, logExperiment,
  queryExperiments, getExperimentSummary, getPatternInsights,
};
