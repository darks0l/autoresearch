const API_KEY = process.env.SYNTHESIS_API_KEY;
const BASE = 'https://synthesis.devfolio.co';
const PROJECT_UUID = '644a0b1b356d40be821b898bf0c4db1d';

const conversationLog = `# AutoResearch — Conversation & Development Log

> Complete chronological record of the human-agent collaboration that built AutoResearch.
> Agent: Darksol 🌑 (OpenClaw, Claude Opus 4) | Human: Meta
> Built entirely from scratch during Synthesis Hackathon week (March 21-22, 2026)

---

## Session 1 — Foundation Build (March 21, ~12:00-14:00 EST)

**Human directive:** "Build an autoresearch skill — Karpathy-style autonomous strategy discovery for Base DEX."

**Agent actions:**
1. Scaffolded entire project from zero: indicators.js (10 pure-math indicators), backtest.js (replay engine with fee model + scoring), memory.js (LCM experiment logging), controller.js (mutation loop), bankr.js (Bankr integration), config.js, data.js
2. Wrote 17 unit tests — all passing
3. Ran first 10 experiments manually — established baseline score 0.421 (VWAP reversion)
4. Best score after initial tuning: 0.486 (exp4, deviation 0.03)
5. Committed to GitHub: https://github.com/darks0l/autoresearch

**Key decisions:**
- Scoring formula: sharpe × √(min(trades/50, 1.0)) − drawdown_penalty − turnover_penalty
- 4 Base DEX pairs: ETH/USDC (Uni V3 0.05%), ETH/USDC (0.3%), cbETH/WETH, AERO/USDC

---

## Session 2 — Bankr LLM Integration (March 21, ~14:00-15:00 EST)

**Human directive:** "Wire in Bankr LLM Gateway for mutations. Use real credits."

**Agent actions:**
1. Integrated Bankr LLM Gateway (llm.bankr.bot) — tested claude-haiku-4.5 (most reliable code generation)
2. Added system prompt for reliable code block extraction
3. Fixed batch reporter bug (wrong argument order)
4. Ran 30 LLM-driven experiments (exp046-075): 4 kept (13% hit rate)
5. Score progression: 0.615 → 0.671 → 0.714 → 0.726 → 0.740
6. ~$0.30 Bankr credits spent

**Key discovery:** claude-haiku-4.5 produces valid code on every call (no skips), unlike Gemini models

---

## Session 3 — Real Data Crisis (March 21, ~15:00-16:00 EST)

**Critical discovery:** VWAP strategy scored 0.740 on synthetic data but **-1.46 on real data** — completely overfit.

**Agent actions:**
1. Built 3-tier real data pipeline: CoinGecko OHLCV → DeFiLlama prices → synthetic fallback
2. Got 703 hourly candles per pair from CoinGecko
3. Complete strategy redesign — Donchian breakout + EMA trend filter + RSI dip-buying + ATR trailing stops
4. New score on real data: 2.838 (exp117)
5. Built regime detection module (Hurst exponent, trend strength, volatility ranking)
6. Built production execution engine via Bankr wallet

---

## Session 4 — Daemon Era (March 21, ~16:00 - March 22, ~07:00 EST)

**Human directive:** "Build a persistent daemon. Keep iterating. Use better models."

**Agent actions:**
1. Built daemon.js — persistent autonomous runner with batch experiments, credit tracking, auto-sync to GitHub
2. Switched to claude-sonnet-4.5 via Bankr LLM Gateway
3. Fixed critical bug: BANKR_API_KEY wasn't in env, so all mutations were empty strings returning baseline
4. Set up OpenClaw cron job (every 1 hour, 15 experiments/batch)
5. 12+ daemon runs over ~15 hours

**Score evolution through daemon:**
- Run #4: 2.838 → 2.919 → 2.923 → 3.668 (Hurst regime sizing, tighter ATR trail)
- Run #5: 3.741 → 3.777 (ROC momentum, multi-TF filter)
- Manual structural break: 4.512 (ensemble voting — 3 sub-strategies)
- Run #6: 5.31 (pure trend breakout, daemon hit 5.0 target)
- Run #7: 7.327 (ATR percentile filter — biggest single improvement)
- Run #8: 7.875 (adaptive profit targets)
- Run #9: 7.991 (dynamic breakout lookback)
- Run #10: 8.176 (dual-regime Hurst portfolio)

**Key innovations built:**
- Auto-escalation plateau detector: 3 tiers ban parameter tweaks after consecutive failures, forcing structural mutations
- Mutation prompt overhaul: explicit structural thinking directives
- Auto-sync pipeline: daemon auto-commits results to GitHub after each batch
- Pair discovery module: manual add/remove + auto-scan top Base DEX pools
- Report generator: Markdown + styled HTML output

---

## Session 5 — Submission & Polish (March 21-22)

**Agent actions:**
1. Created and published Devfolio submission (6 prize tracks)
2. Built demo video pipeline (HTML slides → Playwright screenshots → ffmpeg)
3. Executed live Bankr trade on Base: 1 USDC → 0.000464 ETH (TX: 0x752f739...)
4. Published 2 Moltbook posts (/m/builds, /m/algotrading)
5. Opened PR #262 to BankrBot/skills for autoresearch skill
6. Created agent.json + agent_log.json for Let the Agent Cook track
7. Built comprehensive docs: BUILD_LOG.md, CONVERSATION_LOG.md, TEST_RESULTS.md, ON_CHAIN_RECEIPTS.md, EXPERIMENT_INDEX.md, REPORT.md

---

## Final Stats

- **222 experiments** (55 kept, 167 reverted, 24.8% hit rate)
- **Best score: 8.176** (exp199, +1,842% over 0.421 baseline)
- **4 strategy eras:** VWAP → trend-following → ensemble → dual-regime
- **45/45 tests passing**
- **14 source modules**
- **38 commits** on GitHub
- **~$0.70 Bankr LLM credits spent**
- **1 live trade** on Base via Bankr wallet
- **Zero runtime dependencies** — pure Node.js

## What the Agent Did vs What the Human Did

**Agent (Darksol):**
- Designed architecture (all 14 modules)
- Implemented all code from scratch
- Ran 222 experiments autonomously
- Discovered 4 strategy eras through self-directed research
- Built daemon, plateau detector, auto-sync pipeline
- Generated all documentation and submission materials
- Executed live trade, published Moltbook posts, opened PR

**Human (Meta):**
- Set initial direction ("build autoresearch for Base DEX")
- Approved structural decisions at key moments
- Requested daemon, pair discovery, report generator
- Pushed for real data (caught overfitting)
- Directed submission packaging

---

Built with teeth. 🌑`;

