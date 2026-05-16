// AutoResearch Configuration
// All defaults — override via environment or config file

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Auto-load Bankr API key from ~/.bankr/config.json if not in env
function loadBankrKey() {
  if (process.env.BANKR_API_KEY) return process.env.BANKR_API_KEY;
  try {
    const configPath = join(homedir(), '.bankr', 'config.json');
    if (existsSync(configPath)) {
      const data = JSON.parse(readFileSync(configPath, 'utf8'));
      return data.apiKey || '';
    }
  } catch { /* ignore */ }
  return '';
}

function loadMinimaxKey() {
  if (process.env.MINIMAX_API_KEY) return process.env.MINIMAX_API_KEY;
  try {
    const configPath = join(homedir(), '.mmx', 'config.json');
    if (existsSync(configPath)) {
      const data = JSON.parse(readFileSync(configPath, 'utf8'));
      return data.apiKey || data.accessToken || '';
    }
  } catch { /* ignore */ }
  return '';
}

function resolveLlmProvider(bankrKey, minimaxKey) {
  if (process.env.AUTORESEARCH_LLM_PROVIDER) return process.env.AUTORESEARCH_LLM_PROVIDER;
  if (bankrKey) return 'bankr';
  if (minimaxKey) return 'minimax';
  return 'none';
}

const BANKR_API_KEY = loadBankrKey();
const MINIMAX_API_KEY = loadMinimaxKey();

export const CONFIG = {
  // Data sources
  data: {
    // Uniswap V3 Base subgraph (legacy fallback — prefer rpcUrl / direct APIs)
    uniswapSubgraph: 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest',
    // Uniswap Developer Platform API key
    uniswapApiKey: process.env.UNISWAP_API_KEY || '',
    // Aerodrome Base subgraph (legacy fallback)
    aerodromeSubgraph: 'https://api.studio.thegraph.com/query/50472/aerodrome-base/version/latest',
    // Base RPC for on-chain reads
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    // Uniswap V3 Factory on Base
    uniswapFactory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    // Default spot pairs to track on Base
    pairs: [
      { name: 'ETH/USDC', token0: '0x4200000000000000000000000000000000000006', token1: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', dex: 'uniswap', fee: 500 },
      { name: 'ETH/USDC-30', token0: '0x4200000000000000000000000000000000000006', token1: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', dex: 'uniswap', fee: 3000 },
      { name: 'cbETH/WETH', token0: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', token1: '0x4200000000000000000000000000000000000006', dex: 'uniswap', fee: 500 },
      { name: 'AERO/USDC', token0: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', token1: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', dex: 'aerodrome', stable: false },
    ],
    // Candle intervals
    intervals: ['1h', '4h', '1d'],
    // History depth (bars)
    historyBars: 500,
    // Cache directory
    cacheDir: './data/cache',
  },

  // Backtest parameters
  backtest: {
    initialCapital: 100_000,
    // Fee tiers (bps)
    fees: {
      uniswap_500: { maker: 2, taker: 5, slippage: 1 },
      uniswap_3000: { maker: 10, taker: 30, slippage: 3 },
      aerodrome: { maker: 2, taker: 5, slippage: 2 },
    },
    // Scoring
    scoring: {
      tradeFloor: 50,       // trades needed for full score
      drawdownThreshold: 15, // % before penalty kicks in
      drawdownPenalty: 0.05,
      turnoverCap: 500,      // annual turnover / capital ratio
      turnoverPenalty: 0.001,
      // Hard cutoffs → score = -999
      minTrades: 10,
      maxDrawdown: 50,       // %
      maxLoss: 50,           // %
    },
    // Validation period
    validationStart: process.env.AUTORESEARCH_VALIDATION_START || '2024-07-01',
    validationEnd: process.env.AUTORESEARCH_VALIDATION_END || '2025-03-31',
  },

  // AutoResearch loop
  research: {
    maxExperiments: 200,
    backtestTimeout: 120_000,  // 120s per backtest
    // LLM for strategy mutations
    mutationModel: process.env.AUTORESEARCH_MODEL || 'claude-sonnet-4.5',
    // Parallel branches
    maxParallelBranches: 1,
    // Commit strategy
    commitOnImprovement: true,
    // Score target (stop when reached)
    scoreTarget: 20.0,
    // Experiment log
    logDir: './data/experiments',
  },

  // LLM provider for strategy mutations
  // Resolution order: explicit env -> Bankr if available -> MiniMax if available -> none
  llmProvider: resolveLlmProvider(BANKR_API_KEY, MINIMAX_API_KEY),

  // Bankr integration
  bankr: {
    apiKey: BANKR_API_KEY,
    llmGateway: 'https://llm.bankr.bot/v1/chat/completions',
    walletAddress: process.env.BANKR_WALLET || '0x8f9fa2bfd50079c1767d63effbfe642216bfcb01',
    // Use Bankr LLM for mutations if available
    useBankrLLM: true,
    // Live execution (paper by default)
    liveMode: false,
  },

  // MiniMax LLM integration
  minimax: {
    apiKey: MINIMAX_API_KEY,
    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
    model: process.env.AUTORESEARCH_MINIMAX_MODEL || 'MiniMax-M2.7-highspeed',
  },

  // Regime detection
  regime: {
    fastEma: 20,
    slowEma: 50,
    atrPeriod: 14,
    lookback: 100,
    hurstLags: 50,
    confidenceThreshold: 0.6,
  },

  // Execution engine
  execution: {
    maxPositionPct: 0.15,
    dailyLossLimit: 5.0,
    perTradeLimitUsd: 500,
    minTradeUsd: 10,
    slippageBps: 50,
    allowedPairs: ['ETH/USDC', 'ETH/USDC-30', 'cbETH/WETH', 'AERO/USDC'],
  },

  markets: {
    spot: {
      enabled: true,
      venues: ['uniswap', 'aerodrome'],
      defaultUniverse: ['ETH/USDC', 'ETH/USDC-30', 'cbETH/WETH', 'AERO/USDC'],
    },
    perps: {
      enabled: process.env.AUTORESEARCH_ENABLE_PERPS === 'true',
      venues: (process.env.AUTORESEARCH_PERP_VENUES || 'hyperliquid,dydx').split(',').map(v => v.trim()).filter(Boolean),
      defaultUniverse: (process.env.AUTORESEARCH_PERP_UNIVERSE || 'BTC-PERP,ETH-PERP,SOL-PERP').split(',').map(v => v.trim()).filter(Boolean),
      paperOnly: process.env.AUTORESEARCH_PERPS_PAPER_ONLY !== 'false',
    },
  },

  // Reporting
  reporting: {
    // Report every N experiments
    batchSize: 5,
    // Discord channel for updates
    discordChannel: 'autoresearch-lab',
  },
};

export default CONFIG;
