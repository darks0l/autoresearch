/**
 * Reporter — formats experiment results for Discord/Telegram/console
 */

import { loadIndex, queryExperiments } from './memory.js';

/**
 * Format a batch report for Discord
 */
export function formatBatchReport(batchResults, batchNum, index) {
  const kept = batchResults.filter(r => r.kept);
  const reverted = batchResults.filter(r => !r.kept);

  const lines = [
    `**🔬 AutoResearch — Batch ${batchNum}**`,
    `Experiments: ${batchResults.length} | Kept: ${kept.length} | Reverted: ${reverted.length}`,
    `Best score: **${index.bestScore}** (${index.bestExperiment})`,
    '',
  ];

  for (const r of batchResults) {
    const icon = r.kept ? '✅' : '❌';
    lines.push(`${icon} \`${r.id}\`: ${r.hypothesis}`);
    lines.push(`   Score: ${r.result?.score || 'N/A'} | Sharpe: ${r.result?.sharpe || 'N/A'} | DD: ${r.result?.maxDrawdownPct || 'N/A'}%`);
  }

  return lines.join('\n');
}

/**
 * Format the final summary report
 */
export async function formatFinalReport() {
  const index = await loadIndex();
  if (!index || index.totalExperiments === 0) return 'No experiments run.';

  const topExperiments = await queryExperiments({ keptOnly: true, limit: 10 });

  const lines = [
    '**═══ AUTORESEARCH — FINAL REPORT ═══**',
    '',
    `📊 **Total experiments:** ${index.totalExperiments}`,
    `🏆 **Best score:** ${index.bestScore} (${index.bestExperiment})`,
    `✅ **Kept:** ${index.experiments.filter(e => e.kept).length}`,
    `❌ **Reverted:** ${index.experiments.filter(e => !e.kept).length}`,
    '',
    '**Top Discoveries:**',
  ];

  for (const exp of topExperiments.slice(0, 5)) {
    lines.push(`• \`${exp.id}\`: ${exp.hypothesis} → score **${exp.result?.score || exp.score}**`);
  }

  // Score progression
  const keptExps = index.experiments.filter(e => e.kept).sort((a, b) => {
    const ai = index.experiments.indexOf(a);
    const bi = index.experiments.indexOf(b);
    return ai - bi;
  });

  if (keptExps.length > 1) {
    lines.push('');
    lines.push('**Score Progression:**');
    for (const exp of keptExps) {
      const bar = '█'.repeat(Math.max(1, Math.round((exp.score / index.bestScore) * 20)));
      lines.push(`\`${exp.id}\` ${bar} ${exp.score}`);
    }
  }

  lines.push('');
  lines.push('*Built with @darksol/autoresearch — autonomous strategy discovery for Base DEX* 🌑');

  return lines.join('\n');
}

/**
 * Format a single experiment result for logging
 */
export function formatExperimentResult(record) {
  const icon = record.kept ? '✅' : '❌';
  return [
    `${icon} ${record.id}: ${record.hypothesis}`,
    `  Score: ${record.result?.score} | Sharpe: ${record.result?.sharpe}`,
    `  Return: ${record.result?.totalReturnPct}% | DD: ${record.result?.maxDrawdownPct}% | Trades: ${record.result?.numTrades}`,
    `  ${record.reason}`,
  ].join('\n');
}

export default { formatBatchReport, formatFinalReport, formatExperimentResult };
