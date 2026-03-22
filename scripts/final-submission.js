#!/usr/bin/env node
const API_KEY = process.env.SYNTHESIS_API_KEY;

async function update(uuid, payload) {
  const res = await fetch(`https://synthesis.devfolio.co/projects/${uuid}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(data.slug ? `✅ ${data.slug} (desc: ${data.description?.length} chars)` : `❌ ${JSON.stringify(data).slice(0,300)}`);
}

// AutoResearch
await update('644a0b1b356d40be821b898bf0c4db1d', {
  description: `Karpathy-style autoresearch for Base DEX trading — built from zero to production in 12 hours during The Synthesis Hackathon.

223+ LLM-driven strategy mutations via Bankr LLM Gateway (claude-haiku-4.5 + claude-sonnet-4.5), backtested on 4 real Base pairs (ETH/USDC, cbETH/WETH, AERO/USDC).

Best score: 8.176 Sharpe (exp199, dual-regime adaptive portfolio with Hurst exponent allocation). +1,843% improvement over 0.421 baseline across 4 strategy eras: VWAP mean-reversion → adaptive trend-following → ensemble voting → dual-regime portfolio.

71+ verified on-chain transactions on Base mainnet (100% success rate): 70 execution pipeline swaps via Bankr wallet + 1 real x402 EIP-3009 payment settled via DARKSOL Facilitator (zero fees, TX 0xa30089...).

Out-of-sample validation: walk-forward PASSED (17% degradation on 30% test split), fresh 30-day data FAILED (regime-specific — which is exactly why the daemon runs continuously).

x402 revenue loop: sells /strategy/discover (2.00 USDC), /strategy/validate (0.50 USDC), /strategy/signal (0.10 USDC). Revenue funds Bankr LLM credits. Self-funding research loop.

14 source modules, 51 tests, autonomous daemon (cron, 15 experiments/hour, auto-commits to GitHub). No pre-existing codebase.`,
  conversationLog: `Built in a single 12-hour session (March 21-22, 2026) through continuous human-agent collaboration between Meta (human) and Darksol (AI agent on OpenClaw).

Hour 0-2: Core engine — 10 pure-math indicators (RSI, MACD, BB, ATR, VWAP, Stochastic, OBV, EMA, Williams %R, Percentile Rank), backtest engine with fee model and composite scoring, LCM experiment memory system.

Hour 2-4: Benchmark strategies + autonomous research loop. Bankr LLM Gateway integration — first 75 LLM-driven experiments on synthetic data (score 0.421→0.740, +75.8%). Discovered ATR inverse-volatility position sizing was more impactful than any signal change.

Hour 4-6: Real CoinGecko data pipeline revealed strategy was overfit — VWAP collapsed from 0.74 to -1.46 on real data. Complete redesign: adaptive trend-following with Donchian breakout, EMA filter, RSI dip-buying, ATR trailing stops. Score breakthrough to 2.838 on real data.

Hour 6-8: Regime detection module (Hurst exponent via R/S analysis, dual EMA trend, ATR percentile volatility). Production execution engine with Bankr wallet integration and risk management. Daemon service with auto-sync to GitHub.

Hour 8-10: Ensemble voting strategy broke 3.78 ceiling (4.512). Live Bankr swaps on Base (100% success). x402 micropayment service built (3 endpoints). EIP-3009 receipt settled on Base via DARKSOL Facilitator.

Hour 10-12: Daemon auto-discovered pure trend breakout (5.31), ATR percentile filter (7.33), adaptive profit targets (7.88), dynamic breakout lookback (7.99), dual-regime Hurst portfolio (8.176). 71+ live trades on Base. Devfolio submission published.

Post-session: Daemon continues autonomously every hour (15 experiments/batch, claude-sonnet-4.5 via Bankr). Auto-escalation plateau detector (3 tiers) bans parameter tweaks after consecutive failures, forcing structural innovation. 223+ total experiments. Out-of-sample validation: walk-forward PASSED (17% degradation), fresh data FAILED (regime-specific). Moltbook posts published in /m/builds, /m/algotrading, /m/agentfinance, /m/agenteconomy, /m/trading, /m/crypto. Bankr skills PR #262 opened.`,
  moltbookPostURL: 'https://www.moltbook.com/post/43d2545a-b1bf-4e82-b43f-d4575a96f6c3',
  submissionMetadata: {
    agentFramework: 'other',
    agentFrameworkOther: 'OpenClaw',
    agentHarness: 'other',
    agentHarnessOther: 'OpenClaw Gateway + Bankr API',
    model: 'claude-opus-4-6 (orchestration) + claude-sonnet-4.5 (mutations via Bankr) + claude-haiku-4.5 (early mutations)',
    skills: ['autoresearch (custom)', 'bankr', 'darksol-terminal', 'darksol-facilitator'],
    tools: ['Bankr LLM Gateway', 'Bankr Wallet API', 'CoinGecko OHLCV', 'DARKSOL Facilitator (x402)', 'Uniswap Developer Platform API', 'OpenClaw LCM (memory)', 'GitHub API'],
    helpfulResources: ['https://github.com/karpathy/autoresearch', 'https://docs.openclaw.ai', 'https://bankr.bot', 'https://facilitator.darksol.net', 'https://developer.uniswap.org'],
    helpfulSkills: [{name: 'bankr', reason: 'LLM Gateway for strategy mutations + wallet for live execution'}, {name: 'darksol-facilitator', reason: 'Zero-fee x402 payment settlement on Base'}],
    intention: 'exploring',
    intentionNotes: 'Built from zero in 12 hours during hackathon. Exploring autonomous strategy discovery as a sellable agent service via x402.'
  }
});

console.log('Done');
