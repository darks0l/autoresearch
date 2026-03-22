const API_KEY = process.env.SYNTHESIS_API_KEY;
const BASE = 'https://synthesis.devfolio.co';

const desc = `AutoResearch — Karpathy-style autonomous DEX strategy discovery for Base. Built from scratch during Synthesis Hackathon week.

222 experiments, best score 8.176 (+1,842% over 0.421 baseline). 55 kept, 167 reverted. 4 strategy eras discovered autonomously:
1. VWAP mean-reversion (0.42→0.74, overfit to synthetic data)
2. Adaptive trend-following (2.84, first real-data strategy)  
3. Ensemble voting (4.51, 3 sub-strategies vote)
4. Dual-regime portfolio (8.18, Hurst-allocated breakout + mean-reversion)

LLM-driven mutation via Bankr LLM Gateway (claude-sonnet-4.5). Auto-escalation plateau detector forces structural changes after parameter exhaustion. Real CoinGecko data, live Bankr trade on Base, 45 tests, 14 modules. Daemon runs autonomously with auto-sync to GitHub.`;

const res = await fetch(`${BASE}/projects/644a0b1b356d40be821b898bf0c4db1d`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ description: desc }),
});
const data = await res.json();
console.log(res.ok ? `✅ Updated: ${data.slug}` : `❌ ${res.status}: ${JSON.stringify(data)}`);
