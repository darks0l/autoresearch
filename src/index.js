/**
 * @darksol/autoresearch
 * Autonomous trading strategy discovery for Base DEX
 *
 * Karpathy-style autoresearch with LCM memory integration.
 * Iteratively mutates, backtests, and evolves strategies
 * for Uniswap V3 and Aerodrome on Base.
 */

export { runBacktest, formatResult, backtestFromFile } from './backtest.js';
export { loadPairData, loadAllPairs, buildBarData } from './data.js';
export { runExperiment, runAutoresearch } from './controller.js';
export {
  initMemory, logExperiment, queryExperiments,
  getExperimentSummary, getPatternInsights,
} from './memory.js';
export { formatBatchReport, formatFinalReport, formatExperimentResult } from './reporter.js';
export { getBalance, callLLM, executeTrade } from './bankr.js';
export { CONFIG } from './config.js';
export * from './indicators.js';

// Production modules
export { detectRegime, trendStrength, volatilityRegime, hurstExponent, regimeSummary } from './regime.js';
export { executeSignals, getExecutionState, resetExecutionState, runLiveLoop } from './executor.js';
export { loadHistorical, fetchCurrentMarket, buildLiveBarData } from './datafeed.js';
export { addPair, removePair, listPairs, discoverPools, autoDiscoverAndAdd } from './discovery.js';
