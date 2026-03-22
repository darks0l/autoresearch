<p align="center">
  <img src="assets/darksol-banner.png" alt="DARKSOL" width="600" />
</p>
<h3 align="center">Built by DARKSOL 🌑</h3>

# AutoResearch — Autonomous DEX Strategy Discovery

> **Karpathy-style autoresearch for Base DEX trading** — an AI agent that iteratively mutates, backtests, and evolves strategies against real Uniswap V3 + Aerodrome data on Base. Every experiment is remembered via LCM (Lossless Context Management), making each mutation smarter than the last. Built for [The Synthesis Hackathon](https://synthesis.md) (March 13–22, 2026).

[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-45%2F45-brightgreen.svg)](test/)
[![Base](https://img.shields.io/badge/Chain-Base-blue.svg)](https://base.org)
[![Bankr Compatible](https://img.shields.io/badge/Bankr-Compatible-purple.svg)](https://bankr.bot)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-cyan.svg)](https://openclaw.ai)

---

## The Thesis

Most trading bots are static. Someone writes a strategy, deploys it, and prays. When markets shift, the strategy breaks and a human has to manually intervene.

**AutoResearch eliminates the human bottleneck.** An AI agent runs a continuous research loop — proposing hypotheses, testing them against real Base DEX data, keeping only improvements, and learning from every failure. The agent doesn't just execute trades; it **discovers** how to trade.

The key insight: **LCM memory makes the agent learn from its own research history.** Instead of blind mutations, the agent queries what parameter ranges work, what signal combinations improve Sharpe, and what approaches consistently fail. Each experiment is smarter because the agent remembers every previous one.

## How It Works

```
┌─────────────────────────────────────────────────────┐
│             AutoResearch Loop                        │
│                                                      │
│  1. Read strategy.js + full score history            │
│  2. Query LCM: "what worked? what failed?"           │
│  3. LLM proposes ONE targeted mutation               │
│  4. Backtest against 4 Base DEX pairs (real data)    │
│  5. Score improved? → KEEP (commit + log)            │
│     Score worse?    → REVERT (log failure reason)    │
│  6. Update memory → repeat (smarter each time)       │
│                                                      │
│  Every experiment logged. Nothing lost. Agent learns. │
└─────────────────────────────────────────────────────┘
```

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    AUTORESEARCH ENGINE                          │
│                                                                │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │  Controller  │→│  Strategy File   │→│   Backtest Engine │   │
│  │  (mutate →   │  │  (single source  │  │  (fee model,      │   │
│  │   test →     │  │   of truth)      │  │   scoring, DD)    │   │
│  │   learn)     │  │                  │  │                   │   │
│  └──────┬───────┘  └─────────────────┘  └────────┬──────────┘   │
│         │                                         │              │
│         ▼                                         ▼              │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │  LCM Memory  │  │  10 Indicators   │  │    Reporter       │   │
│  │  (experiment │  │  RSI, MACD, BB,  │  │  (batch reports,  │   │
│  │   history,   │  │  ATR, VWAP,      │  │   Discord/TG)     │   │
│  │   patterns)  │  │  Stochastic...   │  │                   │   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  BANKR INTEGRATION                       │   │
│  │  LLM Gateway (mutations) │ Wallet (live execution)      │   │
│  │  Balance checks │ Trade execution │ Portfolio tracking   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  DATA LAYER (Base DEX)                    │   │
│  │  ETH/USDC (Uni V3 0.05%) │ ETH/USDC (Uni V3 0.3%)      │   │
│  │  cbETH/WETH (Uni V3)     │ AERO/USDC (Aerodrome)        │   │
│  │  500+ hourly candles per pair │ Real on-chain data       │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
git clone https://github.com/darks0l/autoresearch.git
cd autoresearch

# Fetch historical Base DEX data
node scripts/fetch-data.js

# Run benchmark strategies
node scripts/run-benchmarks.js

# Launch autonomous research (30 experiments)
node scripts/run-autoresearch.js --max 30

# Run persistent daemon (auto-iterates, auto-commits)
node scripts/daemon.js --batch 15 --model claude-sonnet-4.5 --target 10.0

# Run tests (45/45)
npm test
```

## Modules (14 Source Files)

| Module | File | Purpose |
|--------|------|---------|
| **Controller** | `src/controller.js` | AutoResearch loop — mutate → backtest → keep/revert → learn |
| **Backtest Engine** | `src/backtest.js` | Full backtester with fee model, composite scoring, drawdown tracking |
| **Indicators** | `src/indicators.js` | 10 pure-math indicators (RSI, MACD, BB, ATR, VWAP, Stochastic, OBV, EMA, Williams %R, Percentile Rank) |
| **Regime Detection** | `src/regime.js` | Market regime classifier — Hurst exponent, trend strength, volatility ranking |
| **LCM Memory** | `src/memory.js` | Experiment logging, pattern queries, session-persistent learning |
| **Data Layer** | `src/data.js` | Historical data loading for 4 Base DEX pairs |
| **Data Feed** | `src/datafeed.js` | Production multi-source data pipeline (DeFiLlama + CoinGecko + Base RPC) |
| **Execution Engine** | `src/executor.js` | Live trading via Bankr — risk management, position sizing, paper/live modes |
| **Bankr Integration** | `src/bankr.js` | Bankr LLM Gateway for mutations + wallet for live execution |
| **Reporter** | `src/reporter.js` | Batch reports, final summaries, Discord/Telegram formatting |
| **Pair Discovery** | `src/discovery.js` | Manual pair add/remove + auto-scan top Base DEX pools by TVL |
| **Config** | `src/config.js` | Centralized configuration, model selection, thresholds |
| **Daemon** | `scripts/daemon.js` | Persistent autonomous runner — batch experiments, auto-sync, credit tracking |
| **Report Generator** | `scripts/report.js` | Human-readable reports (Markdown + styled HTML) |
| **Entry Point** | `src/index.js` | Public API — all exports for skill/library usage |

## Scoring System

Each strategy is scored with a composite metric designed to reward consistent, risk-adjusted returns:

```
score = sharpe × √(min(trades/50, 1.0)) − drawdown_penalty − turnover_penalty
```

- **Sharpe ratio** — risk-adjusted return (higher = better)
- **Trade activity factor** — penalizes strategies that avoid trading (√ scaling)
- **Drawdown penalty** — penalizes deep equity drawdowns
- **Turnover penalty** — penalizes excessive churn (commission drag)

## Benchmark Results

### Real Data (CoinGecko — 703 hourly candles per pair, 4 Base DEX pairs)

| Strategy | Score | Return % | Max DD | Trades | Era |
|----------|-------|----------|--------|--------|-----|
| **Dual-Regime Portfolio (exp199)** | **8.176** | **+10.7%** | **2.2%** | **134** | **LLM Daemon** |
| Dynamic Breakout Lookback (exp183) | 7.991 | +10.7% | 3.2% | 96 | LLM Daemon |
| Adaptive Profit Targets (exp180) | 7.875 | +10.7% | 3.4% | — | LLM Daemon |
| ATR Percentile Filter (exp170) | 7.327 | — | — | — | LLM Daemon |
| Pure Trend Breakout (exp163) | 5.310 | — | 5.1% | 102 | LLM Daemon |
| Ensemble Voting (exp161) | 4.512 | +6.2% | 3.3% | 84 | Manual Structural |
| Multi-TF Trend Filter (exp151) | 3.777 | +5.6% | — | 69 | LLM Daemon |
| ATR Trail Tightening (exp128) | 3.668 | +5.6% | 9.3% | 42 | LLM Daemon |
| Adaptive Trend-Following (exp117) | 2.838 | +5.6% | 5.9% | 65 | Manual Structural |
| VWAP Best (exp074, synthetic) | 0.740 | +8.6% | 14.2% | 55 | LLM (Bankr) |
| VWAP Baseline | 0.421 | +1.8% | 5.8% | 55 | Manual |
| VWAP on Real Data | -1.460 | -6.0% | 16.1% | 127 | — (overfit) |

### Score Evolution: 0.421 → 8.176 (+1,842%)

```
Score
8.18 ┤                                                          ★ exp199 (dual-regime)
7.99 ┤                                                     ● exp183 (dynamic lookback)
7.88 ┤                                                ● exp180 (adaptive profit)
7.33 ┤                                          ● exp170 (ATR percentile)
5.31 ┤                                   ● exp163 (pure breakout)
4.51 ┤                             ● exp161 (ensemble voting)
3.78 ┤                        ● exp151 (multi-TF filter)
3.67 ┤                      ● exp128 (ATR trail)
2.84 ┤               ● exp117 (trend-following redesign)
0.74 ┤        ● exp074 (VWAP tuned)
0.42 ┤  ● baseline
     └────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───
          0    25    50    75   100   125   150   175   200   222
                              Experiment #
```

### Four Strategy Eras

The agent progressed through four distinct architectural eras — each required structural redesign, not just parameter tuning:

1. **VWAP Mean-Reversion** (exp1-74, score 0.42→0.74) — Classic mean-reversion on synthetic data. Peaked at 0.74, collapsed to -1.46 on real data. Textbook overfitting.

2. **Adaptive Trend-Following** (exp117, score 2.84) — Complete redesign: Donchian breakout + EMA trend filter + RSI dip-buying + ATR trailing stops. First strategy profitable on real data.

3. **Ensemble Voting** (exp161, score 4.51) — 3 independent sub-strategies (Donchian, RSI dip-buy, MACD momentum) vote independently. 2+ votes required. Conviction-weighted sizing.

4. **Dual-Regime Portfolio** (exp163-199, score 5.31→8.18) — LLM-discovered improvements: pure breakout → ATR percentile filter → adaptive profit targets → dynamic lookback → dual-strategy Hurst allocation. Two parallel strategies (trend breakout + mean-reversion) with Hurst exponent capital allocation.

## Experiment History — All Kept Experiments

222 total experiments across 12+ hours of autonomous iteration. 55 kept, 167 reverted (24.8% hit rate).

### Era 1: VWAP Parameter Tuning (synthetic data, claude-haiku-4.5 via Bankr)

| Exp | Hypothesis | Score | Insight |
|-----|-----------|-------|---------|
| exp004 | deviation 0.02→0.03 | 0.486 | Wider threshold catches bigger moves |
| exp037 | ATR period 14→7 | 0.615 | Faster ATR improves position sizing |
| exp053 | exitThreshold 0.01→0.015 | 0.671 | Hold longer, catch full mean-reversion |
| exp065 | deviationThreshold 0.025→0.022 | 0.714 | Earlier entries at tighter threshold |
| exp070 | RSI period 14→10 | 0.726 | Faster RSI = better entry timing |
| exp074 | ATR period 7→5 | 0.740 | Most responsive volatility scaling |

### Era 2: Real Data Redesign (manual structural change)

| Exp | Hypothesis | Score | Insight |
|-----|-----------|-------|---------|
| exp117 | Complete redesign: Donchian + EMA + RSI + ATR trailing | 2.838 | **VWAP was overfit. Trend-following works on real data.** |

### Era 3: LLM Daemon Evolution (claude-sonnet-4.5 via Bankr, autonomous)

| Exp | Hypothesis | Score | Insight |
|-----|-----------|-------|---------|
| exp126 | Regime-based position sizing (Hurst exponent) | 2.919 | Increase exposure in trending regimes |
| exp128 | ATR trail multiple 2.0→1.5 | 3.668 | Tighter trailing stops = Sharpe 4.002 |
| exp137 | ROC momentum + ATR profit-taking exit | 3.741 | Simplified regime detection, DD 9.3%→7.1% |
| exp151 | Multi-TF trend filter (50-EMA slope) | 3.777 | Filters counter-trend trades |

### Era 3.5: Manual Structural Break (ensemble voting)

| Exp | Hypothesis | Score | Insight |
|-----|-----------|-------|---------|
| exp161 | Ensemble voting (Donchian + RSI + MACD) + macro filter | 4.512 | **+19.4% — 3 sub-strategies vote, 2+ required** |

### Era 4: Daemon Discovers Structural Improvements

After the ensemble broke the 3.78 ceiling, the daemon's mutation prompt was overhauled to force structural thinking. Auto-escalation plateau detector (3 tiers) bans parameter tweaks after 5+ consecutive failures.

| Exp | Hypothesis | Score | Insight |
|-----|-----------|-------|---------|
| exp163 | Pure trend-following breakout (stripped mean-reversion) | 5.310 | Simpler is better — focus on what works |
| exp170 | ATR percentile filter (60th pctl vs raw ATR>SMA) | 7.327 | **+38% — quality filter beats moving average** |
| exp180 | Adaptive profit targets (2x ATR weak, 4x ATR strong trend) | 7.875 | Scale exits with conviction |
| exp183 | Dynamic breakout lookback (15/25 by vol regime) | 7.991 | Adapt entry sensitivity to market state |
| exp199 | **Dual-strategy Hurst portfolio (breakout + mean-reversion)** | **8.176** | **Run 2 strategies in parallel, allocate by regime** |

### Key Insights from 222 Experiments

1. **Overfitting is real.** VWAP scored 0.74 on synthetic data, -1.46 on real data. Always test on real data.
2. **LLMs excel at parameter tuning** but struggle with structural innovation. The daemon found 5.31→8.18 through incremental improvements, but the 0.74→2.84 and 3.78→4.51 jumps required human-directed structural redesign.
3. **Auto-escalation works.** Banning parameter tweaks after plateaus forced the LLM to discover ATR percentile filtering (the biggest single improvement).
4. **Exit logic > entry logic.** Most failed experiments modified entries. Most kept experiments modified exits.
5. **Simpler beats complex.** The ensemble (exp161, 3 strategies) was beaten by pure trend-following (exp163) that stripped it back to one clean signal.

## Strategy Interface

```javascript
import { rsi, ema, bollingerBands, vwap, atr } from '../src/indicators.js';

export class Strategy {
  onBar(barData, portfolio) {
    // barData['ETH/USDC'].history → 500+ hourly candles
    // portfolio.cash, portfolio.positions, totalEquity
    return [{ pair: 'ETH/USDC', targetPosition: 10000 }];
  }
}
```

## LCM Memory Integration

Every experiment is logged in a format LCM can index and query:

```
[2026-03-21T18:00:00Z] ✓ KEPT exp004: deviation 0.02→0.03 → score=0.486 sharpe=0.716 dd=4.7%
[2026-03-21T18:02:00Z] ✗ REVERTED exp005: cooldown 3→2 → score=0.486 (no improvement)
```

Before each mutation, the agent queries its history:
- "What RSI periods have we tried? Which improved Sharpe?"
- "What deviation thresholds were tested? What's the optimal range?"
- "Which structural changes (new indicators, multi-timeframe) haven't been explored yet?"

This makes the research loop **convergent** — the agent avoids re-testing failed ideas and focuses on unexplored territory.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTORESEARCH_MODEL` | LLM for mutation proposals | `claude-sonnet-4-6` |
| `BANKR_API_KEY` | Bankr LLM Gateway key | — |
| `UNISWAP_API_KEY` | Uniswap Developer Platform API key | — |
| `BASE_RPC_URL` | Base RPC endpoint | `mainnet.base.org` |
| `MAX_EXPERIMENTS` | Experiments per run | `30` |
| `REPORT_EVERY` | Report interval | `5` |

## OpenClaw Integration

### As a Skill
```bash
# Install as OpenClaw skill
cp -r autoresearch ~/.openclaw/skills/autoresearch

# Use in chat
"Run 30 autoresearch experiments and report to #autoresearch-lab"
```

### As a Cron Job
```javascript
// Every 6 hours: run 10 experiments autonomously
{
  schedule: { kind: "every", everyMs: 21600000 },
  payload: { kind: "agentTurn", message: "Run 10 autoresearch experiments, report results" }
}
```

## Bankr Compatibility

- **LLM Gateway** (`llm.bankr.bot`) — mutation proposals via Bankr-funded models
- **Live Execution** — optional trade execution via Bankr wallet
- **Portfolio Integration** — compatible with `@darksol/bankr-router` for routing
- **Skill Install** — `darksol skills install autoresearch`

## Production Roadmap

- [x] **Phase 1:** Core engine — backtest, indicators, scoring, memory ✅
- [x] **Phase 2:** Benchmark suite — 3 baseline strategies ✅
- [x] **Phase 3:** Autonomous research loop — mutation → test → learn ✅
- [x] **Phase 4:** LCM memory — persistent cross-session learning ✅
- [x] **Phase 5:** Bankr LLM Gateway for mutations — **LIVE** (claude-haiku-4.5 → claude-sonnet-4.5, 117+ experiments) ✅
- [x] **Phase 6:** Regime-aware adaptive strategy (Hurst exponent + EMA trend + ATR volatility) ✅
- [x] **Phase 7:** Production execution engine with Bankr swap integration ✅
- [x] **Phase 8:** Multi-source real data feed (DeFiLlama + CoinGecko + Base RPC) ✅
- [x] **Phase 9:** Uniswap Developer Platform API integration ✅
- [x] **Phase 10:** Persistent live trading daemon — **RUNNING** (cron, 15 experiments/hour, auto-sync) ✅
- [x] **Phase 11:** Demo video + Synthesis Hackathon submission published ✅
- [ ] **Phase 12:** Multi-strategy tournament mode

## Prize Tracks

| Track | Why We Qualify |
|-------|----------------|
| **Open Track** | Full autonomous research system — AI discovers trading strategies, not just executes them |
| **Let the Agent Cook** | Fully autonomous 75-experiment loop — zero human intervention, LLM-driven mutations, self-improving |
| **Best Bankr LLM Gateway Use** | Core dependency — claude-haiku-4.5 via Bankr Gateway generates every strategy mutation. 30 live experiments consumed real Bankr credits. Bankr wallet is the execution layer for live trades. |
| **Agentic Finance / Best Uniswap API Integration** | Integrated Uniswap Developer Platform API key for pool data access. Backtests against real Uniswap V3 Base pools (ETH/USDC 0.05%, ETH/USDC 0.3%, cbETH/WETH). Multi-source data pipeline with Uniswap V3 subgraph, DeFiLlama, and CoinGecko fallback. Strategy discovers optimal DEX trading parameters autonomously. |
| **Autonomous Trading Agent (Base)** | Novel approach — AI-discovered strategies vs hand-coded rules. Production execution engine with risk management, live Bankr swaps on Base |
| **Agent Services on Base** | Installable as OpenClaw skill + Bankr-compatible service. Other agents can import and run autoresearch |

### Bankr Integration Depth

AutoResearch uses Bankr at **three layers**:

1. **LLM Gateway** — Every strategy mutation is generated by `claude-haiku-4.5` via `llm.bankr.bot`. The system prompt engineers reliable code generation (13% hit rate, 4/30 kept).
2. **Wallet Execution** — Live trades execute as natural language swap commands sent to Bankr LLM, which routes to Base DEX (Uniswap V3, Aerodrome).
3. **Balance Tracking** — Portfolio state syncs from Bankr wallet for position sizing and risk limits.

```javascript
// How Bankr powers the mutation loop
const response = await fetch('https://llm.bankr.bot/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${BANKR_API_KEY}` },
  body: JSON.stringify({
    model: 'claude-haiku-4.5',
    messages: [
      { role: 'system', content: 'Generate ONE strategy mutation...' },
      { role: 'user', content: mutationPrompt }
    ]
  })
});

// How Bankr powers live execution
await callLLM(`Swap 0.1 ETH to USDC on Base with max 0.5% slippage`);
```

### Live Trade Proof

First live trade executed via Bankr on Base:

```
Swap 1 USDC → 0.000464 ETH on Base
TX: 0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8
```
[Verify on Basescan →](https://basescan.org/tx/0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8)

## Dependencies

| Package | Purpose |
|---------|---------|
| None (zero runtime deps) | Pure Node.js — indicators, backtest, memory all self-contained |
| `@darksol/terminal` (optional) | Live trading execution via DARKSOL CLI |
| `@darksol/bankr-router` (optional) | Smart LLM routing for mutation proposals |

## Human-Agent Collaboration

Built through continuous collaboration between **Meta** (human) and **Darksol** (AI agent on [OpenClaw](https://openclaw.ai)). The agent designed the architecture, implemented all modules, ran experiments, and learned from results — all in real-time conversation.

**Agent harness**: OpenClaw
**Primary model**: Claude Opus (claude-opus-4-6)
**Mutation model**: Claude Sonnet / Bankr Gateway

## Pair Management

Pairs can be managed manually or discovered automatically from on-chain data. Custom pairs persist to `data/custom-pairs.json` and are automatically included in backtests.

```bash
# List all active pairs (built-in + custom)
node scripts/pairs.js list

# Add a custom pair
node scripts/pairs.js add "DEGEN/WETH" 0x4ed4e862860bed51a9570b96d89af5e1b0efefed 0x4200000000000000000000000000000000000006 uniswap 3000

# Remove a custom pair
node scripts/pairs.js remove "DEGEN/WETH"

# Scan top Base DEX pools by TVL (preview)
node scripts/pairs.js discover

# Auto-discover and add top pools
node scripts/pairs.js auto --max 5 --min-tvl 1000000
```

**Programmatic API:**
```javascript
import { addPair, removePair, listPairs, autoDiscoverAndAdd } from './src/discovery.js';

// Add any Base DEX pair on the fly
addPair({ name: 'VIRTUAL/WETH', token0: '0x0b3e...', token1: '0x4200...', dex: 'uniswap', fee: 3000 });

// Auto-scan top Uniswap V3 pools and add missing ones
const result = await autoDiscoverAndAdd({ minTvlUsd: 500_000, maxNewPairs: 5 });
```

## Report Generation

Generate comprehensive human-readable reports from experiment history. Supports Markdown and styled HTML output.

```bash
# Full report to stdout
node scripts/report.js

# Save as Markdown
node scripts/report.js --out docs/REPORT.md

# Save as styled HTML (dark theme, viewable in browser)
node scripts/report.js --html docs/report.html

# Top N experiments + pair filter
node scripts/report.js --top 20 --pair ETH/USDC
```

**Report sections:**
- 📊 Summary card (score, Sharpe, return, drawdown, win rate)
- 📈 Strategy evolution timeline (every kept experiment with score deltas)
- 📉 ASCII score progression chart
- 💹 Per-pair breakdown (when available)
- ⚙️ Current strategy parameters (auto-extracted from code)
- 🔧 Active trading pairs (built-in + custom)
- 🏆 Top N experiments ranked by score
- ❌ Failure pattern analysis (last 10 rejected experiments)
- 🔩 Full configuration dump

## Live Execution

```bash
# Paper trading (default — tests strategy with real market data)
node scripts/run-live.js

# Paper trading with regime-aware strategy
node scripts/run-live.js --regime

# Live execution via Bankr wallet (real trades on Base)
node scripts/run-live.js --live --regime --cycles 24

# Custom interval (seconds between cycles)
node scripts/run-live.js --interval 1800 --cycles 48
```

**Risk Management Built In:**
- Max 15% of portfolio per position
- 5% daily loss limit (auto-halt)
- Per-trade size caps ($500 paper, $50 live default)
- Pair allowlist (ETH/USDC, AERO/USDC, cbETH/WETH only)
- Position clamping against real Bankr balance

## Regime Detection

The system identifies 5 market regimes and adapts strategy behavior:

| Regime | Detection Method | Strategy Behavior |
|--------|-----------------|-------------------|
| **Trending Up** | EMA(20)/EMA(50) crossover + Hurst > 0.6 | Momentum following (EMA cross entries) |
| **Trending Down** | EMA crossover bearish + negative slope | Short momentum, tighter stops |
| **Mean Reverting** | Hurst < 0.4 + low trend score | VWAP reversion (proven 0.74 core) |
| **High Volatility** | ATR > 80th percentile | Reduced position size (50%), wider thresholds |
| **Low Volatility** | ATR < 20th percentile | Sit out (no edge, save on fees) |

The Hurst exponent is estimated via Rescaled Range (R/S) analysis over the last 100 bars. Values < 0.5 indicate mean-reverting markets, > 0.5 indicates trending.

## Stats

| Metric | Value |
|--------|-------|
| Source modules | 14 |
| Indicators | 10 |
| Tests | 45/45 passing |
| Runtime dependencies | 0 |
| Experiments run | 222 (55 kept, 167 reverted) |
| Best score (real data) | **8.176** (exp199 — dual-regime portfolio, +10.7% return, 2.2% max DD) |
| Best score vs baseline | **+1,842%** improvement (0.421 → 8.176) |
| Strategy eras | 4 (VWAP → trend-following → ensemble → dual-regime) |
| Bankr LLM credits spent | ~$0.70 |
| Base DEX pairs | 4 (+ custom pair discovery) |
| Data sources | 3 (DeFiLlama + CoinGecko + synthetic fallback) |
| Daemon runs | 12+ autonomous batches |

## Related — Synthesis Agent (Submission #1)

This is DARKSOL's **second Synthesis Hackathon submission**. Our first:

- **[Synthesis Agent](https://github.com/darks0l/synthesis-agent)** — Autonomous agent economy orchestrator. Trades, evaluates markets with AI, pays its own LLM bills, outsources skills to other agents via ERC-8183 on-chain escrow. 16 modules, 62 tests, 5 deployed contracts, 10+ on-chain transactions.

AutoResearch complements Synthesis Agent: where Synthesis Agent **executes** strategies, AutoResearch **discovers** them.

## Testing

```bash
npm test
# 45 tests, 0 failures, ~150ms

# Test suites:
# - indicators.test.js — 10 indicator unit tests
# - backtest.test.js — backtester with scoring validation
# - regime.test.js — regime detection (trend, volatility, Hurst, combined)
# - executor.test.js — execution engine (paper trades, risk limits, state tracking)
# - discovery.test.js — pair management (add, remove, deduplicate, persist)
```

## Inspiration & Acknowledgments

- **[Andrej Karpathy — autoresearch](https://github.com/karpathy/autoresearch)** — The original concept: give an AI agent a training setup and let it experiment autonomously overnight. Karpathy's system modifies `train.py`, trains for 5 minutes, keeps or discards, and repeats. We adapted this loop from LLM training to **DEX trading strategy discovery** — same philosophy (mutate → evaluate → keep/revert → learn), different domain.

  > *"One day, frontier AI research used to be done by meat computers in between eating, sleeping, having other fun... That era is long gone."* — @karpathy, March 2026

- **[OpenClaw — Lossless Context Management (LCM)](https://github.com/openclaw/openclaw)** — The memory system that makes our research loop convergent instead of random. LCM provides DAG-based conversation summarization that preserves every detail losslessly. We use it to give the agent **persistent cross-session memory of all experiments** — the agent queries what worked, what failed, and what parameter ranges are exhausted before proposing mutations. Without LCM, each session would start from scratch.

## Submission Documentation

| Document | Description |
|----------|-------------|
| [Build Log](docs/BUILD_LOG.md) | Full development timeline with timestamps |
| [Conversation Log](docs/CONVERSATION_LOG.md) | Complete human-agent collaboration record |
| [Test Results](docs/TEST_RESULTS.md) | Full test output — 45/45 passing |
| [On-Chain Receipts](docs/ON_CHAIN_RECEIPTS.md) | Verified Basescan TX + Bankr LLM credit usage |
| [Experiment Index](docs/EXPERIMENT_INDEX.md) | All experiments with scores and status |
| [Strategy Report](docs/REPORT.md) | Full human-readable report (run `node scripts/report.js`) |

## License

MIT

---

Built with teeth. 🌑
