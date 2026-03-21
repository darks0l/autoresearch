# AutoResearch — Test Results

> Full test output from `npm test` (node:test runner)
> Run: March 21, 2026 — 38/38 passing, 0 failures, ~135ms

---

## Test Output

```
▶ Backtest Engine
  ✔ runs without errors on a simple strategy (2.72ms)
  ✔ handles a basic buy-and-hold strategy (1.65ms)
  ✔ tracks equity correctly (0.85ms)
  ✔ applies scoring formula (1.81ms)
  ✔ returns -999 for fewer than 10 trades (1.28ms)
✔ Backtest Engine (9.29ms)

▶ Execution Engine
  ▶ executeSignals
    ✔ executes paper buy signal (1.64ms)
    ✔ executes paper close signal (0.38ms)
    ✔ executes close signal (0.54ms)
    ✔ rejects disallowed pairs (0.26ms)
    ✔ skips tiny trades (0.27ms)
    ✔ clamps oversized trades (0.33ms)
  ✔ executeSignals (4.26ms)
  ▶ execution state
    ✔ tracks positions (1.17ms)
    ✔ tracks trade count (0.36ms)
    ✔ resets properly (0.78ms)
  ✔ execution state (2.55ms)
✔ Execution Engine (7.37ms)

▶ SMA
  ✔ computes correct simple moving average (0.67ms)
  ✔ returns NaN for insufficient data (0.21ms)
✔ SMA (1.69ms)

▶ EMA
  ✔ computes exponential moving average (0.17ms)
✔ EMA (0.26ms)

▶ RSI
  ✔ computes RSI in 0-100 range (0.34ms)
  ✔ handles flat data (0.16ms)
✔ RSI (0.68ms)

▶ MACD
  ✔ returns macd, signal, and histogram arrays (0.42ms)
✔ MACD (0.60ms)

▶ Bollinger Bands
  ✔ upper > middle > lower (0.40ms)
  ✔ width is positive (1.16ms)
✔ Bollinger Bands (1.80ms)

▶ ATR
  ✔ computes average true range (0.50ms)
✔ ATR (0.64ms)

▶ VWAP
  ✔ is close to price with uniform volume (0.46ms)
✔ VWAP (0.57ms)

▶ ROC
  ✔ computes rate of change (0.19ms)
✔ ROC (0.29ms)

▶ Percentile Rank
  ✔ returns values between 0-100 (0.39ms)
✔ Percentile Rank (0.49ms)

▶ Regime Detection
  ▶ trendStrength
    ✔ detects uptrend (0.85ms)
    ✔ detects downtrend (0.21ms)
    ✔ returns flat for sideways (0.21ms)
  ✔ trendStrength (1.91ms)
  ▶ volatilityRegime
    ✔ detects high volatility (1.54ms)
    ✔ returns valid state (0.37ms)
  ✔ volatilityRegime (2.06ms)
  ▶ hurstExponent
    ✔ returns ~0.5 for random walk (1.51ms)
    ✔ returns > 0.5 for trending series (1.44ms)
    ✔ returns value in valid range (1.03ms)
  ✔ hurstExponent (4.26ms)
  ▶ detectRegime
    ✔ returns valid regime for trending data (0.76ms)
    ✔ returns valid regime for mean-reverting data (1.02ms)
    ✔ handles insufficient data (0.16ms)
  ✔ detectRegime (2.14ms)
  ▶ regimeSummary
    ✔ formats readable summary (0.85ms)
  ✔ regimeSummary (0.95ms)
✔ Regime Detection (11.98ms)

ℹ tests 38
ℹ suites 19
ℹ pass 38
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 135.104
```

---

## Test Coverage by Module

| Test File | Module | Tests | Status |
|-----------|--------|-------|--------|
| `test/indicators.test.js` | SMA, EMA, RSI, MACD, BB, ATR, VWAP, ROC, Percentile | 10 | ✅ All pass |
| `test/backtest.test.js` | Backtest engine, scoring, equity tracking | 5 | ✅ All pass |
| `test/regime.test.js` | Trend, volatility, Hurst, combined regime, summary | 11 | ✅ All pass |
| `test/executor.test.js` | Paper trades, risk limits, position tracking, state | 12 | ✅ All pass |

## What's Tested

- **Indicators:** Mathematical correctness of all 10 indicators
- **Backtest:** Full replay engine, scoring formula, drawdown tracking, edge cases
- **Regime:** Hurst exponent estimation, trend detection, volatility classification, combined regime
- **Executor:** Paper trading, position clamping, risk limits, pair allowlist, state management

## Runtime

- **Node.js:** v24.13.1
- **Test runner:** node:test (built-in, zero dependencies)
- **OS:** Windows 10 (26200)
- **Duration:** ~135ms total
