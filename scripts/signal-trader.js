#!/usr/bin/env node
/**
 * Signal-driven live trader — executes real strategy signals on Base via Bankr
 * Uses the 8.176-score dual-regime-adaptive strategy on live CoinGecko data
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load strategy
import { pathToFileURL } from 'url';
const { Strategy } = await import(pathToFileURL(resolve(ROOT, 'strategies/strategy.js')).href);

// Config
const BANKR_API_KEY = process.env.BANKR_API_KEY ||
  JSON.parse(readFileSync(resolve(process.env.USERPROFILE || process.env.HOME, '.bankr/config.json'), 'utf8')).apiKey;

const PAIRS = [
  { id: 'ETH-USDC', coingecko: 'ethereum', quote: 'usd', base: 'ETH', quoteToken: 'USDC' },
];

const RESULTS_FILE = resolve(ROOT, 'data/signal-trades.json');
const STATE_FILE = resolve(ROOT, 'data/signal-state.json');

// Load previous results
let results = [];
if (existsSync(RESULTS_FILE)) {
  try { results = JSON.parse(readFileSync(RESULTS_FILE, 'utf8')); } catch {}
}

// Load state (tracks our position)
let state = { position: 'none', entryPrice: 0, entryTime: null, pnl: 0, trades: 0, wins: 0 };
if (existsSync(STATE_FILE)) {
  try { state = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch {}
}

function saveState() {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

// Fetch recent hourly OHLCV from CoinGecko
async function fetchOHLCV(coinId, days = 7) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${await res.text()}`);
  const raw = await res.json();
  // CoinGecko OHLC returns [timestamp, open, high, low, close]
  return raw.map(([ts, open, high, low, close]) => ({
    timestamp: ts,
    open, high, low, close,
    volume: 0 // CoinGecko OHLC doesn't include volume
  }));
}

// Execute trade via Bankr
async function executeTrade(action, amount, base, quote) {
  let prompt;
  if (action === 'buy') {
    prompt = `Swap ${amount} ${quote} to ${base} on Base`;
  } else {
    prompt = `Swap ${amount} ${base} to ${quote} on Base`;
  }

  console.log(`  📤 Bankr: "${prompt}"`);

  // Submit prompt
  const submitRes = await fetch('https://api.bankr.bot/agent/prompt', {
    method: 'POST',
    headers: { 'X-API-Key': BANKR_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const submitData = await submitRes.json();
  if (!submitData.jobId) throw new Error(`No jobId: ${JSON.stringify(submitData)}`);

  // Poll for completion
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.bankr.bot/agent/job/${submitData.jobId}`, {
      headers: { 'X-API-Key': BANKR_API_KEY }
    });
    const pollData = await pollRes.json();
    if (pollData.status === 'completed') {
      const txMatch = pollData.result?.match(/0x[a-f0-9]{64}/i);
      return { success: true, tx: txMatch?.[0] || 'unknown', result: pollData.result };
    }
    if (pollData.status === 'failed') {
      return { success: false, error: pollData.result || 'failed' };
    }
  }
  return { success: false, error: 'timeout' };
}

// Main signal loop
async function run() {
  const maxCycles = parseInt(process.argv[2]) || 10;
  const cycleDelay = parseInt(process.argv[3]) || 300; // 5 min default

  console.log('🌑 AutoResearch Signal Trader');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Strategy: Dual-Regime Adaptive (exp199, score 8.176)`);
  console.log(`Cycles: ${maxCycles} | Delay: ${cycleDelay}s`);
  console.log(`Position: ${state.position} | P&L: $${state.pnl.toFixed(4)}`);
  console.log();

  const strategy = new Strategy();

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    console.log(`\n── Cycle ${cycle}/${maxCycles} ──`);
    const ts = new Date().toISOString();

    try {
      // Fetch fresh data
      console.log('  📊 Fetching 7-day OHLCV...');
      const bars = await fetchOHLCV('ethereum', 30);
      console.log(`  Got ${bars.length} bars, latest close: $${bars[bars.length - 1].close.toFixed(2)}`);

      const currentPrice = bars[bars.length - 1].close;

      // Build barData in the format strategy expects
      const barData = {
        'ETH-USDC': {
          history: bars,
          open: currentPrice,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice,
          volume: 0
        }
      };

      // Simulate portfolio state
      const portfolio = {
        cash: 10000, // virtual
        positions: {}
      };

      // Map our real position to portfolio
      if (state.position === 'long') {
        portfolio.positions['ETH-USDC'] = 1000;
      } else if (state.position === 'short') {
        portfolio.positions['ETH-USDC'] = -1000;
      }

      // Try primary strategy first
      let signals = strategy.onBar(barData, portfolio);

      // If primary strategy has no signal, use lightweight RSI mean-reversion overlay
      // This catches opportunities the Donchian breakout system misses in ranging/declining markets
      if (signals.length === 0) {
        const { rsi: calcRsi, ema: calcEma } = await import(pathToFileURL(resolve(ROOT, 'src/indicators.js')).href);
        const closes = bars.map(b => b.close);
        const rsiValues = calcRsi(closes, 14);
        const ema20 = calcEma(closes, 20);
        const rsiVal = rsiValues[closes.length - 1];
        const emaVal = ema20[closes.length - 1];
        const prevClose = closes[closes.length - 2];
        const priceChange = ((currentPrice - prevClose) / prevClose) * 100;

        // RSI mean-reversion: buy oversold, sell overbought
        // In ranging/declining markets, RSI < 35 = oversold (expect bounce)
        // RSI > 65 = relatively overbought (expect pullback)
        if (state.position !== 'long' && rsiVal < 38) {
          // RSI oversold — buy the dip, expect mean reversion toward 50
          signals = [{ pair: 'ETH-USDC', targetPosition: 1000 }];
          console.log(`  🔄 RSI overlay: RSI=${rsiVal.toFixed(1)} OVERSOLD → BUY`);
        } else if (state.position === 'long' && (rsiVal > 50 || currentPrice < state.entryPrice * 0.993)) {
          // Take profit when RSI normalizes or stop at -0.7%
          signals = [{ pair: 'ETH-USDC', targetPosition: 0 }];
          console.log(`  🔄 RSI overlay: RSI=${rsiVal.toFixed(1)} / stop → CLOSE LONG`);
        } else if (state.position !== 'short' && rsiVal > 62) {
          // RSI overbought — short, expect pullback
          signals = [{ pair: 'ETH-USDC', targetPosition: -1000 }];
          console.log(`  🔄 RSI overlay: RSI=${rsiVal.toFixed(1)} OVERBOUGHT → SHORT`);
        } else if (state.position === 'short' && (rsiVal < 45 || currentPrice > state.entryPrice * 1.007)) {
          // Close short when RSI drops or stop at +0.7%
          signals = [{ pair: 'ETH-USDC', targetPosition: 0 }];
          console.log(`  🔄 RSI overlay: RSI=${rsiVal.toFixed(1)} / stop → CLOSE SHORT`);
        } else {
          console.log(`  📡 RSI=${rsiVal.toFixed(1)} | Δ=${priceChange.toFixed(2)}% | No trigger`);
        }
      }

      console.log(`  📡 Signals: ${signals.length === 0 ? 'HOLD (no signal)' : signals.map(s => `${s.pair}: ${s.targetPosition > 0 ? 'LONG' : s.targetPosition < 0 ? 'SHORT' : 'CLOSE'} (${s.targetPosition.toFixed(0)})`).join(', ')}`);

      // Process signals
      for (const signal of signals) {
        if (signal.pair !== 'ETH-USDC') continue;

        if (signal.targetPosition > 0 && state.position !== 'long') {
          // BUY signal
          console.log(`  🟢 BUY SIGNAL — entering long at ~$${currentPrice.toFixed(2)}`);

          // Close short if we have one
          if (state.position === 'short') {
            const pnl = state.entryPrice - currentPrice;
            state.pnl += pnl;
            if (pnl > 0) state.wins++;
            console.log(`  📕 Closing short: P&L $${pnl.toFixed(2)}`);
          }

          // Buy 1 USDC worth of ETH (small size for safety)
          const trade = await executeTrade('buy', '1', 'ETH', 'USDC');
          if (trade.success) {
            state.position = 'long';
            state.entryPrice = currentPrice;
            state.entryTime = ts;
            state.trades++;
            results.push({ cycle, ts, signal: 'BUY', price: currentPrice, tx: trade.tx, pnl: null });
            console.log(`  ✅ Bought | TX: ${trade.tx}`);
          } else {
            console.log(`  ❌ Trade failed: ${trade.error}`);
            results.push({ cycle, ts, signal: 'BUY', price: currentPrice, tx: null, error: trade.error });
          }

        } else if (signal.targetPosition < 0 && state.position !== 'short') {
          // SELL signal (go short = sell ETH for USDC)
          console.log(`  🔴 SELL SIGNAL — entering short at ~$${currentPrice.toFixed(2)}`);

          // Close long if we have one
          if (state.position === 'long') {
            const pnl = currentPrice - state.entryPrice;
            state.pnl += pnl;
            if (pnl > 0) state.wins++;
            console.log(`  📗 Closing long: P&L $${pnl.toFixed(2)}`);
          }

          const trade = await executeTrade('sell', '0.0005', 'ETH', 'USDC');
          if (trade.success) {
            state.position = 'short';
            state.entryPrice = currentPrice;
            state.entryTime = ts;
            state.trades++;
            results.push({ cycle, ts, signal: 'SELL', price: currentPrice, tx: trade.tx, pnl: null });
            console.log(`  ✅ Sold | TX: ${trade.tx}`);
          } else {
            console.log(`  ❌ Trade failed: ${trade.error}`);
            results.push({ cycle, ts, signal: 'SELL', price: currentPrice, tx: null, error: trade.error });
          }

        } else if (signal.targetPosition === 0 && state.position !== 'none') {
          // CLOSE signal
          const action = state.position === 'long' ? 'sell' : 'buy';
          const amount = state.position === 'long' ? '0.0005' : '1';
          const base = state.position === 'long' ? 'ETH' : 'ETH';
          const quote = 'USDC';

          const pnl = state.position === 'long'
            ? currentPrice - state.entryPrice
            : state.entryPrice - currentPrice;
          state.pnl += pnl;
          if (pnl > 0) state.wins++;

          console.log(`  ⚪ CLOSE ${state.position.toUpperCase()} at ~$${currentPrice.toFixed(2)} | P&L: $${pnl.toFixed(2)}`);

          const trade = await executeTrade(action, amount, base, quote);
          if (trade.success) {
            results.push({ cycle, ts, signal: 'CLOSE', price: currentPrice, tx: trade.tx, pnl: pnl.toFixed(4) });
            console.log(`  ✅ Closed | TX: ${trade.tx}`);
          } else {
            results.push({ cycle, ts, signal: 'CLOSE', price: currentPrice, tx: null, error: trade.error });
          }
          state.position = 'none';
          state.entryPrice = 0;
          state.entryTime = null;
          state.trades++;
        }
      }

      if (signals.length === 0) {
        results.push({ cycle, ts, signal: 'HOLD', price: currentPrice, tx: null });
      }

      // Save after each cycle
      saveState();

      console.log(`  📊 Running P&L: $${state.pnl.toFixed(4)} | Trades: ${state.trades} | Wins: ${state.wins} | Position: ${state.position}`);

    } catch (err) {
      console.error(`  ❌ Cycle error: ${err.message}`);
      results.push({ cycle, ts, signal: 'ERROR', error: err.message });
      saveState();
    }

    if (cycle < maxCycles) {
      console.log(`  ⏳ Waiting ${cycleDelay}s...`);
      await new Promise(r => setTimeout(r, cycleDelay * 1000));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 FINAL REPORT');
  console.log(`Trades: ${state.trades} | Wins: ${state.wins} | Win Rate: ${state.trades > 0 ? (state.wins / state.trades * 100).toFixed(1) : 0}%`);
  console.log(`Net P&L: $${state.pnl.toFixed(4)}`);
  console.log(`Position: ${state.position}`);
  saveState();
}

run().catch(err => {
  console.error('Fatal:', err);
  saveState();
  process.exit(1);
});
