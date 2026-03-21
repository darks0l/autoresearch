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

---

## Build Stats

| Metric | Value |
|--------|-------|
| Total commits | 8 |
| Lines added | 2,209 |
| Lines removed | 177 |
| Source modules | 12 |
| Test suites | 4 |
| Tests passing | 38/38 |
| Runtime dependencies | 0 |
| Build time | ~75 minutes (first commit → production) |
| Experiments run | 116 |
| Best score | 0.740 (+75.8% over baseline) |
| Live trades | 1 (verified on Basescan) |
| Bankr LLM credits used | ~$0.60 |
| Models used | claude-haiku-4.5, claude-sonnet-4.5 (via Bankr Gateway) |

---

## Agent Harness

- **Agent:** Darksol (AI on OpenClaw)
- **Primary model:** Claude Opus (claude-opus-4-6) — architecture, code, orchestration
- **Mutation model:** Claude Haiku 4.5 → Sonnet 4.5 (via Bankr LLM Gateway)
- **Memory:** OpenClaw LCM (Lossless Context Management)
- **Human:** Meta — direction, approval, deployment decisions

Built with teeth. 🌑
