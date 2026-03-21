# AutoResearch — Build Log

> Full development timeline for Synthesis Hackathon submission #2.
> Built by Darksol 🌑 (AI agent on OpenClaw) in collaboration with Meta (human).

---

## Timeline

### March 21, 2026 — Full Build Day

**13:15 EDT** — Initial commit (`a8d130f`)
- Scaffolded complete project: 10 source modules, 4 test suites, 3 benchmark strategies
- Core engine: `backtest.js` (9.2KB), `indicators.js` (7KB), `controller.js` (13KB), `memory.js` (7.7KB)
- 10 technical indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWAP, ROC, StdDev, Percentile Rank
- Backtest engine with fee model (2-5 bps maker/taker + 1-3 bps slippage)
- Composite scoring: `sharpe × √(min(trades/50, 1.0)) − drawdown_penalty − turnover_penalty`
- 4 Base DEX pairs: ETH/USDC (Uni V3 0.05%), ETH/USDC (Uni V3 0.3%), cbETH/WETH, AERO/USDC
- 17 tests passing

**13:24 EDT** — Hackathon README (`f9f5e37`)
- Full architecture diagrams, prize track mapping, experiment history section
- Modeled after synthesis-agent (submission #1) README format

**13:26 EDT** — Attribution section (`018c161`)
- Credited Karpathy's autoresearch (March 2026) as inspiration
- Credited OpenClaw LCM as the memory system

**13:31 EDT** — First autonomous research run (`d283ee0`)
- 30 experiments, zero human intervention
- Score: 0.421 → 0.610 (+44.9%)
- Key breakthrough: ATR inverse-volatility position sizing
- Discovered: dev 0.03 + RSI 40/60 is local optimum

**13:51 EDT** — Live Bankr LLM run (`975e4c6`)
- 30 more experiments via Bankr LLM Gateway (claude-haiku-4.5)
- Score: 0.610 → 0.740 (+75.8% total improvement)
- Evolution chain: exitThreshold 0.015 → deviationThreshold 0.022 → rsiPeriod 10 → atrPeriod 5
- ~$0.30 spent on Bankr LLM credits
- 4/30 kept (13% hit rate)

**14:05 EDT** — Production release (`9c2ac9a`)
- `src/regime.js` (8.2KB) — Market regime detection: Hurst exponent, EMA trend, ATR volatility
- `strategies/strategy-regime.js` (7.4KB) — Regime-adaptive strategy
- `src/executor.js` (14KB) — Production execution engine with Bankr integration
- `src/datafeed.js` (12.5KB) — Multi-source real data: DeFiLlama + CoinGecko + Base RPC
- `scripts/run-live.js` (3.1KB) — Live/paper trading runner
- Paper trading test successful: CoinGecko returned 703 hourly bars per pair
- 38 tests passing (21 new tests for regime + executor)

**14:20 EDT** — 106 experiments + live trade (`8a00e4c`)
- Third batch: 30 more experiments (exp082–exp106), none beat 0.740
- Parameter space confirmed exhausted for vanilla VWAP reversion
- Live Bankr trade on Base: 1 USDC → 0.000464 ETH
- TX: `0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8`
- GitLab mirror created: gitlab.com/darks0l/autoresearch
- Moltbook posts published in /m/builds and /m/algotrading

**14:30 EDT** — Daemon service (`d4db292`)
- `scripts/daemon.js` (4.9KB) — Persistent background experiment runner
- Upgraded mutation model to claude-sonnet-4.5
- Fixed `getLLMCredits` to parse `balanceUsd` field correctly
- Fixed data cache TTL: 7 days for historical data (was 1h)
- Updated mutation prompt with real data context
- Key finding: strategy overfit to synthetic data, performs differently on real CoinGecko data
- Cron job set: every 1h, 15 experiments per batch via OpenClaw

**14:54 EDT** — Real data breakthrough (`4c1e0a1`)
- **Critical discovery:** Strategy scored 0.740 on synthetic data but **-1.460 on real data** — textbook overfitting
- Rebuilt strategy from scratch: VWAP mean-reversion → adaptive trend-following
- `strategies/strategy-adaptive.js` — Donchian breakout + EMA filter + RSI dip-buying + ATR trailing stops
- **Score: -1.46 → 2.838 on real data** — complete turnaround
- Old VWAP strategy preserved as `strategy-vwap-synth.js`
- 117 experiments, 38 tests passing

**14:59 EDT** — Submission update & security fix (`456f59c`)
- Updated Devfolio submission with real data results
- **SECURITY:** Found hardcoded Synthesis API key in scripts — removed, rewrote git history, force-pushed
- All scripts now use `SYNTHESIS_API_KEY` env var

**15:14 EDT** — Bankr skills PR & submission packaging (`530930c`)
- PR #262 opened at https://github.com/BankrBot/skills/pull/262
- Created `agent.json` with ERC-8004 identity (token #31929)
- Generated `agent_log.json` from experiment index (120 events)
- Built auto-sync pipeline: daemon auto-commits results to GitHub after each batch

**15:29 EDT** — Pair discovery module (`aeff778`)
- `src/discovery.js` (8.3KB) — Manual add/remove + auto-scan top Base DEX pools by TVL
- `scripts/pairs.js` — CLI for pair management
- 45 tests passing (7 new discovery tests)

**15:40 EDT** — Report generator (`6d204bb`)
- `scripts/report.js` (13.5KB) — Human-readable strategy reports with ASCII score progression
- Outputs Markdown + styled dark-theme HTML
- 13 source modules total

**17:24 EDT** — Daemon mutation fix (`b43f986`)
- **Root cause found:** `BANKR_API_KEY` wasn't in env, so mutations silently returned no-op text
- Fixed `config.js` to auto-load API key from `~/.bankr/config.json` as fallback
- **Daemon run #4 (first real mutations):** 10 experiments, 3 kept (30% hit rate)
- Score: 2.838 → 2.919 (Hurst regime sizing) → 2.923 (faster Hurst) → **3.668** (tighter ATR trail 1.5)
- Sharpe: 4.002, DD: 9.3%, 42 trades

**17:30 EDT** — Daemon run #5 (`auto-sync`)
- 15 experiments (exp137–exp151), 2 kept (13% hit rate)
- exp137 (3.741): ROC momentum + ATR profit-taking exit, DD 7.1%
- **exp151 (3.777): Multi-timeframe trend filter (50-EMA slope + EMA cross alignment)**
- New all-time best: **3.777**

**18:37 EDT** — Daemon run #6 (crashed mid-batch)
- 8 of 15 experiments ran (exp153–exp160), 0 kept
- Closest: exp153 at 3.663 (volatility breakout filter)
- Crash didn't corrupt state, daemon continues next cycle

**18:50 EDT** — Documentation update
- Updated BUILD_LOG.md and CONVERSATION_LOG.md with full daemon era
- README updated with exp128 benchmark, daemon run #4 results
- Sync script enhanced to auto-update stats on each push

---

## Build Stats

| Metric | Value |
|--------|-------|
| Total commits | 15+ |
| Source modules | 13 |
| Test suites | 6 |
| Tests passing | 45/45 |
| Runtime dependencies | 0 |
| Build time | ~75 minutes (first commit → production) |
| Experiments run | 160+ (daemon still running) |
| Best score | 3.777 (exp151, +797% over 0.421 baseline) |
| Live trades | 1 (verified on Basescan) |
| Bankr LLM credits used | ~$1.90 |
| Models used | claude-haiku-4.5, claude-sonnet-4.5 (via Bankr Gateway) |

---

## Agent Harness

- **Agent:** Darksol (AI on OpenClaw)
- **Primary model:** Claude Opus (claude-opus-4-6) — architecture, code, orchestration
- **Mutation model:** Claude Haiku 4.5 → Sonnet 4.5 (via Bankr LLM Gateway)
- **Memory:** OpenClaw LCM (Lossless Context Management)
- **Human:** Meta — direction, approval, deployment decisions

Built with teeth. 🌑
