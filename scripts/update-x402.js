/**
 * Update Devfolio submission with x402 service details
 */
const API_KEY = process.env.SYNTHESIS_API_KEY || 'REDACTED';
const PROJECT_UUID = '644a0b1b356d40be821b898bf0c4db1d';

const body = {
  description: 'Karpathy-style autoresearch for Base DEX. 222+ LLM-driven strategy mutations via Bankr LLM Gateway, backtested on 4 real Base pairs (Uniswap V3 + Aerodrome). Best score: 8.176 Sharpe (exp199). Now live as an x402 micropayment service — 0.10 USDC/signal, 0.50 USDC/validation, 2.00 USDC/discovery. Revenue self-funds Bankr LLM credits. 51 tests. 10+ live Base trades.',
  submissionMetadata: {
    agentFramework: 'other',
    agentFrameworkOther: 'Node.js ESM + LCM memory (lossless-claw)',
    agentHarness: 'openclaw',
    model: 'claude-sonnet-4-6 via Bankr LLM Gateway',
    skills: ['autoresearch', 'bankr-signals', 'x402-payments'],
    tools: [
      'Bankr LLM Gateway',
      'Bankr Wallet Execution',
      'DARKSOL Facilitator x402',
      'Uniswap Developer Platform API',
      'CoinGecko OHLCV API',
      'ERC-8004 Agent Identity',
    ],
    helpfulResources: [
      'https://github.com/darks0l/autoresearch',
      'https://llm.bankr.bot',
      'https://developer.uniswap.org',
      'https://facilitator.darksol.net',
    ],
    intention: 'continuing',
    intentionNotes: 'Deploying as live x402 service. Revenue self-funds LLM experiments. Targeting score 10.0+.',
  },
};

const res = await fetch(`https://synthesis.devfolio.co/projects/${PROJECT_UUID}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const data = await res.json();
if (data.slug) {
  console.log('✅ Updated:', data.slug, '| status:', data.status);
} else {
  console.log('Response:', JSON.stringify(data).slice(0, 300));
}
