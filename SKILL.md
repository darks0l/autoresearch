# AutoResearch — Autonomous Trading Strategy Discovery

> Karpathy-style autoresearch for Base DEX. Iteratively mutates, backtests, and evolves trading strategies using LCM memory. Uniswap V3 + Aerodrome on Base.

## What This Does

An AI agent autonomously:
1. **Reads** the current trading strategy and its performance history
2. **Queries memory** (LCM) to understand what worked, what failed, and why
3. **Proposes a mutation** — one atomic change to `strategies/strategy.js`
4. **Backtests** the change against historical Base DEX data
5. **Keeps improvements, reverts failures** — logging everything to memory
6. **Repeats** — each cycle gets smarter by learning from its experiment history

One file changes. Everything else stays locked. The git history becomes your experiment log.

## Quick Start

```bash
# 1. Fetch historical data
node scripts/fetch-data.js

# 2. Run benchmarks to see baseline scores
node scripts/run-benchmarks.js

# 3. Launch autonomous research (50 experiments)
node scripts/run-autoresearch.js --max 50

# 4. Run a single backtest on current strategy
node src/backtest.js
```

## Strategy Interface

Your strategy must implement a `Strategy` class with an `onBar()` method:

```javascript
import { rsi, ema, bollingerBands, atr, vwap, roc } from '../src/indicators.js';

export class Strategy {
  constructor() {
    // Initialize parameters and state
  }

  onBar(barData, portfolio) {
    // barData: { 'ETH/USDC': { open, high, low, close, volume, history: [...500 bars] } }
    // portfolio: { cash: number, positions: { pair: signedUsdNotional } }
    // Return: [{ pair, targetPosition, orderType? }]
    return [];
  }
}
```

## Available Indicators

All from `src/indicators.js` — pure math, no dependencies:

| Indicator | Function | Default Period |
|-----------|----------|---------------|
| Simple Moving Average | `sma(values, period)` | — |
| Exponential Moving Average | `ema(values, period)` | — |
| Relative Strength Index | `rsi(closes, period)` | 14 |
| MACD | `macd(closes, fast, slow, signal)` | 12/26/9 |
| Bollinger Bands | `bollingerBands(closes, period, stdDev)` | 20/2 |
| Average True Range | `atr(highs, lows, closes, period)` | 14 |
| VWAP | `vwap(closes, volumes, period)` | 20 |
| Rate of Change | `roc(values, period)` | 10 |
| Standard Deviation | `stddev(values, period)` | 20 |
| Percentile Rank | `percentileRank(values, period)` | 100 |

## Scoring

```
score = sharpe × √(min(trades/50, 1.0)) − drawdown_penalty − turnover_penalty
```

| Component | Formula |
|-----------|---------|
| Sharpe | `mean(daily_returns) / std(daily_returns) × √365` |
| Drawdown penalty | `max(0, max_drawdown_pct − 15) × 0.05` |
| Turnover penalty | `max(0, annual_turnover/capital − 500) × 0.001` |
| Hard cutoffs (→ −999) | Fewer than 10 trades, drawdown > 50%, lost > 50% |

## Data

- **Pairs:** ETH/USDC, ETH/USDC-30, cbETH/WETH, AERO/USDC
- **DEXes:** Uniswap V3 (Base), Aerodrome
- **Interval:** Hourly candles
- **History:** 500 bars per pair per bar
- **Validation:** Jul 2024 – Mar 2025
- **Fee model:** 2-5 bps maker/taker + 1-3 bps slippage (varies by pool)

## LCM Memory Integration

The experiment memory layer logs every experiment in a format LCM can index:

- `data/experiments/index.json` — master index with scores and summaries
- `data/experiments/expNNN.json` — full record per experiment
- `data/experiments/experiment-log.md` — human-readable log (LCM-indexable)

**Agent queries:**
- `getExperimentSummary()` — concise history for mutation prompts
- `getPatternInsights()` — what parameter ranges work, common failure themes
- `queryExperiments({ query, keptOnly, minScore })` — filtered search

