# AutoResearch — On-Chain Receipts

> Verified on-chain transactions proving live execution on Base.

---

## Live Trade #1 — Bankr Wallet Swap on Base

| Field | Value |
|-------|-------|
| **Action** | Swap 1 USDC → ETH |
| **Amount In** | 1 USDC |
| **Amount Out** | 0.000463863492482367 ETH |
| **Chain** | Base (Chain ID: 8453) |
| **DEX** | Uniswap V3 (routed via Bankr) |
| **Transaction Hash** | `0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8` |
| **From Wallet** | `0x8f9fa2bfd50079c1767d63effbfe642216bfcb01` (Bankr Primary EVM) |
| **Basescan** | [View Transaction →](https://basescan.org/tx/0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8) |
| **Timestamp** | March 21, 2026 |
| **Triggered By** | AutoResearch execution engine via Bankr LLM |

### How It Was Executed

```javascript
// Natural language trade via Bankr LLM
const response = await fetch('https://api.bankr.bot/agent/prompt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': BANKR_API_KEY
  },
  body: JSON.stringify({
    prompt: 'Swap 1 USDC to ETH on Base with max 0.5% slippage'
  })
});
// Returns jobId → poll /agent/job/{jobId} → completed with TX hash
```

---

## Bankr LLM Gateway Usage

| Metric | Value |
|--------|-------|
| **Total LLM Calls** | ~90+ (116 experiments, some skipped) |
| **Credits Before** | $9.85 |
| **Credits After** | ~$9.15 |
| **Credits Used** | ~$0.70 |
| **Gateway Endpoint** | `llm.bankr.bot` |
| **Models Used** | `claude-haiku-4.5` (experiments 46-106), `claude-sonnet-4.5` (experiments 109+) |
| **API Pattern** | `/v1/chat/completions` (OpenAI-compatible) |

### Credit Verification

```bash
# Check credits via Bankr API
curl https://llm.bankr.bot/v1/credits \
  -H "Authorization: Bearer $BANKR_API_KEY"

# Response:
{
  "object": "credit_balance",
  "balanceUsd": 9.15,
  "effectiveBalanceUsd": 9.15,
  "undeductedCostUsd": 0
}
```

---

## Bankr Wallet State (at time of submission)

| Asset | Balance | Chain |
|-------|---------|-------|
| ETH | ~0.0038 + 0.000464 | Base |
| USDC | ~3.93 | Base |
| BNKR | 8,746 | Base |

**Wallet Address:** `0x8f9fa2bfd50079c1767d63effbfe642216bfcb01`
[View on Basescan →](https://basescan.org/address/0x8f9fa2bfd50079c1767d63effbfe642216bfcb01)

---

## Contract Interactions Summary

| Type | Description | Proof |
|------|-------------|-------|
| DEX Swap | 1 USDC → 0.000464 ETH via Uniswap V3 on Base | [Basescan TX](https://basescan.org/tx/0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8) |
| LLM Gateway | 90+ API calls to Bankr LLM Gateway | Credit deduction from $9.85 → $9.15 |

All transactions are verifiable on-chain. No simulated or testnet transactions.

---

Built with teeth. 🌑
