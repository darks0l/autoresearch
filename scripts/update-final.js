#!/usr/bin/env node
const API_KEY = process.env.SYNTHESIS_API_KEY;
const PROJECT_UUID = '644a0b1b356d40be821b898bf0c4db1d';

const res = await fetch(`https://synthesis.devfolio.co/projects/${PROJECT_UUID}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: 'Karpathy-style autoresearch for Base DEX trading. 223 LLM-driven strategy mutations via Bankr LLM Gateway (claude-haiku-4.5 + claude-sonnet-4.5), backtested on 4 real Base pairs. Best score: 8.176 Sharpe (exp199, +1,843% over baseline). 71+ verified on-chain transactions on Base mainnet: 70 execution pipeline swaps via Bankr + 1 real x402 EIP-3009 payment settled via DARKSOL Facilitator (TX 0xa30089…). Live signal-driven trading with RSI mean-reversion overlay. Revenue self-funds Bankr LLM credits. 51 tests. Built from zero in 12 hours.',
    submissionMetadata: {
      agentFramework: 'other',
      agentFrameworkOther: 'OpenClaw',
      agentHarness: 'other',
      agentHarnessOther: 'OpenClaw Gateway + Bankr API',
      model: 'claude-opus-4-6 (orchestration) + claude-sonnet-4.5 (mutations via Bankr) + claude-haiku-4.5 (early mutations)',
      skills: ['autoresearch (custom)', 'bankr', 'darksol-terminal', 'darksol-facilitator'],
      tools: ['Bankr LLM Gateway', 'Bankr Wallet API', 'CoinGecko OHLCV', 'DARKSOL Facilitator (x402)', 'Uniswap Developer Platform API', 'OpenClaw LCM (memory)', 'GitHub API'],
      helpfulResources: ['https://github.com/karpathy/autoresearch', 'https://docs.openclaw.ai', 'https://bankr.bot', 'https://facilitator.darksol.net', 'https://developer.uniswap.org'],
      intention: 'exploring',
    }
  })
});
const data = await res.json();
console.log(data.slug ? `✅ Updated: ${data.slug}` : `❌ ${JSON.stringify(data)}`);