The agent uses this memory to avoid repeating failed experiments and build on successful patterns.

## Bankr Compatibility

This skill is compatible with the Bankr ecosystem:

- **LLM Gateway:** Uses `llm.bankr.bot` for strategy mutations (when credits available)
- **Wallet Integration:** Optional live execution via Bankr wallet
- **Portfolio Sync:** Reads Bankr wallet state for position tracking
- **Skill Format:** Installable via `darksol skills install autoresearch`

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BANKR_API_KEY` | Bankr API key for LLM + wallet | No |
| `BANKR_WALLET` | Bankr wallet address | No |
| `BASE_RPC_URL` | Base RPC endpoint | No (defaults to mainnet.base.org) |
| `AUTORESEARCH_MODEL` | LLM model for mutations | No (defaults to claude-sonnet-4-6) |

## OpenClaw Integration

### As a Skill
Drop this folder into your OpenClaw skills directory. The agent can:
- Run `node scripts/run-autoresearch.js` to start autonomous research
- Use `runExperiment()` for single experiments within chat
- Query `getExperimentSummary()` to review progress
- Call `formatFinalReport()` for Discord/Telegram reports

### As a Cron Job
Schedule periodic research sessions:
```
"Run 10 autoresearch experiments on the Base DEX strategy, report results to #autoresearch-lab"
```

### Sub-Agent Pattern
Spawn a sub-agent for long-running research:
```javascript
sessions_spawn({
  task: "Run 50 autoresearch experiments. After each batch of 5, report to #autoresearch-lab.",
  mode: "run"
})
```

## File Structure

```
autoresearch-skill/
├── SKILL.md              ← You are here
├── package.json
├── src/
│   ├── index.js          # Main exports
│   ├── config.js         # Configuration
│   ├── indicators.js     # Technical indicators (10 functions)
│   ├── data.js           # OHLCV data fetcher (subgraph + CoinGecko + synthetic)
│   ├── backtest.js       # Backtest engine with scoring
│   ├── controller.js     # Autoresearch loop orchestrator
│   ├── memory.js         # LCM experiment memory layer
│   ├── bankr.js          # Bankr wallet/LLM integration
│   └── reporter.js       # Discord/Telegram reporting
├── strategies/
│   ├── strategy.js       # THE mutable file (agent modifies only this)
│   └── benchmarks/       # Reference strategies to beat
├── data/
│   ├── cache/            # Cached OHLCV data
│   └── experiments/      # Experiment logs
├── test/                 # 17 tests (node:test)
└── scripts/
    ├── fetch-data.js     # Download historical data
    ├── run-benchmarks.js # Compare all strategies
    └── run-autoresearch.js # Launch autonomous loop