const res = await fetch(`${BASE}/projects/${PROJECT_UUID}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationLog,
    moltbookPostURL: 'https://www.moltbook.com/post/43d2545a-b1bf-4e82-b43f-d4575a96f6c3',
    submissionMetadata: {
      agentFramework: 'other',
      agentFrameworkOther: 'custom Node.js autoresearch engine',
      agentHarness: 'openclaw',
      model: 'claude-opus-4-6',
      skills: ['autoresearch', 'bankr'],
      tools: ['Bankr LLM Gateway', 'Bankr Wallet API', 'CoinGecko OHLCV', 'Uniswap Developer Platform API'],
      helpfulResources: [
        'https://github.com/karpathy/autoresearch',
        'https://docs.bankr.bot',
        'https://developer.uniswap.org'
      ],
      intention: 'continuing',
      intentionNotes: 'AutoResearch is a reusable OpenClaw skill — installable by any agent for autonomous strategy discovery. Daemon continues iterating post-hackathon.',
      commitCount: 38,
      contributorCount: 1,
      firstCommitAt: '2026-03-21T17:15:06Z',
      lastCommitAt: '2026-03-22T11:56:22Z',
    },
  }),
});
const data = await res.json();
console.log(res.ok ? `✅ Updated: ${data.slug}` : `❌ ${res.status}: ${JSON.stringify(data)}`);
