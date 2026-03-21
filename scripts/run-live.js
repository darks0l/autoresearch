#!/usr/bin/env node
/**
 * AutoResearch — Live Execution Runner
 * 
 * Runs the winning strategy with real market data and Bankr execution.
 * 
 * Usage:
 *   node scripts/run-live.js                    # Paper trading (default)
 *   node scripts/run-live.js --live             # Live trading via Bankr
 *   node scripts/run-live.js --regime           # Use regime-aware strategy
 *   node scripts/run-live.js --cycles 24        # Run for 24 cycles
 *   node scripts/run-live.js --interval 3600    # 1 hour between cycles (seconds)
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLiveBarData } from '../src/datafeed.js';
import { runLiveLoop, getExecutionState } from '../src/executor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const liveMode = args.includes('--live');
const useRegime = args.includes('--regime');
const cyclesArg = args.find((a, i) => args[i - 1] === '--cycles');
const intervalArg = args.find((a, i) => args[i - 1] === '--interval');
const maxCycles = cyclesArg ? parseInt(cyclesArg) : 24;
const intervalSec = intervalArg ? parseInt(intervalArg) : 3600;

console.log('═══════════════════════════════════════════');
console.log('  AUTORESEARCH — Live Trading Runner');
console.log(`  Mode: ${liveMode ? '🔴 LIVE' : '📄 PAPER'}`);
console.log(`  Strategy: ${useRegime ? 'Regime-Aware Adaptive' : 'VWAP Reversion (exp074)'}`);
console.log(`  Cycles: ${maxCycles}`);
console.log(`  Interval: ${intervalSec}s`);
console.log(`  Bankr API: ${process.env.BANKR_API_KEY ? '✓' : '✗'}`);
console.log('═══════════════════════════════════════════\n');

// Import strategy
const strategyPath = useRegime
  ? resolve(__dirname, '../strategies/strategy-regime.js')
  : resolve(__dirname, '../strategies/strategy.js');

const { Strategy } = await import(`file://${strategyPath}`);
const strategy = new Strategy();

try {
  const result = await runLiveLoop(
    strategy,
    buildLiveBarData,
    {
      liveMode,
      maxPositionPct: 0.15,
      dailyLossLimit: 5.0,
      perTradeLimitUsd: liveMode ? 50 : 500,  // Start small in live mode
      minTradeUsd: 5,
    },
    {
      intervalMs: intervalSec * 1000,
      maxIterations: maxCycles,
      onTrade: (trade) => {
        if (trade.success && trade.action !== 'skip') {
          console.log(`  📊 ${trade.action.toUpperCase()} ${trade.pair}: $${trade.size?.toFixed(0)} [${trade.mode}]`);
        }
      },
      onCycle: (cycle) => {
        console.log(`  [cycle ${cycle.iteration}] signals: ${cycle.signalCount} | trades today: ${cycle.state.tradeCount} | P&L: ${cycle.state.dailyPnL.toFixed(2)}% | ${cycle.elapsed}ms`);
      },
    }
  );

  console.log('\n📋 Final State:');
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(`Fatal: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
}
