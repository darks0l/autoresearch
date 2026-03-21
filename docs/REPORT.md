# 📊 AutoResearch — Strategy Report
> Generated: 2026-03-21T20:43:02.442Z
> Engine: @darksol/autoresearch | Pairs: 4 | Model: claude-sonnet-4.5

## Summary

| Metric | Value |
|--------|-------|
| Total experiments | **119** |
| Kept / Reverted | 26 ✅ / 93 ❌ |
| Hit rate | 21.8% |
| Best score | **2.838** (baseline) |
| Best Sharpe | 2.838 |
| Total return | N/A% |
| Max drawdown | N/A% |
| Trades | N/A |
| Win rate | N/A% |
| Score target | 20 |

## Strategy Evolution

Each row is a **kept** experiment — a change that improved the strategy.

| # | Score | Δ | Hypothesis |
|---|-------|---|------------|
| 1 | 0.421 | — |  |
| 4 | 0.486 | +0.065 |  |
| 11 | 0.523 | +0.037 |  |
| 12 | 0.531 | +0.008 |  |
| 17 | 0.540 | +0.009 |  |
| 29 | 0.564 | +0.024 |  |
| 30 | 0.610 | +0.046 |  |
| baseline | 0.610 | 0.000 | Initial strategy — baseline measurement |
| baseline | 0.610 | 0.000 | Initial strategy — baseline measurement |
| baseline | 0.610 | 0.000 | Initial strategy — baseline measurement |
| exp037 | 0.615 | +0.005 | I will decrease the `atrPeriod` from 14 to 7 to make the position sizing more reactive to recent vol |
| baseline | 0.615 | 0.000 | Initial strategy — baseline measurement |
| baseline | 0.615 | 0.000 | Initial strategy — baseline measurement |
| exp053 | 0.671 | +0.056 | I will increase the `exitThreshold` from 0.01 to 0.015 to hold winning positions longer before takin |
| exp065 | 0.714 | +0.043 | I will reduce the `deviationThreshold` from 0.025 to 0.022 to capture earlier mean-reversion entries |
| exp070 | 0.726 | +0.012 | Reduce the `rsiPeriod` from 14 to 10 to make RSI more responsive to recent price action, allowing ea |
| exp074 | 0.740 | +0.014 | Reduce the `atrPeriod` from 7 to 5 to make volatility-based position sizing more responsive to recen |
| baseline | 0.740 | 0.000 | Initial strategy — baseline measurement |
| baseline | 0.157 | -0.583 | Initial strategy — baseline measurement |
| baseline | -1.460 | -1.617 | Initial strategy — baseline measurement |
| baseline | -1.460 | — | Initial strategy — baseline measurement |
| baseline | -1.460 | — | Initial strategy — baseline measurement |
| baseline | -1.460 | — | Initial strategy — baseline measurement |
| exp117 | 2.838 | — | Complete strategy redesign: switched from VWAP reversion (overfit to synthetic data) to adaptive tre |
| baseline | 2.838 | 0.000 | Initial strategy — baseline measurement |
| baseline | 2.838 | 0.000 | Initial strategy — baseline measurement |

## Score Progression

```
1        ███████ 0.421
4        █████████ 0.486
11       █████████ 0.523
12       █████████ 0.531
17       ██████████ 0.540
29       ██████████ 0.564
30       ███████████ 0.610
baseline ███████████ 0.610
baseline ███████████ 0.610
baseline ███████████ 0.610
exp037   ███████████ 0.615
baseline ███████████ 0.615
baseline ███████████ 0.615
exp053   ████████████ 0.671
exp065   █████████████ 0.714
exp070   █████████████ 0.726
exp074   █████████████ 0.740
baseline █████████████ 0.740
baseline ███ 0.157
baseline █ -1.460
baseline █ -1.460
baseline █ -1.460
baseline █ -1.460
exp117   ██████████████████████████████████████████████████ 2.838
baseline ██████████████████████████████████████████████████ 2.838
baseline ██████████████████████████████████████████████████ 2.838
```

## Pair Analysis

*Per-pair breakdown not available — run a backtest with `--verbose` to generate pair-level stats.*

## Current Strategy

