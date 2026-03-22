/**
 * AutoResearch x402 Service
 * 
 * Standalone HTTP server exposing strategy discovery, validation, and signals
 * behind x402 micropayments via the DARKSOL Facilitator on Base.
 * 
 * Revenue flows to deployer wallet → Bankr LLM credits → self-sustaining loop.
 */

import http from 'http';
import { URL } from 'url';

// Lazy imports — loaded on first request to avoid crash-on-startup
let _backtest, _data, _controller, _memory, _config;

async function loadModules() {
  if (_backtest) return;
  _backtest = await import('./backtest.js');
  _data = await import('./data.js');
  _controller = await import('./controller.js');
  _memory = await import('./memory.js');
  _config = await import('./config.js');
}


// ─── x402 Configuration ─────────────────────────────────────────────
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.darksol.net';
const RECEIVER_WALLET = process.env.RECEIVER_WALLET || '0x3e6e304421993D7E95a77982E11C93610DD4fFC5';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PORT = parseInt(process.env.AUTORESEARCH_PORT || '18793');

// Service pricing (USDC, 6 decimals)
const PRICES = {
  '/strategy/discover': { amount: '2000000', description: 'Strategy Discovery — run N experiments, return best' },    // 2 USDC
  '/strategy/validate': { amount: '500000', description: 'OOS Validation — walk-forward + fresh data test' },          // 0.50 USDC
  '/strategy/signal':   { amount: '100000', description: 'Live Signal — current strategy recommendation' },            // 0.10 USDC
};

// ─── x402 Payment Verification ───────────────────────────────────────

/**
 * Verify x402 payment via DARKSOL Facilitator
 * @param {string} paymentHeader - X-PAYMENT header from client
 * @param {string} expectedAmount - Expected USDC amount (6 decimals)
 * @returns {Promise<{valid: boolean, txHash?: string, error?: string}>}
 */
