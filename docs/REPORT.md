# 📊 AutoResearch — Strategy Report
> Generated: 2026-03-22T14:10:11.750Z
> Engine: @darksol/autoresearch | Pairs: 4 | Model: claude-sonnet-4.5

## Summary

| Metric | Value |
|--------|-------|
| Total experiments | **228** |
| Kept / Reverted | 59 ✅ / 169 ❌ |
| Hit rate | 25.9% |
| Best score | **8.176** (exp199) |
| Best Sharpe | 8.176 |
| Total return | 6.64% |
| Max drawdown | 2.18% |
| Trades | 134 |
| Win rate | 53.7% |
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
| baseline | 2.838 | 0.000 | Initial strategy — baseline measurement |
| baseline | 2.838 | 0.000 | Initial strategy — baseline measurement |
| exp126 | 2.919 | +0.081 | Add regime-based position sizing by increasing exposure in trending regimes (high Hurst exponent) an |
| exp127 | 2.923 | +0.004 | Reduce Hurst lookback from 50 to 30 bars to make regime detection more responsive to recent market c |
| exp128 | 3.668 | +0.745 | Reduce ATR trail multiple from 2.0 to 1.5 to exit winners earlier and capture profits more aggressiv |
| baseline | 3.668 | 0.000 | Initial strategy — baseline measurement |
| exp137 | 3.741 | +0.073 | Replace the Hurst exponent regime detection with a simpler trend-following approach using price mome |
| exp151 | 3.777 | +0.036 | Add a multi-timeframe trend filter that calculates a longer-term 50-period EMA slope and only takes  |
| baseline | 3.777 | 0.000 | Initial strategy — baseline measurement |
| exp161 | 4.512 | +0.735 | STRUCTURAL: Ensemble voting (Donchian+RSI+MACD) + macro 100-EMA trend filter + conviction-weighted s |
| baseline | 4.512 | 0.000 | Initial strategy — baseline measurement |
| exp163 | 5.310 | +0.798 | Replace the ensemble voting system with a pure trend-following breakout strategy that only enters wh |
| baseline | 5.310 | 0.000 | Initial strategy — baseline measurement |
| exp170 | 7.327 | +2.017 | Replace the fixed volatility expansion filter (ATR > ATR_SMA) with a percentile-based expansion trig |
| baseline | 7.327 | 0.000 | Initial strategy — baseline measurement |
| exp180 | 7.875 | +0.548 | Replace the fixed 3.0x ATR profit target with an adaptive profit target that scales with trend stren |
| baseline | 7.875 | 0.000 | Initial strategy — baseline measurement |
| exp183 | 7.991 | +0.116 | Replace the fixed 20-period Donchian breakout with a dynamic breakout lookback that adapts to volati |
| baseline | 7.991 | 0.000 | Initial strategy — baseline measurement |
| baseline | 7.991 | 0.000 | Initial strategy — baseline measurement |
| exp199 | 8.176 | +0.185 | Implement a dual-strategy portfolio allocation system that runs a pure breakout strategy and a count |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |
| baseline | 8.176 | 0.000 | Initial strategy — baseline measurement |

## Score Progression

```
1        ███ 0.421
4        ███ 0.486
11       ███ 0.523
12       ███ 0.531
17       ███ 0.540
29       ███ 0.564
30       ████ 0.610
baseline ████ 0.610
baseline ████ 0.610
baseline ████ 0.610
exp037   ████ 0.615
baseline ████ 0.615
baseline ████ 0.615
exp053   ████ 0.671
exp065   ████ 0.714
exp070   ████ 0.726
exp074   █████ 0.740
baseline █████ 0.740
baseline █ 0.157
baseline █ -1.460
baseline █ -1.460
baseline █ -1.460
baseline █ -1.460
exp117   █████████████████ 2.838
baseline █████████████████ 2.838
baseline █████████████████ 2.838
baseline █████████████████ 2.838
baseline █████████████████ 2.838
exp126   ██████████████████ 2.919
exp127   ██████████████████ 2.923
exp128   ██████████████████████ 3.668
baseline ██████████████████████ 3.668
exp137   ███████████████████████ 3.741
exp151   ███████████████████████ 3.777
baseline ███████████████████████ 3.777
exp161   ████████████████████████████ 4.512
baseline ████████████████████████████ 4.512
exp163   ████████████████████████████████ 5.310
baseline ████████████████████████████████ 5.310
exp170   █████████████████████████████████████████████ 7.327
baseline █████████████████████████████████████████████ 7.327
exp180   ████████████████████████████████████████████████ 7.875
baseline ████████████████████████████████████████████████ 7.875
exp183   █████████████████████████████████████████████████ 7.991
baseline █████████████████████████████████████████████████ 7.991
baseline █████████████████████████████████████████████████ 7.991
exp199   ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
baseline ██████████████████████████████████████████████████ 8.176
```

