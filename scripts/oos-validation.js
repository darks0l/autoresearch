/**
 * oos-validation.js — Out-of-Sample Strategy Validation
 * 
 * 1. Walk-forward split: 70% train / 30% test on cached data
 * 2. Fresh data: Fetch new CoinGecko data the strategy has never seen
 */

import { readFileSync, writeFileSync } from 'fs';
import { runBacktest } from '../src/backtest.js';
import { CONFIG } from '../src/config.js';

// Fetch fresh OHLCV from CoinGecko
async function fetchFreshOHLCV(coinId, days = 30) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  return data.map(([ts, open, high, low, close]) => ({
    timestamp: ts, open, high, low, close, volume: 1000000
  }));
}

// Run backtest on a subset of pairs data (creates fresh strategy instance)
function backtestOnSubset(StrategyClass, allPairs, startIdx, endIdx) {
  const subset = new Map();
  for (const [name, bars] of allPairs) {
    subset.set(name, bars.slice(startIdx, endIdx));
  }
  const freshStrategy = typeof StrategyClass === 'function' ? new StrategyClass() : StrategyClass;
  return runBacktest(freshStrategy, subset);
}

function tradeCount(result) {
  if (Array.isArray(result.trades)) return result.trades.length;
  if (typeof result.trades === 'number') return result.trades;
  return result.tradeCount || 0;
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  OUT-OF-SAMPLE STRATEGY VALIDATION      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Load strategy
  const mod = await import('../strategies/strategy.js');
  const StrategyClass = mod.Strategy || mod.default?.Strategy || mod.default;
  const strategy = typeof StrategyClass === 'function' ? new StrategyClass() : (StrategyClass.strategy || StrategyClass);

  // Load all cached pair data
  const pairConfigs = CONFIG.data.pairs;
  const allPairs = new Map();
  
  for (const pair of pairConfigs) {
    const cacheFile = `data/cache/${pair.name.replace('/', '-')}_1h.json`;
    try {
      const raw = JSON.parse(readFileSync(cacheFile, 'utf-8'));
      const bars = raw.bars || raw;
      allPairs.set(pair.name, bars);
      console.log(`Loaded ${pair.name}: ${bars.length} bars`);
    } catch (e) {
      console.log(`⚠️ Skip ${pair.name}: ${e.message}`);
    }
  }

  if (allPairs.size === 0) {
    console.log('❌ No data loaded');
    process.exit(1);
  }

  // === PHASE 1: Full dataset (baseline) ===
  console.log('\n═══ PHASE 1: Full Dataset Baseline ═══\n');
  const fullResult = runBacktest(strategy, allPairs);
  console.log(`Full: Score ${fullResult.score?.toFixed(3)}, Sharpe ${fullResult.sharpe?.toFixed(3)}, Return ${(fullResult.totalReturn*100)?.toFixed(2)}%, DD ${(fullResult.maxDrawdown*100)?.toFixed(2)}%, ${tradeCount(fullResult)} trades`);

  // === PHASE 2: Walk-forward split ===
  console.log('\n═══ PHASE 2: Walk-Forward Split (70/30) ═══\n');
  
  // Find min bar count
  let minBars = Infinity;
  for (const [, bars] of allPairs) minBars = Math.min(minBars, bars.length);
  const splitIdx = Math.floor(minBars * 0.7);
  
  console.log(`Split at bar ${splitIdx} of ${minBars} (70/30)`);
  
  const trainResult = backtestOnSubset(StrategyClass, allPairs, 0, splitIdx);
  console.log(`Train (0-${splitIdx}): Score ${trainResult.score?.toFixed(3)}, Sharpe ${trainResult.sharpe?.toFixed(3)}, Return ${(trainResult.totalReturn*100)?.toFixed(2)}%, DD ${(trainResult.maxDrawdown*100)?.toFixed(2)}%, ${tradeCount(trainResult)} trades`);
  
  const testResult = backtestOnSubset(StrategyClass, allPairs, splitIdx, minBars);
  console.log(`Test  (${splitIdx}-${minBars}): Score ${testResult.score?.toFixed(3)}, Sharpe ${testResult.sharpe?.toFixed(3)}, Return ${(testResult.totalReturn*100)?.toFixed(2)}%, DD ${(testResult.maxDrawdown*100)?.toFixed(2)}%, ${tradeCount(testResult)} trades`);
  
  const degradation = trainResult.score > 0 ? ((testResult.score - trainResult.score) / trainResult.score * 100) : 0;
  console.log(`\nDegradation: ${degradation.toFixed(1)}%`);
  console.log(Math.abs(degradation) < 50 ? '✅ Acceptable degradation' : '⚠️ Significant degradation');

  // === PHASE 3: Fresh data ===
  console.log('\n═══ PHASE 3: Fresh CoinGecko Data ═══\n');
  
  const freshPairs = new Map();
  const coinMap = { 'ETH/USDC': 'ethereum', 'AERO/USDC': 'aerodrome-finance' };
  
  for (const [pairName, coinId] of Object.entries(coinMap)) {
    try {
      console.log(`Fetching ${pairName} (${coinId}) 30-day OHLC...`);
      const bars = await fetchFreshOHLCV(coinId, 30);
      console.log(`  Got ${bars.length} bars`);
      freshPairs.set(pairName, bars);
      await new Promise(r => setTimeout(r, 1500)); // rate limit
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  }

  let freshResult = null;
  if (freshPairs.size > 0) {
    const freshStrategy = typeof StrategyClass === 'function' ? new StrategyClass() : StrategyClass;
    freshResult = runBacktest(freshStrategy, freshPairs);
    console.log(`\nFresh data: Score ${freshResult.score?.toFixed(3)}, Sharpe ${freshResult.sharpe?.toFixed(3)}, Return ${(freshResult.totalReturn*100)?.toFixed(2)}%, DD ${(freshResult.maxDrawdown*100)?.toFixed(2)}%, ${tradeCount(freshResult)} trades`);
  }

  // === SUMMARY ===
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  VALIDATION SUMMARY                     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const report = {
    timestamp: new Date().toISOString(),
    full: { score: fullResult.score, sharpe: fullResult.sharpe, return: fullResult.totalReturn, maxDD: fullResult.maxDrawdown, trades: tradeCount(fullResult) },
    train: { score: trainResult.score, sharpe: trainResult.sharpe, return: trainResult.totalReturn, maxDD: trainResult.maxDrawdown, trades: tradeCount(trainResult) },
    test: { score: testResult.score, sharpe: testResult.sharpe, return: testResult.totalReturn, maxDD: testResult.maxDrawdown, trades: tradeCount(testResult) },
    degradation: degradation.toFixed(1) + '%',
    fresh: freshResult ? { score: freshResult.score, sharpe: freshResult.sharpe, return: freshResult.totalReturn, maxDD: freshResult.maxDrawdown, trades: tradeCount(freshResult) } : null,
  };

  console.log(`| Dataset     | Score  | Sharpe | Return  | Max DD  | Trades |`);
  console.log(`|-------------|--------|--------|---------|---------|--------|`);
  console.log(`| Full (in-s) | ${fullResult.score?.toFixed(2).padStart(6)} | ${fullResult.sharpe?.toFixed(2).padStart(6)} | ${((fullResult.totalReturn||0)*100).toFixed(1).padStart(6)}% | ${((fullResult.maxDrawdown||0)*100).toFixed(1).padStart(6)}% | ${String(tradeCount(fullResult)).padStart(6)} |`);
  console.log(`| Train (70%) | ${trainResult.score?.toFixed(2).padStart(6)} | ${trainResult.sharpe?.toFixed(2).padStart(6)} | ${((trainResult.totalReturn||0)*100).toFixed(1).padStart(6)}% | ${((trainResult.maxDrawdown||0)*100).toFixed(1).padStart(6)}% | ${String(tradeCount(trainResult)).padStart(6)} |`);
  console.log(`| Test  (30%) | ${testResult.score?.toFixed(2).padStart(6)} | ${testResult.sharpe?.toFixed(2).padStart(6)} | ${((testResult.totalReturn||0)*100).toFixed(1).padStart(6)}% | ${((testResult.maxDrawdown||0)*100).toFixed(1).padStart(6)}% | ${String(tradeCount(testResult)).padStart(6)} |`);
  if (freshResult) {
    console.log(`| Fresh data  | ${freshResult.score?.toFixed(2).padStart(6)} | ${freshResult.sharpe?.toFixed(2).padStart(6)} | ${((freshResult.totalReturn||0)*100).toFixed(1).padStart(6)}% | ${((freshResult.maxDrawdown||0)*100).toFixed(1).padStart(6)}% | ${String(tradeCount(freshResult)).padStart(6)} |`);
  }
  console.log(`\nDegradation train→test: ${degradation.toFixed(1)}%`);

  const verdict = testResult.score > 0 && testResult.sharpe > 0.5;
  console.log(verdict ? '\n✅ STRATEGY VALIDATED — positive out-of-sample performance' : '\n⚠️ STRATEGY NEEDS WORK — poor out-of-sample performance');

  // Save
  writeFileSync('data/oos-validation.json', JSON.stringify(report, null, 2));

  // Generate MD report
  let md = `# Out-of-Sample Validation Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Strategy:** exp199 dual-regime adaptive\n\n`;
  md += `## Results\n\n`;
  md += `| Dataset | Score | Sharpe | Return | Max DD | Trades |\n`;
  md += `|---------|-------|--------|--------|--------|--------|\n`;
  md += `| Full (in-sample) | ${fullResult.score?.toFixed(3)} | ${fullResult.sharpe?.toFixed(3)} | ${((fullResult.totalReturn||0)*100).toFixed(2)}% | ${((fullResult.maxDrawdown||0)*100).toFixed(2)}% | ${tradeCount(fullResult)} |\n`;
  md += `| Train (70%) | ${trainResult.score?.toFixed(3)} | ${trainResult.sharpe?.toFixed(3)} | ${((trainResult.totalReturn||0)*100).toFixed(2)}% | ${((trainResult.maxDrawdown||0)*100).toFixed(2)}% | ${tradeCount(trainResult)} |\n`;
  md += `| Test (30%) | ${testResult.score?.toFixed(3)} | ${testResult.sharpe?.toFixed(3)} | ${((testResult.totalReturn||0)*100).toFixed(2)}% | ${((testResult.maxDrawdown||0)*100).toFixed(2)}% | ${tradeCount(testResult)} |\n`;
  if (freshResult) {
    md += `| Fresh (30d) | ${freshResult.score?.toFixed(3)} | ${freshResult.sharpe?.toFixed(3)} | ${((freshResult.totalReturn||0)*100).toFixed(2)}% | ${((freshResult.maxDrawdown||0)*100).toFixed(2)}% | ${tradeCount(freshResult)} |\n`;
  }
  md += `\n**Train→Test Degradation:** ${degradation.toFixed(1)}%\n\n`;
  md += `## Verdict\n\n${verdict ? '✅ Strategy shows positive performance on unseen data. The signal is real.' : '⚠️ Strategy shows degradation on unseen data. Consider structural changes.'}\n\n`;
  md += `---\nBuilt with teeth. 🌑\n`;
  
  writeFileSync('docs/OOS_VALIDATION.md', md);
  console.log('\nSaved to data/oos-validation.json + docs/OOS_VALIDATION.md');
}

main().catch(console.error);