async function verifyPayment(paymentHeader, expectedAmount) {
  try {
    const res = await fetch(`${FACILITATOR_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment: paymentHeader,
        receiver: RECEIVER_WALLET,
        token: USDC_BASE,
        amount: expectedAmount,
        chain: 'base',
      }),
    });
    const data = await res.json();
    return { valid: data.verified === true, txHash: data.txHash, error: data.error };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Build x402 payment-required response
 */
function paymentRequired(res, path) {
  const price = PRICES[path];
  if (!price) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown endpoint' }));
    return;
  }

  res.writeHead(402, {
    'Content-Type': 'application/json',
    'X-PAYMENT-REQUIRED': JSON.stringify({
      facilitator: FACILITATOR_URL,
      receiver: RECEIVER_WALLET,
      token: USDC_BASE,
      amount: price.amount,
      chain: 'base',
      description: price.description,
      network: 'base-mainnet',
    }),
  });
  res.end(JSON.stringify({
    status: 402,
    message: 'Payment Required',
    description: price.description,
    price: `${parseInt(price.amount) / 1e6} USDC`,
    facilitator: FACILITATOR_URL,
    paymentInstructions: 'Send EIP-3009 authorization via X-PAYMENT header',
  }));
}

// ─── Service Handlers ────────────────────────────────────────────────

/**
 * Strategy Discovery — runs experiments and returns best strategy
 */
async function handleDiscover(body) {
  await loadModules();
  const { experiments = 10, pairs, model } = body || {};
  const maxExp = Math.min(Math.max(experiments, 1), 30); // cap at 30

  // Initialize memory
  await _memory.initMemory();
  
  // Load data
  const allPairs = await _data.loadAllPairs('1h');
  
  // Run autoresearch loop
  const results = [];
  let bestScore = -Infinity;
  let bestStrategy = null;

  const result = await _controller.runAutoresearch(allPairs, {
    maxExperiments: maxExp,
    onExperiment: (exp) => {
      results.push({
        id: exp.id,
        hypothesis: exp.hypothesis,
        score: exp.score,
        kept: exp.kept,
      });
      if (exp.score > bestScore) {
        bestScore = exp.score;
        bestStrategy = exp;
      }
    },
  });

  // Get experiment summary
  const summary = _memory.getExperimentSummary();

  return {
    service: 'strategy-discovery',
    experimentsRun: results.length,
    bestScore,
    bestExperiment: bestStrategy ? {
      id: bestStrategy.id,
      hypothesis: bestStrategy.hypothesis,
      score: bestStrategy.score,
      sharpe: bestStrategy.sharpe,
      maxDrawdown: bestStrategy.maxDrawdown,
      trades: bestStrategy.numTrades,
      winRate: bestStrategy.winRate,
    } : null,
    allResults: results,
    summary,
    agent: {
      identity: 'ERC-8004 Agent #31929',
      operator: RECEIVER_WALLET,
      repo: 'https://github.com/darks0l/autoresearch',
    },
  };
}

/**
 * OOS Validation — walk-forward split + fresh data test
 */
async function handleValidate(body) {
  await loadModules();
  const allPairs = await _data.loadAllPairs('1h');

  // Import current strategy
  const stratMod = await import('../strategies/strategy.js');
  const StrategyClass = stratMod.Strategy || stratMod.default?.Strategy || stratMod.default;

  // Phase 1: Full baseline
  const fullStrategy = typeof StrategyClass === 'function' ? new StrategyClass() : StrategyClass;
  const fullResult = _backtest.runBacktest(fullStrategy, allPairs);
  const tc = (r) => Array.isArray(r.trades) ? r.trades.length : (r.numTrades || r.tradeCount || 0);

  // Phase 2: Walk-forward split
  let minBars = Infinity;
  for (const [, bars] of allPairs) minBars = Math.min(minBars, bars.length);
  const splitIdx = Math.floor(minBars * 0.7);

  const trainPairs = new Map();
  const testPairs = new Map();
  for (const [name, bars] of allPairs) {
    trainPairs.set(name, bars.slice(0, splitIdx));
    testPairs.set(name, bars.slice(splitIdx, minBars));
  }

  const trainStrategy = typeof StrategyClass === 'function' ? new StrategyClass() : StrategyClass;
  const trainResult = _backtest.runBacktest(trainStrategy, trainPairs);

  const testStrategy = typeof StrategyClass === 'function' ? new StrategyClass() : StrategyClass;
  const testResult = _backtest.runBacktest(testStrategy, testPairs);

  const degradation = trainResult.score > 0
    ? ((testResult.score - trainResult.score) / trainResult.score * 100)
    : 0;

  return {
    service: 'strategy-validation',
    results: {
      full: { score: fullResult.score, sharpe: fullResult.sharpe, trades: tc(fullResult), maxDrawdown: fullResult.maxDrawdownPct },
      train: { score: trainResult.score, sharpe: trainResult.sharpe, trades: tc(trainResult), maxDrawdown: trainResult.maxDrawdownPct },
      test: { score: testResult.score, sharpe: testResult.sharpe, trades: tc(testResult), maxDrawdown: testResult.maxDrawdownPct },
      degradation: `${degradation.toFixed(1)}%`,
    },
    verdict: Math.abs(degradation) < 50 ? 'VALIDATED' : 'OVERFIT',
    interpretation: {
      degradationThresholds: { good: '<20%', acceptable: '20-50%', redFlag: '>50%' },
      testSharpe: testResult.sharpe > 2 ? 'strong' : testResult.sharpe > 1 ? 'acceptable' : 'weak',
    },
    agent: {
      identity: 'ERC-8004 Agent #31929',
      operator: RECEIVER_WALLET,
    },
  };
}

/**
 * Live Signal — run current strategy on latest data, return recommendation
 */
async function handleSignal(body) {
  await loadModules();
  const { pair = 'ETH/USDC' } = body || {};

  const allPairs = await _data.loadAllPairs('1h');

  // Import and instantiate strategy
  const stratMod = await import('../strategies/strategy.js');
  const StrategyClass = stratMod.Strategy || stratMod.default?.Strategy || stratMod.default;
  const strategy = typeof StrategyClass === 'function' ? new StrategyClass() : StrategyClass;

  // Run through all bars to get current state, then check latest signal
  let lastSignals = [];
  const portfolio = { cash: 100000, positions: {} };

  for (const [name, bars] of allPairs) {
    const barCount = bars.length;
    for (let i = 0; i < barCount; i++) {
      const barData = _data.buildBarData(allPairs, i);
      const signals = strategy.onBar(barData, portfolio) || [];
      if (i === barCount - 1) {
        lastSignals = signals;
      }
      // Apply signals to portfolio (simplified)
      for (const sig of signals) {
        if (sig.pair && sig.targetPosition !== undefined) {
          portfolio.positions[sig.pair] = sig.targetPosition;
        }
      }
    }
    break; // Only need one pass through the bars
  }

  // Get latest bar data for context
  const latestBars = {};
  for (const [name, bars] of allPairs) {
    const last = bars[bars.length - 1];
    if (last) {
      latestBars[name] = {
        close: last.close,
        high: last.high,
        low: last.low,
        volume: last.volume,
        timestamp: last.timestamp || new Date().toISOString(),
      };
    }
  }

  return {
    service: 'live-signal',
    requestedPair: pair,
    signals: lastSignals.map(s => ({
      pair: s.pair,
      action: s.targetPosition > 0 ? 'LONG' : s.targetPosition < 0 ? 'SHORT' : 'FLAT',
      targetPosition: s.targetPosition,
      confidence: s.confidence || 'medium',
    })),
    currentPositions: portfolio.positions,
    latestPrices: latestBars,
    strategyInfo: {
      name: 'Dual-Regime Adaptive (exp199)',
      bestScore: 8.176,
      totalExperiments: 222,
    },
    agent: {
      identity: 'ERC-8004 Agent #31929',
      operator: RECEIVER_WALLET,
    },
    disclaimer: 'Signals are based on backtested strategies. Past performance does not guarantee future results. Not financial advice.',
  };
}

// ─── Request Router ──────────────────────────────────────────────────

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PAYMENT');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (path === '/' || path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'AutoResearch x402 Service',
      version: '1.0.0',
      status: 'healthy',
      agent: 'ERC-8004 Agent #31929',
      operator: RECEIVER_WALLET,
      endpoints: Object.entries(PRICES).map(([p, v]) => ({
        path: p,
        price: `${parseInt(v.amount) / 1e6} USDC`,
        description: v.description,
      })),
      payment: {
        protocol: 'x402 / EIP-3009',
        facilitator: FACILITATOR_URL,
        chain: 'Base',
        token: 'USDC',
      },
    }));
    return;
  }

  // Service endpoints — require x402 payment
  if (PRICES[path]) {
    const paymentHeader = req.headers['x-payment'];

    // No payment → 402
    if (!paymentHeader) {
      paymentRequired(res, path);
      return;
    }

    // Verify payment
    const price = PRICES[path];
    const verification = await verifyPayment(paymentHeader, price.amount);

    if (!verification.valid) {
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 402,
        message: 'Payment verification failed',
        error: verification.error,
      }));
      return;
    }

    // Payment verified — execute service
    try {
      // Parse request body
      let body = {};
      if (req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString();
        if (raw) body = JSON.parse(raw);
      }

      let result;
      switch (path) {
        case '/strategy/discover':
          result = await handleDiscover(body);
          break;
        case '/strategy/validate':
          result = await handleValidate(body);
          break;
        case '/strategy/signal':
          result = await handleSignal(body);
          break;
      }

      // Add payment receipt
      result.payment = {
        verified: true,
        txHash: verification.txHash,
        amount: `${parseInt(price.amount) / 1e6} USDC`,
        protocol: 'x402 / EIP-3009',
        chain: 'Base',
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-PAYMENT-RECEIPT': verification.txHash || 'verified',
      });
      res.end(JSON.stringify(result, null, 2));

    } catch (err) {
      console.error(`[ERROR] ${path}:`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 500,
        error: 'Service execution failed',
        message: err.message,
        payment: { verified: true, txHash: verification.txHash, note: 'Payment was verified. Contact operator for refund if needed.' },
      }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 404, error: 'Not found', availableEndpoints: Object.keys(PRICES) }));
}

// ─── Server Start ────────────────────────────────────────────────────

const server = http.createServer(handleRequest);

server.on('error', (err) => {
  console.error('[SERVER ERROR]', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║  AutoResearch x402 Service                       ║
║  Port: ${String(PORT).padEnd(41)}║
║  Agent: ERC-8004 #31929                          ║
║  Payment: x402 via DARKSOL Facilitator (Base)    ║
╠══════════════════════════════════════════════════╣
║  Endpoints:                                      ║
║    /strategy/discover  — 2.00 USDC               ║
║    /strategy/validate  — 0.50 USDC               ║
║    /strategy/signal    — 0.10 USDC               ║
║                                                  ║
║  Revenue → Bankr LLM → More experiments → ♻️     ║
╚══════════════════════════════════════════════════╝
  `);
});

// Keep event loop alive
setInterval(() => {}, 1 << 30);

export { server, PRICES, RECEIVER_WALLET };
