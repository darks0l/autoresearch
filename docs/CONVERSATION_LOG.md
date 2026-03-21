# AutoResearch — Conversation & Development Log

> Complete chronological record of the human-agent collaboration that built AutoResearch.
> Agent: Darksol 🌑 (OpenClaw, Claude Opus 4) | Human: Meta

---

## Session 1 — March 21, 2026, 13:15–14:31 EDT

### Phase 1: Project Scaffolding (13:15–13:26)

**Meta:** Requested autonomous Base DEX trading strategy discovery system using Karpathy-style autoresearch with LCM memory, as second Synthesis Hackathon submission.

**Darksol:** Built complete project from scratch:
- 10 source modules (backtest engine, 10 indicators, LCM memory, controller loop, data layer, reporter, config, bankr integration, exports)
- 4 test suites, 17 tests passing
- 3 benchmark strategies (VWAP reversion, mean reversion, momentum)
- 4 Base DEX pairs configured (ETH/USDC × 2 fee tiers, cbETH/WETH, AERO/USDC)
- Composite scoring system: `sharpe × √(min(trades/50, 1.0)) − drawdown_penalty − turnover_penalty`
- Hackathon-ready README with architecture diagrams, prize track mapping
- Karpathy attribution + OpenClaw LCM acknowledgment

**Key design decision:** Single strategy file as "source of truth" — LLM mutates one file, backtest validates, keep or revert. No strategy database, no version branching. Simple and auditable.

### Phase 2: First Autonomous Research Run (13:26–13:31)

**Darksol:** Ran 30 experiments autonomously, zero human intervention.
- Baseline score: 0.421 (VWAP reversion)
- After 30 experiments: 0.610 (+44.9%)
- **Key breakthrough:** ATR inverse-volatility position sizing — let volatility determine bet size
- Discovered local optimum: deviation 0.03 + RSI 40/60
- 7 kept, 23 rejected

### Phase 3: Bankr LLM Gateway Integration (13:31–13:51)

**Meta:** Confirmed Bankr credits available ($9.85). Approved wiring Bankr LLM Gateway for mutations.

**Darksol:** Integrated Bankr LLM Gateway at `llm.bankr.bot`:
- Tested multiple models: gemini-3-flash (unreliable code blocks), gemini-2.5-flash (also unreliable), settled on **claude-haiku-4.5** (100% valid code generation)
- Added system prompt for instruction-following
- Fixed batch reporter bug (wrong argument order in callback)
- Improved mutation parser with fallback hypothesis extraction
- **30 more experiments via Bankr LLM:** Score 0.610 → 0.740 (+75.8% total)
- Hit rate: 4/30 kept (13%)
- ~$0.30 credits used

**Evolution chain discovered by LLM:**
1. exp037: ATR period 14→7 (score 0.615)
2. exp053: exitThreshold 0.01→0.015 (score 0.671) — hold positions longer
3. exp065: deviationThreshold 0.025→0.022 (score 0.714) — earlier entries
4. exp070: RSI period 14→10 (score 0.726) — faster entry timing
5. exp074: ATR period 7→5 (score 0.740) — most responsive volatility scaling

**Key insight:** Each kept experiment built on the previous one. The LLM learned from the full history and made progressively smaller, more targeted changes. This is the power of LCM memory — convergent research, not random search.

### Phase 4: Production Build (13:51–14:05)

**Meta:** Requested full production pipeline — real data, regime detection, live execution via Bankr.

**Darksol:** Built 4 new major modules:
- `src/regime.js` (8.2KB) — Hurst exponent (R/S analysis), EMA dual crossover trend detection, ATR volatility percentile ranking, combined regime classifier
- `strategies/strategy-regime.js` (7.4KB) — Regime-adaptive: momentum in trends, VWAP reversion in mean-reverting markets, reduced size in high vol, sit-out in low vol
- `src/executor.js` (14KB) — Production execution via Bankr wallet. Paper + live modes, position clamping, risk limits (15% max position, 5% daily loss), pair allowlist
- `src/datafeed.js` (12.5KB) — Three-tier data: DeFiLlama → CoinGecko → Base RPC swap events → synthetic fallback
- `scripts/run-live.js` (3.1KB) — Live/paper trading launcher
- 21 new tests (regime + executor), total: 38/38 passing

**Paper trading test:** CoinGecko returned 703 hourly bars per pair. Regime detection opened AERO/USDC short. Risk management clamped $28,800 position to $500. Cache system working.

### Phase 5: Third Experiment Batch + Live Trade (14:05–14:20)

**Darksol:** Ran 30 more experiments (exp082–exp106). None beat 0.740 — parameter space confirmed exhausted for vanilla VWAP reversion.

**Live Bankr trade on Base:**
- Swapped 1 USDC → 0.000464 ETH
- TX: `0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8`
- [Verify on Basescan](https://basescan.org/tx/0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8)

**Moltbook posts published:**
- /m/builds — Full technical showcase (verified with math challenge 32+14=46.00)
- /m/algotrading — Audience-targeted post (verified with math challenge 23+15=38.00)

**GitLab mirror:** gitlab.com/darks0l/autoresearch created and synced.

### Phase 6: Daemon Service (14:20–14:31)

**Meta:** Requested persistent daemon that grinds experiments autonomously using better models from Bankr LLM Gateway.

**Darksol:** Built daemon service:
- `scripts/daemon.js` — Background runner with state tracking, credit monitoring, batch reporting
- Upgraded default model to claude-sonnet-4.5 (from haiku)
- Fixed `getLLMCredits` to parse `balanceUsd` field
- Fixed data cache TTL (7 days for historical, was 1 hour)
- **Key discovery:** Strategy was overfit to synthetic data. Real CoinGecko data shows -1.46 baseline — needs structural changes, not parameter tweaks. Updated mutation prompt to tell LLM this.
- Set up OpenClaw cron job: every 1h, 15 experiments per batch

**Final state:** 116 experiments logged, best score 0.740 (on synthetic data). Daemon running, grinding toward structural improvements on real data.

---

## Key Decisions Made During Build

1. **Single-file strategy mutation** — Keep it simple. One file, one source of truth. LLM rewrites the whole file each time.
2. **Keep/revert with full logging** — Every experiment recorded, even failures. LCM indexes everything.
3. **Haiku for fast iteration, Sonnet for quality** — Started with haiku (cheap, fast), upgraded to sonnet (better mutations) as we found diminishing returns.
4. **Real data → synthetic data discovery** — Strategy tuned on synthetic data; real data performance is different. This is itself a finding worth sharing.
5. **Zero runtime dependencies** — All indicators, backtest, memory implemented in pure Node.js. Nothing to install, nothing to break.

---

## Agent Capabilities Demonstrated

- **Autonomous coding** — 12 modules, 2,209 lines added, zero copy-paste
- **Self-directed research** — 116 experiments with no human intervention per experiment
- **API integration** — Bankr LLM Gateway, CoinGecko, DeFiLlama, Moltbook
- **On-chain execution** — Live DEX swap on Base via natural language
- **Persistent memory** — LCM-powered experiment history that makes each mutation smarter
- **Testing discipline** — 38 tests, all passing, covering all major modules
- **Multi-platform publishing** — GitHub, GitLab, Moltbook, Discord

---

Built with teeth. 🌑
