<p align="center">
  <img src="assets/darksol-banner.png" alt="DARKSOL" width="600" />
</p>
<h3 align="center">Built by DARKSOL 🌑</h3>

[![npm version](https://img.shields.io/badge/npm-v0.1.0-blue)](https://www.npmjs.com/package/@darksol/autoresearch)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-17%20passing-brightgreen)](test/)

# @darksol/autoresearch

**Autonomous trading strategy discovery for Base DEX** — Karpathy-style autoresearch with LCM (Lossless Context Management) memory integration.

An AI agent iteratively mutates a single strategy file, backtests each change against historical Uniswap V3 + Aerodrome data on Base, and keeps only improvements. The agent learns from its experiment history using LCM, making each mutation smarter than the last.

## Features

- 🔬 **Autonomous Research Loop** — mutate → backtest → keep/revert → learn → repeat
- 🧠 **LCM Memory** — agent remembers every experiment across sessions, queries patterns
- 📊 **10 Technical Indicators** — RSI, MACD, Bollinger Bands, ATR, VWAP, and more
- ⚡ **Base DEX Native** — Uniswap V3 + Aerodrome pools on Base
- 🏦 **Bankr Compatible** — LLM Gateway for mutations, wallet for live execution
- 🐾 **OpenClaw Skill** — runs as a native OpenClaw skill with Discord/Telegram reporting
- 📈 **Scoring System** — Sharpe-based composite score with drawdown/turnover penalties
- 🧪 **17 Tests** — comprehensive test suite (node:test, zero dependencies)

## Quick Start

```bash
git clone https://github.com/darks0l/autoresearch.git
cd autoresearch

# Fetch historical data
node scripts/fetch-data.js

# Run benchmarks
node scripts/run-benchmarks.js

# Launch autonomous research (50 experiments)
node scripts/run-autoresearch.js --max 50
```

## How It Works

```
┌─────────────────────────────────────────────┐
│           AutoResearch Loop                  │
│                                              │
│  1. Read strategy.js + score history         │
│  2. Query LCM: "what worked? what failed?"   │
│  3. LLM proposes ONE mutation                │
│  4. Backtest against Base DEX data           │
│  5. Score improved? → KEEP (commit + log)    │
│     Score worse?    → REVERT (log failure)   │
│  6. Repeat (smarter each iteration)          │
└─────────────────────────────────────────────┘
```

The key innovation: **LCM memory makes the agent learn from its own research history.** Instead of blind mutations, the agent queries what parameter ranges work, what signal combinations improve Sharpe, and what approaches consistently fail.

## Benchmark Results

| Strategy | Score | Sharpe | Return % | Max DD | Trades |
|----------|-------|--------|----------|--------|--------|
| VWAP Reversion | 0.421 | 0.421 | +1.8% | 5.8% | 55 |
| Mean Reversion | -4.24 | -4.08 | -16.8% | 18.1% | 1958 |
| Momentum | -999 | -16.4 | -88.3% | 88.3% | 7278 |

*Baseline to beat: 0.421 (VWAP Reversion)*

## Strategy Interface

```javascript
import { rsi, ema, bollingerBands } from '../src/indicators.js';

export class Strategy {
  onBar(barData, portfolio) {
    // barData['ETH/USDC'].history → 500 hourly bars
    // portfolio.cash, portfolio.positions
    return [{ pair: 'ETH/USDC', targetPosition: 10000 }];
  }
}
```

## LCM Memory

Every experiment is logged in a format LCM can index:

```
[2026-03-21T18:00:00Z] ✓ KEPT exp042: RSI period 8 instead of 14 → score=8.4 sharpe=8.8 dd=3.1%
[2026-03-21T18:02:00Z] ✗ REVERTED exp043: Add MACD crossover signal → score=-2.1 sharpe=-2.1 dd=12%
```

The agent queries this history before each mutation:
- "What RSI periods have we tried?"
- "Which signal combinations improved Sharpe?"
- "What approaches consistently failed?"

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTORESEARCH_MODEL` | LLM for mutations | claude-sonnet-4-6 |
| `BANKR_API_KEY` | Bankr LLM Gateway key | — |
| `BASE_RPC_URL` | Base RPC endpoint | mainnet.base.org |

## OpenClaw Integration

### As a Skill
```
# Install
cp -r autoresearch-skill ~/.openclaw/skills/autoresearch

# Use in chat
"Run 50 autoresearch experiments and report to #autoresearch-lab"
```

### As a Cron Job
```javascript
// Every 6 hours: run 10 experiments
{
  schedule: { kind: "every", everyMs: 21600000 },
  payload: { kind: "agentTurn", message: "Run 10 autoresearch experiments, report results" }
}
```

## Bankr Compatibility

- Uses Bankr LLM Gateway (`llm.bankr.bot`) for strategy mutations
- Optional live execution via Bankr wallet
- Compatible with `@darksol/bankr-router` for portfolio integration
- Installable via `darksol skills install autoresearch`

## Testing

```bash
node --test test/*.test.js
# 17 tests, 0 failures
```

## License

MIT

---

Built with teeth. 🌑
