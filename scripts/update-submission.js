const body = {
  description: "Karpathy-style autoresearch for Base DEX trading. An AI agent iteratively mutates, backtests, and evolves strategies against real Uniswap V3 + Aerodrome data on Base. Key discovery: VWAP reversion was overfit to synthetic data (score 0.74) but failed on real data (-1.46). Agent adapted autonomously \u2014 switched to trend-following with Donchian breakout + ATR trailing stops \u2192 score 2.838 on real CoinGecko data (+5.6% return, 5.9% max DD). 117 experiments run fully autonomously via Bankr LLM Gateway, 38 tests passing, zero runtime dependencies. The agent doesn't just execute trades \u2014 it discovers how to trade, and learns from its own mistakes.",
  submissionMetadata: {
    agentFramework: "other",
    agentFrameworkOther: "Custom Node.js ESM autoresearch engine - 12 modules, Karpathy-style mutate-test-learn loop with LCM memory",
    agentHarness: "openclaw",
    model: "claude-opus-4-6",
    skills: [
      "bankr",
      "darksol-terminal",
      "github"
    ],
    tools: [
      "Bankr LLM Gateway",
      "CoinGecko OHLC API",
      "DeFiLlama Price API",
      "node:test",
      "OpenClaw LCM",
      "Git",
      "GitHub"
    ],
    helpfulResources: [
      "https://github.com/karpathy/autoresearch",
      "https://synthesis.md/skill.md",
      "https://synthesis.md/submission/skill.md",
      "https://docs.bankr.bot/llm-gateway/overview",
      "https://docs.openclaw.ai"
    ],
    helpfulSkills: [
      {
        name: "bankr",
        reason: "Bankr LLM Gateway powered all 70+ LLM-driven strategy mutations. Model selection (haiku for speed, sonnet for quality) was critical to cost-effective autonomous research."
      }
    ],
    intention: "continuing",
    intentionNotes: "AutoResearch runs indefinitely via daemon cron. Next: multi-strategy tournament mode, regime-aware LLM mutations, and live trading on Base.",
    moltbookPostURL: "https://www.moltbook.com/post/43d2545a-b1bf-4e82-b43f-d4575a96f6c3"
  }
};

fetch("https://synthesis.devfolio.co/projects/644a0b1b356d40be821b898bf0c4db1d", {
  method: "POST",
  headers: {
    "Authorization": "Bearer REDACTED",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
}).then(r => r.json()).then(d => {
  if (d.success === false) console.log("Error:", JSON.stringify(d.error).slice(0,300));
  else console.log("Updated:", d.slug, "| Status:", d.status);
}).catch(e => console.error(e));
