#!/usr/bin/env node
/**
 * Debug: show what the strategy's indicators are seeing right now
 */
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { Strategy } = await import(pathToFileURL(resolve(ROOT, 'strategies/strategy.js')).href);
const { rsi, atr, ema, roc, percentileRank, bollingerBands } = await import(pathToFileURL(resolve(ROOT, 'src/indicators.js')).href);

// Fetch 30-day data
const url = `https://api.coingecko.com/api/v3/coins/ethereum/ohlc?vs_currency=usd&days=30`;
const res = await fetch(url);
const raw = await res.json();
const bars = raw.map(([ts, open, high, low, close]) => ({ timestamp: ts, open, high, low, close, volume: 0 }));

const closes = bars.map(b => b.close);
const highs = bars.map(b => b.high);
const lows = bars.map(b => b.low);
const idx = closes.length - 1;
const price = closes[idx];

// Strategy indicators
const trendEma = ema(closes, 50);
const atrValues = atr(highs, lows, closes, 10);
const atrPercentile = percentileRank(atrValues, 50);
const rocValues = roc(closes, 10);
const bb = bollingerBands(closes, 20, 2.0);
const rsiValues = rsi(closes, 14);

console.log('🔍 Strategy Indicator Debug');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Bars: ${bars.length} | Price: $${price.toFixed(2)}`);
console.log(`50-EMA: $${trendEma[idx]?.toFixed(2)} | Price ${price > trendEma[idx] ? '>' : '<'} EMA → ${price > trendEma[idx] ? 'BULLISH' : 'BEARISH'}`);
console.log(`RSI(14): ${rsiValues[idx]?.toFixed(1)} | ${rsiValues[idx] > 70 ? 'OVERBOUGHT' : rsiValues[idx] < 30 ? 'OVERSOLD' : 'NEUTRAL'}`);
console.log(`ATR: ${atrValues[idx]?.toFixed(2)} | Percentile: ${atrPercentile[idx]?.toFixed(1)}% | Need ≥60%: ${atrPercentile[idx] >= 60 ? '✅' : '❌'}`);
console.log(`ROC(10): ${rocValues[idx]?.toFixed(4)} | ${rocValues[idx] > 0 ? 'POSITIVE ✅' : 'NEGATIVE ❌'}`);

// Check Donchian breakout
const breakoutLookback = atrPercentile[idx] >= 70 ? 15 : 25;
if (idx >= breakoutLookback) {
  const channelHigh = Math.max(...highs.slice(idx - breakoutLookback, idx));
  const channelLow = Math.min(...lows.slice(idx - breakoutLookback, idx));
  console.log(`Donchian(${breakoutLookback}): High $${channelHigh.toFixed(2)} / Low $${channelLow.toFixed(2)}`);
  console.log(`Breakout: price ≥ ${(channelHigh * 0.998).toFixed(2)} → ${price >= channelHigh * 0.998 ? '✅ BREAKOUT' : '❌ no breakout'}`);
}

// Bollinger Bands
console.log(`BB: Upper $${bb.upper[idx]?.toFixed(2)} / Mid $${bb.middle[idx]?.toFixed(2)} / Lower $${bb.lower[idx]?.toFixed(2)}`);
console.log(`Mean-Rev Short: price ≥ BB Upper * 0.998 AND RSI > 70 → ${price >= bb.upper[idx] * 0.998 && rsiValues[idx] > 70 ? '✅ SHORT SIGNAL' : '❌ no signal'}`);

// Hurst
const strategy = new Strategy();
const hurst = strategy.calculateHurst(closes, 50);
console.log(`\nHurst(50): ${hurst.toFixed(3)} | ${hurst > 0.55 ? 'TRENDING (70% breakout)' : hurst < 0.45 ? 'RANGING (70% mean-rev)' : 'NEUTRAL (50/50)'}`);

// Summary
console.log('\n📋 ENTRY CONDITIONS:');
const aboveEma = price > trendEma[idx];
const atrOk = atrPercentile[idx] >= 60;
const rocOk = rocValues[idx] > 0;
const channelHigh = Math.max(...highs.slice(idx - breakoutLookback, idx));
const breakoutOk = price >= channelHigh * 0.998;

console.log(`  LONG (breakout): EMA ✓=${aboveEma} + Breakout ✓=${breakoutOk} + ATR% ✓=${atrOk} + ROC ✓=${rocOk}`);
console.log(`  SHORT (mean-rev): BB Upper ✓=${price >= bb.upper[idx] * 0.998} + RSI>70 ✓=${rsiValues[idx] > 70}`);
console.log(`  → ${aboveEma && breakoutOk && atrOk && rocOk ? '🟢 LONG ENTRY WOULD FIRE' : price >= bb.upper[idx] * 0.998 && rsiValues[idx] > 70 ? '🔴 SHORT ENTRY WOULD FIRE' : '⚪ NO ENTRY — waiting for conditions'}`);
