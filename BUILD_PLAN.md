# AutoResearch Skill — Build Plan

## Vision
An OpenClaw skill that autonomously discovers, backtests, and evolves trading strategies for Base DEX pairs (Uniswap V3 + Aerodrome). Uses LCM (Lossless Context Management) as experiment memory so the agent learns from its entire research history across sessions.

## Architecture

```
┌──────────────────────────────────────────────┐
│              OpenClaw Agent                    │
│  ┌─────────────────────────────────────────┐  │
│  │         AutoResearch Skill              │  │
│  │                                         │  │
│  │  1. Strategy Mutator (LLM-driven)       │  │
│  │  2. Backtest Engine (historical OHLCV)  │  │
│  │  3. Experiment Logger (LCM + files)     │  │
│  │  4. Evolution Controller (keep/revert)  │  │
│  │  5. Report Generator (Discord/Telegram) │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  Data Layer:                                   │
│  - Historical OHLCV from Base DEX subgraph     │
│  - LCM DAG for experiment memory               │
│  - Git history as experiment log               │
│                                                │
│  Bankr Integration:                            │
│  - Wallet for live execution (optional)        │
│  - LLM Gateway for strategy generation         │
│  - Portfolio tracking                          │
└──────────────────────────────────────────────┘
```

## Components

### 1. Data Fetcher (`src/data.js`)
- Fetch historical OHLCV data for Base DEX pairs
- Uniswap V3 subgraph (ETH/USDC, WETH/USDC, etc.)
- Aerodrome subgraph (volatile + stable pools)
- Cache locally as Parquet or JSON
- Support: 1h, 4h, 1d candles
- Pairs: ETH/USDC, WETH/USDC, cbETH/WETH, AERO/USDC

### 2. Strategy Template (`strategies/strategy.js`)
- Single mutable file (Karpathy pattern)
- `Strategy` class with `onBar(barData, portfolio)` method
- Returns signals: `{ pair, targetPosition, orderType }`
- Access to: OHLCV history (500 bars), portfolio state, funding rates
- Indicators: RSI, MACD, BB, ATR, VWAP, volume profile

### 3. Backtest Engine (`src/backtest.js`)
- Replay historical data through strategy
- Track: PnL, Sharpe ratio, max drawdown, trade count, win rate
- Fee model: Uniswap V3 (0.3%/0.05% tiers), Aerodrome (variable)
- Slippage model: based on pool liquidity depth
- Scoring: `score = sharpe × √(min(trades/50, 1.0)) - drawdown_penalty - turnover_penalty`
- Hard cutoffs: <10 trades, >50% drawdown, >50% loss → score -999

### 4. Experiment Controller (`src/controller.js`)
- The autoresearch loop:
  1. Read current strategy + score history
  2. Query LCM for patterns (what worked, what failed, why)
  3. Generate mutation via LLM (propose change to strategy.js)
  4. Run backtest
  5. If score improved → commit (git + log to LCM)
  6. If worse → revert + log failure reason to LCM
  7. Repeat
- Support parallel branches via sub-agents
- Configurable: max experiments, time budget, score target

### 5. LCM Memory Layer (`src/memory.js`)
- Log every experiment to LCM-compatible format
- Query experiment history: "what RSI periods have we tried?"
- Pattern detection: "which signal combinations improved Sharpe?"
- Cross-session persistence: agent remembers across restarts
- Export experiment DAG as shareable artifact

### 6. Bankr Integration (`src/bankr.js`)
- Optional live execution via Bankr wallet
- Paper trading mode (default) vs live mode
- Use Bankr LLM Gateway for strategy mutation (if credits available)
- Portfolio state sync from Bankr wallet
- Compatible with `@darksol/bankr-router` skill format

### 7. Reporter (`src/reporter.js`)
- Discord/Telegram updates after each experiment batch
- Summary: best score, experiments run, top discoveries
- Charts: score progression, drawdown curve
- Exportable: experiment log as markdown/JSON

## Bankr Skill Compatibility
- SKILL.md follows Bankr skill format
- Installable via `darksol skills install autoresearch`
- Compatible with Bankr router for portfolio integration
- Can be added to Bankr's skills directory via PR

## File Structure
```
autoresearch-skill/
├── SKILL.md                 # OpenClaw + Bankr compatible skill file
├── package.json
├── src/
│   ├── data.js              # Historical OHLCV fetcher (subgraphs)
│   ├── backtest.js          # Backtest engine with scoring
│   ├── controller.js        # Autoresearch loop orchestrator
│   ├── memory.js            # LCM experiment memory layer
│   ├── bankr.js             # Bankr wallet/LLM integration
│   ├── reporter.js          # Discord/Telegram reporting
│   ├── indicators.js        # Technical indicators (RSI, MACD, BB, ATR)
│   └── config.js            # Configuration and defaults
├── strategies/
│   ├── strategy.js          # THE mutable strategy file
│   └── benchmarks/          # Reference strategies to beat
│       ├── momentum.js
│       ├── mean-reversion.js
│       ├── funding-arb.js
│       └── vwap-revert.js
├── data/
│   ├── cache/               # Cached OHLCV data
│   └── experiments/         # Experiment logs (JSON)
├── test/
│   ├── backtest.test.js
│   ├── indicators.test.js
│   └── controller.test.js
└── scripts/
    ├── fetch-data.js        # One-time data download
    ├── run-benchmarks.js    # Compare all reference strategies
    └── run-autoresearch.js  # Launch autonomous loop
```

## Build Phases

### Phase 1: Core Engine (NOW → +2h)
- [x] Project structure
- [ ] Data fetcher (Uniswap V3 + Aerodrome subgraphs)
- [ ] Technical indicators library
- [ ] Backtest engine with scoring
- [ ] Benchmark strategies
- [ ] Strategy template

### Phase 2: AutoResearch Loop (+2h → +4h)
- [ ] Experiment controller (mutate → test → keep/revert)
- [ ] LCM memory integration
- [ ] Git-based experiment tracking
- [ ] First autonomous run (target: 20 experiments)

### Phase 3: Bankr + Reporting (+4h → +6h)
- [ ] Bankr wallet integration
- [ ] Bankr LLM Gateway for mutations
- [ ] Discord reporter
- [ ] SKILL.md (OpenClaw + Bankr compatible)

### Phase 4: Production + Submission (+6h → +8h)
- [ ] Run 50+ autonomous experiments
- [ ] Review and document discoveries
- [ ] README with results table
- [ ] GitHub repo (public, open source)
- [ ] Synthesis hackathon submission (project #2)
- [ ] Bankr PR for skill directory

## Self-Check Schedule (Cron)
- Every 30 min: check experiment progress, log to #autoresearch-lab
- Every 2h: review experiment quality, adjust mutation strategy
- At completion: full report to #autoresearch-lab + #synthesis-hackathon

## Targets
- Beat baseline momentum strategy (target Sharpe > 3.0)
- Run 50+ autonomous experiments
- Demonstrate LCM memory improving mutation quality over time
- Show cross-session persistence (agent picks up where it left off)
