/**
 * Bankr Integration
 * Connects autoresearch to Bankr wallet for optional live execution
 * and uses Bankr LLM Gateway for strategy mutations
 */

import CONFIG from './config.js';

/**
 * Check Bankr wallet balance
 */
export async function getBalance() {
  if (!CONFIG.bankr.apiKey) {
    return { eth: 0, usdc: 0, available: false };
  }

  try {
    const resp = await fetch('https://api.bankr.bot/v1/portfolio', {
      headers: { 'Authorization': `Bearer ${CONFIG.bankr.apiKey}` },
    });
    if (!resp.ok) return { eth: 0, usdc: 0, available: false };
    const data = await resp.json();
    return {
      eth: data.balances?.ETH || 0,
      usdc: data.balances?.USDC || 0,
      available: true,
    };
  } catch {
    return { eth: 0, usdc: 0, available: false };
  }
}

/**
 * Call Bankr LLM Gateway for strategy mutation
 */
export async function callLLM(prompt, options = {}) {
  const { model = 'claude-sonnet-4-6', maxTokens = 4000 } = options;

  if (!CONFIG.bankr.apiKey) {
    throw new Error('Bankr API key not configured');
  }

  const resp = await fetch(CONFIG.bankr.llmGateway, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.bankr.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Bankr LLM error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Execute a trade via Bankr (paper or live mode)
 */
export async function executeTrade(signal) {
  if (!CONFIG.bankr.liveMode) {
    console.log(`  [paper] Would ${signal.targetPosition > 0 ? 'buy' : 'sell'} ${signal.pair}: $${Math.abs(signal.targetPosition)}`);
    return { success: true, mode: 'paper' };
  }

  if (!CONFIG.bankr.apiKey) {
    throw new Error('Bankr API key required for live trading');
  }

  // Map signal to Bankr swap command
  const action = signal.targetPosition > 0 ? 'buy' : 'sell';
  const amount = Math.abs(signal.targetPosition);

  // TODO: Implement actual Bankr API swap call
  console.log(`  [live] ${action} ${signal.pair}: $${amount}`);
  return { success: true, mode: 'live', action, amount };
}

/**
 * Get Bankr LLM credits balance
 */
export async function getLLMCredits() {
  if (!CONFIG.bankr.apiKey) return { credits: 0, available: false };

  try {
    const resp = await fetch('https://llm.bankr.bot/v1/credits', {
      headers: { 'Authorization': `Bearer ${CONFIG.bankr.apiKey}` },
    });
    if (!resp.ok) return { credits: 0, available: false };
    const data = await resp.json();
    return { credits: data.credits || 0, available: true };
  } catch {
    return { credits: 0, available: false };
  }
}

export default { getBalance, callLLM, executeTrade, getLLMCredits };