| Parameter | Value |
|-----------|-------|
| lookback | `20` |
| emaFast | `10` |
| emaSlow | `30` |
| rsiPeriod | `14` |
| atrPeriod | `14` |
| atrTrailMultiple | `2.0` |
| basePositionSize | `0.10` |
| cooldown | `6` |
| maxPositions | `3` |

## Active Trading Pairs

| Pair | DEX | Fee | Source |
|------|-----|-----|--------|
| ETH/USDC | uniswap | 0.05% | 🔒 built-in |
| ETH/USDC-30 | uniswap | 0.30% | 🔒 built-in |
| cbETH/WETH | uniswap | 0.05% | 🔒 built-in |
| AERO/USDC | aerodrome | — | 🔒 built-in |

## Top 10 Experiments

| Rank | ID | Score | Sharpe | Status | Hypothesis |
|------|----|-------|--------|--------|------------|
| 1 | exp117 | 2.838 | 2.838 | ✅ | Complete strategy redesign: switched from VWAP reversion (overfit to synthetic d |
| 2 | baseline | 2.838 | 2.838 | ✅ | Initial strategy — baseline measurement |
| 3 | baseline | 2.838 | 2.838 | ✅ | Initial strategy — baseline measurement |
| 4 | exp074 | 0.740 | 0.740 | ✅ | Reduce the `atrPeriod` from 7 to 5 to make volatility-based position sizing more |
| 5 | baseline | 0.740 | 0.740 | ✅ | Initial strategy — baseline measurement |
| 6 | exp082 | 0.740 | 0.740 | ❌ | Reduce the rsiPeriod from 10 to 8 to make RSI respond even faster to recent pric |
| 7 | exp093 | 0.740 | 0.740 | ❌ | Increase the rsiPeriod from 10 to 12 to reduce noise in RSI signals while mainta |
| 8 | exp075 | 0.732 | 0.732 | ❌ | Increase atrPeriod from 5 to 6 to find the optimal volatility responsiveness bet |
| 9 | exp078 | 0.727 | 0.727 | ❌ | Reduce the basePositionSize from 0.15 to 0.12 to decrease per-trade risk exposur |
| 10 | exp095 | 0.727 | 0.727 | ❌ | Reduce the basePositionSize from 0.15 to 0.12 to lower per-trade risk exposure w |

## Failure Patterns

Last 10 rejected experiments — avoid repeating these:

- **exp102** (0.653): Increase the deviationThreshold from 0.022 to 0.025 to reduce false mean-reversion signals in choppy markets by requirin
- **exp103** (0.726): Implement dual-timeframe volatility confirmation by using a longer ATR period (7) for position sizing while keeping the 
- **exp104** (0.513): Increase vwapPeriod from 20 to 25 to reduce false mean-reversion signals by using a longer-term VWAP reference, filterin
- **exp105** (-999.000): Implement adaptive RSI thresholds based on volatility regime using ATR percentile ranking to tighten entry filters durin
- **exp106** (0.574): Increase vwapPeriod from 20 to 22 and reduce deviationThreshold from 0.022 to 0.020 to tighten mean-reversion entry sign
- **exp109** (-2.180): Reduce cooldown from 3 to 2 bars to allow faster re-entry on new mean-reversion signals while maintaining the proven ent
- **exp111** (-1.905): Tighten deviationThreshold from 0.022 to 0.020 while relaxing RSI entry from 40/60 to 35/65 to capture stronger mean-rev
- **exp113** (-1.285): Reduce exitThreshold from 0.015 to 0.012 to allow positions to capture more mean-reversion profit before closing, reduci
- **exp114** (-2.475): Increase basePositionSize from 0.15 to 0.18 to capture more profit from high-conviction mean-reversion signals while mai
- **exp115** (-2.598): Reduce exitThreshold from 0.015 to 0.010 while tightening deviationThreshold from 0.022 to 0.020 to capture stronger mea

## Configuration

| Setting | Value |
|---------|-------|
| Mutation model | `claude-sonnet-4.5` |
| Max experiments | 200 |
| Score target | 20 |
| Backtest capital | $100,000 |
| Trade floor | 50 trades |
| Max drawdown limit | 50% |
| Bankr LLM | ✅ Enabled |
| Live mode | 📝 Paper |

---
*Generated by `node scripts/report.js` — @darksol/autoresearch* 🌑