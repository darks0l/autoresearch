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

## Rules (for the agent)

1. **Only edit `strategies/strategy.js`** — this is the single mutable file
2. Do not modify `backtest.js`, `data.js`, `indicators.js`, or `benchmarks/`
3. No new dependencies — only what's in `indicators.js` and stdlib
4. Each change = one atomic hypothesis (e.g., "try RSI period 8")
5. Time budget: 120 seconds per backtest
6. Always log experiments to memory before moving on
7. Query experiment history before proposing mutations

---

*Built by DARKSOL 🌑 — autonomous strategy discovery for Base DEX*
