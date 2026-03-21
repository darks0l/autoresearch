#!/usr/bin/env node
/**
 * sync-results.js — Commit and push latest experiment results to GitHub
 * Run via cron or manually after daemon batches complete.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 30000 }).trim();
}

try {
  // Load experiment index
  const idxPath = resolve(ROOT, 'data/experiments/index.json');
  if (!existsSync(idxPath)) {
    console.log('No experiment index found.');
    process.exit(0);
  }
  const idx = JSON.parse(readFileSync(idxPath, 'utf-8'));
  const total = idx.experiments.length;
  const kept = idx.experiments.filter(e => e.kept).length;
  const best = idx.experiments.reduce((a, b) => (b.score || -Infinity) > (a.score || -Infinity) ? b : a, { score: -Infinity });

  // Update EXPERIMENT_INDEX.md
  let md = '# AutoResearch — Experiment Index\n\n';
  md += `> ${total} experiments, ${kept} kept, ${total - kept} rejected\n`;
  md += `> Best: ${best.score} (${best.id}) | Baseline: 0.421\n`;
  md += `> Last updated: ${new Date().toISOString()}\n\n`;
  md += '| # | Score | Status | Hypothesis |\n|---|-------|--------|------------|\n';
  idx.experiments.forEach(e => {
    const id = typeof e.id === 'number' ? 'exp' + String(e.id).padStart(3, '0') : e.id;
    const hyp = (e.hypothesis || '').slice(0, 80).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    md += `| ${id} | ${e.score ?? '?'} | ${e.kept ? '✅' : '❌'} | ${hyp} |\n`;
  });
  writeFileSync(resolve(ROOT, 'docs/EXPERIMENT_INDEX.md'), md);

  // Update README stats
  const readmePath = resolve(ROOT, 'README.md');
  let readme = readFileSync(readmePath, 'utf-8');
  // Update experiment count
  readme = readme.replace(/Experiments run \| \d+/g, `Experiments run | ${total}`);
  // Update best score improvement
  const improvement = (((best.score - 0.421) / 0.421) * 100).toFixed(1);
  readme = readme.replace(/Best score vs baseline \| \*\*\+[\d.]+%\*\*/g, `Best score vs baseline | **+${improvement}%**`);
  writeFileSync(readmePath, readme);

  // Git commit and push
  const status = run('git status --porcelain');
  if (!status) {
    console.log('No changes to commit.');
    process.exit(0);
  }

  run('git add docs/EXPERIMENT_INDEX.md README.md');
  const msg = `data: ${total} experiments, best ${best.score} (${best.id}), ${kept} kept`;
  run(`git commit -m "${msg}"`);
  run('git push origin master');
  console.log(`Pushed: ${msg}`);
  
  // Also push to gitlab if remote exists
  try { run('git push gitlab master'); } catch {}

} catch (err) {
  console.error('sync-results error:', err.message);
  process.exit(1);
}