## Pair Analysis

*Per-pair breakdown not available — run a backtest with `--verbose` to generate pair-level stats.*

## Current Strategy

| Parameter | Value |
|-----------|-------|
| hurstLookback | `50` |
| trendEmaPeriod | `50` |
| breakoutLookbackLow | `15` |
| breakoutLookbackHigh | `25` |
| volRegimeThreshold | `70` |
| atrPeriod | `10` |
| atrPercentileLookback | `50` |
| atrPercentileThreshold | `60` |
| rocPeriod | `10` |
| atrTrailMultiple | `1.5` |
| atrProfitMultipleMin | `2.0` |
| atrProfitMultipleMax | `4.0` |
| trendStrengthThreshold | `0.10` |
| bbPeriod | `20` |
| bbStdDev | `2.0` |
| rsiPeriod | `14` |
| rsiOversold | `30` |
| rsiOverbought | `70` |
| mrProfitTarget | `0.015` |
| mrStopLoss | `0.01` |
| basePositionSize | `0.15` |
| maxPositions | `3` |
| cooldown | `3` |

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
| 1 | exp199 | 8.176 | 8.176 | ✅ | Implement a dual-strategy portfolio allocation system that runs a pure breakout  |
| 2 | exp201 | 8.176 | 8.176 | ❌ | Manual mutation — implement via OpenClaw agent |
| 3 | baseline | 8.176 | 8.176 | ✅ | Initial strategy — baseline measurement |
| 4 | baseline | 8.176 | 8.176 | ✅ | Initial strategy — baseline measurement |
| 5 | baseline | 8.176 | 8.176 | ✅ | Initial strategy — baseline measurement |
| 6 | baseline | 8.176 | 8.176 | ✅ | Initial strategy — baseline measurement |
| 7 | baseline | 8.176 | 8.176 | ✅ | Initial strategy — baseline measurement |
| 8 | baseline | 8.176 | 8.176 | ✅ | Initial strategy — baseline measurement |
| 9 | baseline | 8.176 | 8.176 | ✅ | Initial strategy — baseline measurement |
| 10 | baseline | 8.176 | 8.176 | ✅ | Initial strategy — baseline measurement |

## Failure Patterns

Last 10 rejected experiments — avoid repeating these:

- **exp210** (7.843): Implement a volatility-regime-adaptive position scaling system that dynamically adjusts position sizes based on real-tim
- **exp213** (7.137): Implement a cross-pair momentum divergence system that detects when a pair shows strong breakout signals while the baske
- **exp214** (1.090): Implement a multi-pair relative strength ranking system that only enters breakout trades on pairs showing top-quartile m
- **exp215** (-999.000): Implement a volatility-adaptive stop-loss layering system that uses multiple ATR-based stops at different distances (tig
- **exp216** (5.575): Implement a volatility-adaptive multi-timeframe momentum filter that synthesizes 3 different lookback periods (short=5, 
- **exp219** (4.457): Implement a cross-pair volume-weighted momentum scoring system that ranks pairs by their volume-adjusted ROC strength an
- **exp220** (-999.000): Implement a position-sizing pyramid system that adds to winning breakout trades in thirds (entry at breakout, +33% at +1
- **exp221** (-999.000): Implement a volatility-adjusted partial profit-taking system that scales out 50% of breakout positions at +2 ATR profit 
- **exp223** (8.150): Implement a cross-pair correlation-based signal generator that detects divergence between ETH/USDC and cbETH/WETH price 
- **exp226** (7.758): Implement an adaptive volatility regime filter that uses dual ATR measurements (fast 5-period and slow 20-period) to det

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