```

## Core Mandate

**Track up. Iterate. Document.**

This is not a one-shot tool. AutoResearch exists to continuously improve:

1. **Track up** — Every change must beat the current best score. No lateral moves, no "interesting but worse." The number goes up or the change reverts.
2. **Iterate** — Run experiments in batches. When parameter tuning plateaus, make **structural changes** (new strategy architectures, new signal sources, ensemble methods). The daemon handles parameter tuning; the agent handles architectural evolution.
3. **Document** — Every experiment is logged. Every structural change is documented in BUILD_LOG.md and CONVERSATION_LOG.md. The git history IS the experiment log. Future agents can read the full evolution chain.

### Self-Improvement Protocol (Auto-Escalation)

The controller has built-in plateau detection that automatically escalates mutation strategy when the system gets stuck. This is critical — without it, the LLM will endlessly propose small parameter tweaks that can never break through an architectural ceiling.

**Three tiers, automatic escalation:**

| Tier | Name | Trigger | Behavior |
|------|------|---------|----------|
| 0 | Explore | Default / after any improvement | Normal mutations — any approach allowed |
| 1 | Structural | 5 consecutive failures | Forces structural changes only. No parameter tweaks. New signal logic, indicator combos, regime-switching, ensemble voting |
| 2 | Architect | 10 consecutive failures | Demands architectural overhaul. Multi-strategy ensemble, cross-pair correlation, regime state machines, complete paradigm shift |

**Auto-reset:** Any successful improvement (score beats best) resets back to tier 0.

**Why this matters:**
Without auto-escalation, a common failure pattern emerges:
1. Strategy reaches a local optimum via parameter tuning
2. LLM keeps proposing parameter tweaks (they're easiest to generate)
3. Every experiment fails because the ceiling is architectural, not parametric
4. Human has to step in and say "try something structural"

The plateau detector eliminates step 4. The system recognizes its own ceiling and automatically shifts the LLM prompt to demand bigger changes.

**Score progression through structural eras (proof it works):**
- Era 1: VWAP mean-reversion → peaked at 0.740 (synthetic), -1.46 (real data)
- Era 2: Adaptive trend-following → peaked at 3.777
- Era 3: Pure breakout + ATR percentile filter → 7.327
- Era 4: Adaptive profit targets + vol-adaptive lookback → 7.991+

Each era required a structural break, not parameter tuning, to advance.

## Out-of-Sample Validation (Required)

**Every strategy MUST be validated before claiming real performance.** In-sample scores are meaningless without out-of-sample proof.

### Validation Flow

```bash
# Run the full validation suite
node scripts/oos-validation.js
```

This runs three phases automatically:

| Phase | What | How |
|-------|------|-----|
| **1. Full baseline** | Confirm in-sample score | Backtest on all cached data |
| **2. Walk-forward split** | 70/30 train/test on same data | Strategy trained on first 70%, tested on last 30% |
| **3. Fresh data** | CoinGecko 30-day OHLC never seen before | Fetch new data, backtest cold |

### Interpreting Results

| Metric | Good | Acceptable | Red Flag |
|--------|------|------------|----------|
| Train→Test degradation | < 20% | 20-50% | > 50% |
| Test Sharpe | > 2.0 | 1.0-2.0 | < 0.5 |
| Fresh data Sharpe | > 1.0 | 0.5-1.0 | < 0 (overfit) |
| Fresh data score | > 0 | Slightly negative | Deeply negative |

### When to Validate

- **After every structural change** (new strategy architecture)
- **After daemon finds new best** (periodically, not every experiment)
- **Before any live trading** (mandatory)
- **Before claiming performance** in reports or submissions

### Building It Into Your Flow

If you're using this skill to discover strategies, the suggested workflow is:

1. **Discover** — Run autoresearch experiments (daemon or manual)
2. **Validate** — Run `oos-validation.js` on every new best score
3. **Iterate** — If validation fails, the strategy is overfit. Force structural changes.
4. **Paper trade** — Run `scripts/run-live.js --paper` on live data for 24-48h
5. **Live trade** — Only after paper trading confirms viability

**The daemon should NOT skip validation.** Bake validation into your reporting: include OOS results alongside in-sample scores.

### Output

Results are saved to:
- `data/oos-validation.json` — machine-readable
- `docs/OOS_VALIDATION.md` — human-readable report

## Rules (for the agent)

1. **Only edit `strategies/strategy.js`** — this is the single mutable file
2. Do not modify `backtest.js`, `data.js`, `indicators.js`, or `benchmarks/`
3. No new dependencies — only what's in `indicators.js` and stdlib
4. Each change = one atomic hypothesis (e.g., "try RSI period 8")
5. Time budget: 120 seconds per backtest
6. Always log experiments to memory before moving on
7. Query experiment history before proposing mutations
8. **When plateaued:** The controller auto-escalates (tier 0→1→2). Trust the plateau detector — it forces structural changes after 5 failures and architectural overhauls after 10. If you're running manually, follow the same pattern.
9. **Always document:** Update BUILD_LOG.md and CONVERSATION_LOG.md on structural changes
10. **Watch for false plateaus:** If the LLM generates broken code (syntax errors, 0 trades) that counts as failures toward escalation. That's intentional — bad code generation IS a signal that the current approach is exhausted.

---

*Built by DARKSOL 🌑 — autonomous strategy discovery for Base DEX*
