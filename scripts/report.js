#!/usr/bin/env node
/**
 * AutoResearch Report Generator
 * 
 * Generates comprehensive human-readable reports from experiment history.
 * Output: Markdown + optional HTML (viewable in browser).
 * 
 * Usage:
 *   node scripts/report.js                     — full report to stdout
 *   node scripts/report.js --out report.md      — save markdown
 *   node scripts/report.js --html report.html   — save styled HTML
 *   node scripts/report.js --pair ETH/USDC      — filter by pair
 *   node scripts/report.js --top 10             — show top N experiments
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadIndex, queryExperiments } from '../src/memory.js';
import { listPairs } from '../src/discovery.js';
import { CONFIG } from '../src/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const OUT_MD = getArg('out', null);
const OUT_HTML = getArg('html', null);
const TOP_N = parseInt(getArg('top', '10'));
const FILTER_PAIR = getArg('pair', null);

// ─── Report Sections ────────────────────────────────────────────────

async function buildReport() {
  const index = await loadIndex();
  const allExps = index.experiments || [];
  const kept = allExps.filter(e => e.kept);
  const reverted = allExps.filter(e => !e.kept);
  const pairs = listPairs();

  // Load full records for kept experiments
  const keptFull = [];
  for (const exp of kept) {
    const path = resolve(ROOT, `data/experiments/${exp.id}.json`);
    if (existsSync(path)) {
      keptFull.push(JSON.parse(readFileSync(path, 'utf8')));
    } else {
      keptFull.push(exp);
    }
  }

  // Load current strategy for parameter extraction
  let strategySource = '';
  const stratPath = resolve(ROOT, 'strategies/strategy.js');
  if (existsSync(stratPath)) {
    strategySource = readFileSync(stratPath, 'utf8');
  }

  const sections = [];

  // ── Header ──
  sections.push(`# 📊 AutoResearch — Strategy Report`);
  sections.push(`> Generated: ${new Date().toISOString()}`);
  sections.push(`> Engine: @darksol/autoresearch | Pairs: ${pairs.length} | Model: ${CONFIG.research.mutationModel}`);
  sections.push('');

  // ── Summary Card ──
  sections.push('## Summary');
  sections.push('');
  const best = allExps.reduce((a, b) => (b.score || -Infinity) > (a.score || -Infinity) ? b : a, { score: -Infinity });
  const bestFull = existsSync(resolve(ROOT, `data/experiments/${best.id}.json`))
    ? JSON.parse(readFileSync(resolve(ROOT, `data/experiments/${best.id}.json`), 'utf8'))
    : best;

  sections.push('| Metric | Value |');
  sections.push('|--------|-------|');
  sections.push(`| Total experiments | **${allExps.length}** |`);
  sections.push(`| Kept / Reverted | ${kept.length} ✅ / ${reverted.length} ❌ |`);
  sections.push(`| Hit rate | ${allExps.length > 0 ? ((kept.length / allExps.length) * 100).toFixed(1) : 0}% |`);
  sections.push(`| Best score | **${index.bestScore?.toFixed(3) || 'N/A'}** (${index.bestExperiment || 'N/A'}) |`);
  sections.push(`| Best Sharpe | ${bestFull.result?.sharpe?.toFixed(3) || bestFull.sharpe?.toFixed(3) || 'N/A'} |`);
  sections.push(`| Total return | ${bestFull.result?.totalReturnPct?.toFixed(2) || 'N/A'}% |`);
  sections.push(`| Max drawdown | ${bestFull.result?.maxDrawdownPct?.toFixed(2) || 'N/A'}% |`);
  sections.push(`| Trades | ${bestFull.result?.numTrades || 'N/A'} |`);
  sections.push(`| Win rate | ${bestFull.result?.winRate ? (bestFull.result.winRate * 100).toFixed(1) : 'N/A'}% |`);
  sections.push(`| Score target | ${CONFIG.research.scoreTarget} |`);
  sections.push('');

  // ── Strategy Evolution Timeline ──
  sections.push('## Strategy Evolution');
  sections.push('');
  sections.push('Each row is a **kept** experiment — a change that improved the strategy.');
  sections.push('');

  if (kept.length > 0) {
    sections.push('| # | Score | Δ | Hypothesis |');
    sections.push('|---|-------|---|------------|');

    let prevScore = 0;
    const sortedKept = [...kept].sort((a, b) => {
      const ai = allExps.indexOf(a);
      const bi = allExps.indexOf(b);
      return ai - bi;
    });

    for (const exp of sortedKept) {
      const delta = prevScore > 0 ? `${exp.score > prevScore ? '+' : ''}${(exp.score - prevScore).toFixed(3)}` : '—';
      const hyp = (exp.hypothesis || '').slice(0, 100).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      sections.push(`| ${exp.id} | ${exp.score?.toFixed(3) || '?'} | ${delta} | ${hyp} |`);
      prevScore = exp.score || 0;
    }
  } else {
    sections.push('*No kept experiments yet.*');
  }
  sections.push('');

  // ── Score Progression Chart (ASCII) ──
  sections.push('## Score Progression');
  sections.push('');
  sections.push('```');

  const maxScore = Math.max(...allExps.map(e => e.score || 0), 1);
  const chartWidth = 50;

  // Show kept experiments as a progression
  const keptSorted = [...kept].sort((a, b) => allExps.indexOf(a) - allExps.indexOf(b));
  for (const exp of keptSorted) {
    const barLen = Math.max(1, Math.round(((exp.score || 0) / maxScore) * chartWidth));
    const bar = '█'.repeat(barLen);
    const idStr = String(exp.id || '???');
    sections.push(`${idStr.padEnd(8)} ${bar} ${exp.score?.toFixed(3) || '?'}`);
  }
  sections.push('```');
  sections.push('');

  // ── Per-Pair Breakdown ──
  sections.push('## Pair Analysis');
  sections.push('');

  // Load best experiment's per-pair results if available
  if (bestFull.result?.pairResults || bestFull.result?.perPair) {
    const pairResults = bestFull.result.pairResults || bestFull.result.perPair;
    sections.push('| Pair | Return | Trades | Win Rate | Contribution |');
    sections.push('|------|--------|--------|----------|-------------|');
    for (const [pair, stats] of Object.entries(pairResults)) {
      if (FILTER_PAIR && pair !== FILTER_PAIR) continue;
      const ret = stats.returnPct?.toFixed(2) || stats.return?.toFixed(2) || '?';
      const trades = stats.trades || stats.numTrades || '?';
      const wr = stats.winRate ? (stats.winRate * 100).toFixed(1) + '%' : '?';
      const contrib = stats.contribution?.toFixed(2) || '?';
      sections.push(`| ${pair} | ${ret}% | ${trades} | ${wr} | ${contrib}% |`);
    }
  } else {
    sections.push('*Per-pair breakdown not available — run a backtest with `--verbose` to generate pair-level stats.*');
  }
  sections.push('');

  // ── Current Strategy Parameters ──
  sections.push('## Current Strategy');
  sections.push('');

  // Extract parameters from strategy source
  const paramRegex = /this\.(\w+)\s*=\s*([\d.]+|true|false|'[^']*')/g;
  let match;
  const params = {};
  while ((match = paramRegex.exec(strategySource)) !== null) {
    params[match[1]] = match[2];
  }

  if (Object.keys(params).length > 0) {
    sections.push('| Parameter | Value |');
    sections.push('|-----------|-------|');
    for (const [key, val] of Object.entries(params)) {
      sections.push(`| ${key} | \`${val}\` |`);
    }
  } else {
    sections.push('*Could not extract parameters from strategy file.*');
  }
  sections.push('');

  // ── Active Pairs ──
  sections.push('## Active Trading Pairs');
  sections.push('');
  sections.push('| Pair | DEX | Fee | Source |');
  sections.push('|------|-----|-----|--------|');
  for (const p of pairs) {
    const fee = p.fee ? `${(p.fee / 10000).toFixed(2)}%` : '—';
    const src = p.source === 'built-in' ? '🔒 built-in' : '➕ custom';
    sections.push(`| ${p.name} | ${p.dex} | ${fee} | ${src} |`);
  }
  sections.push('');

  // ── Top Experiments ──
  sections.push(`## Top ${TOP_N} Experiments`);
  sections.push('');
  const topExps = [...allExps].sort((a, b) => (b.score || -Infinity) - (a.score || -Infinity)).slice(0, TOP_N);
  sections.push('| Rank | ID | Score | Sharpe | Status | Hypothesis |');
  sections.push('|------|----|-------|--------|--------|------------|');
  topExps.forEach((exp, i) => {
    const status = exp.kept ? '✅' : '❌';
    const hyp = (exp.hypothesis || '').slice(0, 80).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    sections.push(`| ${i + 1} | ${exp.id} | ${exp.score?.toFixed(3) || '?'} | ${exp.sharpe?.toFixed(3) || '?'} | ${status} | ${hyp} |`);
  });
  sections.push('');

  // ── Failure Analysis ──
  sections.push('## Failure Patterns');
  sections.push('');

  const recentFails = reverted.slice(-10);
  if (recentFails.length > 0) {
    sections.push('Last 10 rejected experiments — avoid repeating these:');
    sections.push('');
    for (const exp of recentFails) {
      const hyp = (exp.hypothesis || '').slice(0, 120);
      sections.push(`- **${exp.id}** (${exp.score?.toFixed(3) || '?'}): ${hyp}`);
    }
  } else {
    sections.push('*No failures recorded.*');
  }
  sections.push('');

  // ── Configuration ──
  sections.push('## Configuration');
  sections.push('');
  sections.push('| Setting | Value |');
  sections.push('|---------|-------|');
  sections.push(`| Mutation model | \`${CONFIG.research.mutationModel}\` |`);
  sections.push(`| Max experiments | ${CONFIG.research.maxExperiments} |`);
  sections.push(`| Score target | ${CONFIG.research.scoreTarget} |`);
  sections.push(`| Backtest capital | $${CONFIG.backtest.initialCapital.toLocaleString()} |`);
  sections.push(`| Trade floor | ${CONFIG.backtest.scoring.tradeFloor} trades |`);
  sections.push(`| Max drawdown limit | ${CONFIG.backtest.scoring.maxDrawdown}% |`);
  sections.push(`| Bankr LLM | ${CONFIG.bankr.useBankrLLM ? '✅ Enabled' : '❌ Disabled'} |`);
  sections.push(`| Live mode | ${CONFIG.bankr.liveMode ? '⚡ LIVE' : '📝 Paper'} |`);
  sections.push('');

  // ── Footer ──
  sections.push('---');
  sections.push('*Generated by `node scripts/report.js` — @darksol/autoresearch* 🌑');

  return sections.join('\n');
}

// ─── HTML Wrapper ────────────────────────────────────────────────────

function wrapHTML(markdown) {
  // Simple markdown-to-HTML conversion for tables and headings
  let html = markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '\n<br>\n');

  // Convert markdown tables to HTML tables
  const tableRegex = /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, header, body) => {
    const headers = header.split('|').map(h => h.trim()).filter(Boolean);
    const rows = body.trim().split('\n').map(row =>
      row.split('|').map(c => c.trim()).filter(Boolean)
    );

    let table = '<table>\n<thead><tr>';
    for (const h of headers) table += `<th>${h}</th>`;
    table += '</tr></thead>\n<tbody>\n';
    for (const row of rows) {
      table += '<tr>';
      for (const cell of row) table += `<td>${cell}</td>`;
      table += '</tr>\n';
    }
    table += '</tbody></table>\n';
    return table;
  });

  // Handle code blocks
  html = html.replace(/```\n([\s\S]*?)```/g, '<pre>$1</pre>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoResearch — Strategy Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Fira Code', monospace;
      background: #0a0a0a; color: #e0e0e0;
      max-width: 960px; margin: 0 auto; padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #ffd700; font-size: 1.8rem; margin: 1.5rem 0 0.5rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { color: #b8860b; font-size: 1.3rem; margin: 1.5rem 0 0.5rem; }
    blockquote { color: #888; border-left: 3px solid #333; padding-left: 1rem; margin: 0.5rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
    th { background: #1a1a1a; color: #ffd700; text-align: left; padding: 0.5rem; border: 1px solid #333; }
    td { padding: 0.5rem; border: 1px solid #222; }
    tr:nth-child(even) { background: #111; }
    tr:hover { background: #1a1a0a; }
    code { background: #1a1a1a; padding: 0.15rem 0.4rem; border-radius: 3px; color: #ffd700; font-size: 0.9em; }
    pre { background: #111; padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 1rem 0; border: 1px solid #333; }
    strong { color: #ffd700; }
    li { margin: 0.3rem 0 0.3rem 1.5rem; }
    hr { border: none; border-top: 1px solid #333; margin: 2rem 0; }
    a { color: #b8860b; }
    .emoji { font-size: 1.2em; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────

try {
  const report = await buildReport();

  if (OUT_MD) {
    writeFileSync(resolve(ROOT, OUT_MD), report);
    console.log(`📝 Markdown report saved: ${OUT_MD}`);
  }

  if (OUT_HTML) {
    writeFileSync(resolve(ROOT, OUT_HTML), wrapHTML(report));
    console.log(`🌐 HTML report saved: ${OUT_HTML}`);
  }

  if (!OUT_MD && !OUT_HTML) {
    console.log(report);
  }

  if (OUT_MD || OUT_HTML) {
    console.log(`\n✅ Report generated — ${new Date().toISOString()}`);
  }
} catch (err) {
  console.error('Report generation failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
