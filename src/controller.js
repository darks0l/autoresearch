/**
 * AutoResearch Controller
 * The autonomous loop: mutate → backtest → keep/revert → learn → repeat
 */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.js';
import { runBacktest, formatResult } from './backtest.js';
import { loadAllPairs } from './data.js';
import {
  initMemory, nextExperimentId, logExperiment,
  getExperimentSummary, getPatternInsights, loadIndex,
} from './memory.js';
import { detectRegime, regimeSummary } from './regime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STRATEGY_PATH = resolve(__dirname, '../strategies/strategy.js');

/**
 * Generate a strategy mutation using an LLM
 */
async function generateMutation(currentCode, experimentSummary, patternInsights, currentScore) {
  const model = CONFIG.research.mutationModel;
  const prompt = buildMutationPrompt(currentCode, experimentSummary, patternInsights, currentScore);

  // Try Bankr LLM Gateway first if configured
  if (CONFIG.bankr.useBankrLLM && CONFIG.bankr.apiKey) {
    try {
      return await callBankrLLM(prompt);
    } catch (e) {
      console.log(`  [bankr-llm] Failed: ${e.message}, falling back...`);
    }
  }

  // Fall back to direct model call (for OpenClaw agent context)
  // In production, this runs inside an OpenClaw sub-agent
  return {
    hypothesis: 'Manual mutation — implement via OpenClaw agent',
    code: currentCode,
    description: prompt,
  };
}

/**
 * Build the mutation prompt
 */
function buildMutationPrompt(currentCode, experimentSummary, patternInsights, currentScore) {
  return `You are an autonomous trading strategy researcher. Your goal is to improve the Sharpe ratio and score of a Base DEX trading strategy.

## Current Strategy (score: ${currentScore})
\`\`\`javascript
${currentCode}
\`\`\`

## Experiment History
${experimentSummary}

## Pattern Analysis
${patternInsights}

## Available Indicators
From indicators.js: sma, ema, rsi, macd, bollingerBands, atr, vwap, roc, stddev, percentileRank

## Rules
- ONLY modify the Strategy class and its methods
- Keep the same import structure
- Do NOT add new dependencies
- Each change should be ONE atomic hypothesis

## IMPORTANT: Score Plateau at ~8.0
The strategy has been heavily optimized through ${currentScore > 7 ? '190+' : 'many'} experiments.
Parameter tweaks (changing periods, thresholds, multipliers) are EXHAUSTED — they no longer improve score.
DO NOT propose small parameter changes. They WILL fail.

## What WILL work (pick ONE):
1. **Multi-pair correlation signals** — use cross-pair divergence/convergence as entry triggers (e.g., ETH/USDC diverging from cbETH/WETH = opportunity)
2. **Ensemble sub-strategies** — run 2-3 different strategies and combine their signals with weighted voting or conviction scoring
3. **Regime-switching** — detect trending vs ranging vs volatile regimes and run completely different strategy logic in each
4. **Adaptive exit cascading** — trail with multiple stops at different ATR multiples, scale out in thirds
5. **Mean-reversion overlay** — add a secondary counter-trend system that fires ONLY during range-bound detected regimes (Hurst < 0.5)
6. **Cross-timeframe momentum** — synthesize multi-period signals (e.g., 4h trend direction from hourly bars using rolling windows of 4, 8, 24 bars)

## Data Context
- Base DEX pairs: ETH/USDC (Uniswap V3), AERO/USDC (Aerodrome), cbETH/WETH
- Hourly bars, ~700-bar history window (REAL CoinGecko market data)
- Fee model: 2-5 bps maker/taker + 1-3 bps slippage
- Scoring: sharpe × √(min(trades/50, 1.0)) - drawdown_penalty - turnover_penalty
- The onBar method receives (barData, portfolio) where barData has: pair, open, high, low, close, volume, timestamp
- portfolio has: cash, positions (Map), equity, getPositionSize(pair)

## Regime Detection (available)
The system includes a regime detector (src/regime.js) with:
- Trend strength (dual EMA crossover + slope)
- Volatility regime (ATR percentile ranking)
- Hurst exponent (R/S analysis for mean-reversion vs trending)
You can import and use: detectRegime, trendStrength, volatilityRegime from '../src/regime.js'

## Your Task
Propose ONE STRUCTURAL change (not a parameter tweak). You MUST respond in this EXACT format:

HYPOTHESIS: [one sentence describing what you're changing and why]

\`\`\`javascript
[THE COMPLETE strategy.js FILE — not a diff, not a snippet, the ENTIRE file including imports]
\`\`\`

PARAMETERS:
\`\`\`json
{"paramName": "value"}
\`\`\`

CRITICAL RULES:
- The code block MUST be the complete strategy.js file, starting with import statements
- Only import from '../src/indicators.js' — available exports: vwap, rsi, atr, ema, sma, macd, bollingerBands, roc, stddev, percentileRank
- The class MUST be named Strategy with an onBar(barData, portfolio) method
- You MUST include \`export class Strategy\` and \`export default { Strategy }\`
- Do NOT add any dependencies or imports beyond indicators.js`;
}

/**
 * Call Bankr LLM Gateway
 */
async function callBankrLLM(prompt) {
  const resp = await fetch(CONFIG.bankr.llmGateway, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.bankr.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.research.mutationModel,
      messages: [
        {
          role: 'system',
          content: 'You are a precise trading strategy code generator. You ALWAYS respond with exactly: a HYPOTHESIS line, then a complete javascript code block, then a PARAMETERS json block. You NEVER skip the code block. You NEVER explain yourself beyond the hypothesis line.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    }),
  });

  if (!resp.ok) throw new Error(`Bankr LLM error: ${resp.status}`);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  return parseMutationResponse(content);
}

/**
 * Parse LLM mutation response
 */
function parseMutationResponse(content) {
  // Flexible hypothesis extraction
  const hypothesisMatch = content.match(/HYPOTHESIS:\s*(.+?)(?:\n|$)/i)
    || content.match(/^#+\s*Hypothesis[:\s]*(.+?)(?:\n|$)/im)
    || content.match(/hypothesis[:\s]+(.+?)(?:\n|$)/i);

  // Flexible code block extraction (js, javascript, or untagged)
  const codeMatch = content.match(/```(?:javascript|js)?\n([\s\S]+?)```/);

  // Flexible parameters extraction
  const paramsMatch = content.match(/PARAMETERS:\s*```json\n([\s\S]+?)```/i)
    || content.match(/```json\n([\s\S]+?)```/);

  let parameters = {};
  if (paramsMatch) {
    try { parameters = JSON.parse(paramsMatch[1]); } catch { /* ignore bad JSON */ }
  }

  return {
    hypothesis: hypothesisMatch?.[1]?.trim() || 'LLM-proposed mutation',
    code: codeMatch?.[1]?.trim() || null,
    parameters,
    raw: content,
  };
}

/**
 * Load current strategy source code
 */
async function loadStrategy() {
  return await readFile(STRATEGY_PATH, 'utf-8');
}

/**
 * Write new strategy code
 */
async function writeStrategy(code) {
  // Backup first
  const backupPath = STRATEGY_PATH + '.backup';
  await copyFile(STRATEGY_PATH, backupPath);
  await writeFile(STRATEGY_PATH, code);
}

/**
 * Revert strategy from backup
 */
async function revertStrategy() {
  const backupPath = STRATEGY_PATH + '.backup';
  await copyFile(backupPath, STRATEGY_PATH);
}

/**
 * Import strategy dynamically (bust cache with query string)
 */
async function importStrategy() {
  const cacheBuster = `?t=${Date.now()}`;
  const { Strategy } = await import(`file://${STRATEGY_PATH}${cacheBuster}`);
  return new Strategy();
}

/**
 * Run a single experiment
 * @returns {{ kept: boolean, record: Object }}
 */
export async function runExperiment(allPairs, mutation) {
  const expId = await nextExperimentId();
  const originalCode = await loadStrategy();

  console.log(`\n━━━ ${expId}: ${mutation.hypothesis} ━━━`);

  // Apply mutation
  if (mutation.code) {
    await writeStrategy(mutation.code);
  }

  // Backtest
  let result;
  try {
    const strategy = await importStrategy();
    result = runBacktest(strategy, allPairs);
  } catch (e) {
    console.log(`  [ERROR] Backtest failed: ${e.message}`);
    await revertStrategy();
    return {
      kept: false,
      record: await logExperiment({
        id: expId,
        timestamp: Date.now(),
        hypothesis: mutation.hypothesis,
        mutation: mutation.description || '',
        diff: '',
        result: { score: -999, sharpe: 0, totalReturnPct: 0, maxDrawdownPct: 100, numTrades: 0 },
        kept: false,
        reason: `Backtest error: ${e.message}`,
        parameters: mutation.parameters || {},
      }),
    };
  }

  // Compare with previous best
  const index = await loadIndex();
  const previousBest = index.bestScore || -Infinity;
  const improved = result.score > previousBest;

  console.log(`  Score: ${result.score} (prev best: ${previousBest}) → ${improved ? '✓ KEPT' : '✗ REVERTED'}`);
  console.log(`  Sharpe: ${result.sharpe} | DD: ${result.maxDrawdownPct}% | Trades: ${result.numTrades}`);

  if (!improved && mutation.code) {
    await revertStrategy();
  }

  const record = await logExperiment({
    id: expId,
    timestamp: Date.now(),
    hypothesis: mutation.hypothesis,
    mutation: mutation.description || '',
    diff: mutation.code ? `[${mutation.code.length} chars]` : '[no code change]',
    result,
    kept: improved,
    reason: improved
      ? `Improved score by ${(result.score - previousBest).toFixed(3)}`
      : `Score ${result.score} did not beat ${previousBest}`,
    parameters: mutation.parameters || {},
  });

  return { kept: improved, record };
}

/**
 * Run the full autoresearch loop
 * @param {Object} options
 * @param {number} [options.maxExperiments] - Override max experiments
 * @param {Function} [options.mutationFn] - Custom mutation function (for OpenClaw agent integration)
 * @param {Function} [options.onExperiment] - Callback after each experiment
 * @param {Function} [options.onBatch] - Callback after each batch (for reporting)
 */
export async function runAutoresearch(options = {}) {
  const {
    maxExperiments = CONFIG.research.maxExperiments,
    mutationFn = generateMutation,
    onExperiment,
    onBatch,
    batchSize = CONFIG.reporting.batchSize,
  } = options;

  console.log('═══════════════════════════════════════════');
  console.log('  AUTORESEARCH — Autonomous Strategy Discovery');
  console.log('  Target: Base DEX (Uniswap V3 + Aerodrome)');
  console.log(`  Max experiments: ${maxExperiments}`);
  console.log('═══════════════════════════════════════════\n');

  await initMemory();

  // Load historical data once
  console.log('Loading historical data...');
  const allPairs = await loadAllPairs('1h');
  console.log('Data loaded.\n');

  // Baseline backtest
  console.log('Running baseline backtest...');
  const baselineStrategy = await importStrategy();
  const baselineResult = runBacktest(baselineStrategy, allPairs);
  console.log(`Baseline score: ${baselineResult.score}`);
  console.log(formatResult(baselineResult));

  await logExperiment({
    id: 'baseline',
    timestamp: Date.now(),
    hypothesis: 'Initial strategy — baseline measurement',
    mutation: '',
    diff: '',
    result: baselineResult,
    kept: true,
    reason: 'Baseline',
    parameters: {},
  });

  // Research loop
  let experimentCount = 0;
  let batchCount = 0;
  const batchResults = [];

  while (experimentCount < maxExperiments) {
    // Build context for mutation
    const currentCode = await loadStrategy();
    const experimentSummary = await getExperimentSummary();
    const patternInsights = await getPatternInsights();
    const index = await loadIndex();
    const currentScore = index.bestScore || baselineResult.score;

    // Check score target
    if (currentScore >= CONFIG.research.scoreTarget) {
      console.log(`\n🎯 Score target reached: ${currentScore} >= ${CONFIG.research.scoreTarget}`);
      break;
    }

    // Generate mutation
    const mutation = await mutationFn(currentCode, experimentSummary, patternInsights, currentScore);

    if (!mutation || !mutation.code) {
      console.log('  [skip] No valid mutation generated');
      experimentCount++;
      continue;
    }

    // Run experiment
    const { kept, record } = await runExperiment(allPairs, mutation);
    experimentCount++;
    batchResults.push(record);

    if (onExperiment) {
      await onExperiment(record, experimentCount, maxExperiments);
    }

    // Batch reporting
    if (batchResults.length >= batchSize) {
      batchCount++;
      if (onBatch) {
        await onBatch(batchResults, batchCount, index);
      }
      batchResults.length = 0;
    }

    // Small delay to not hammer APIs
    await new Promise(r => setTimeout(r, 1000));
  }

  // Final report
  const finalIndex = await loadIndex();
  console.log('\n═══════════════════════════════════════════');
  console.log('  AUTORESEARCH COMPLETE');
  console.log(`  Experiments: ${finalIndex.totalExperiments}`);
  console.log(`  Best score: ${finalIndex.bestScore} (${finalIndex.bestExperiment})`);
  console.log(`  Baseline: ${baselineResult.score}`);
  console.log(`  Improvement: ${((finalIndex.bestScore - baselineResult.score) / Math.abs(baselineResult.score) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════');

  return finalIndex;
}

export default { runExperiment, runAutoresearch };
