# AutoResearch — On-Chain Receipts

> Verified on-chain transactions proving live execution on Base.

---

## Live Trades — 10 Verified Swaps on Base via Bankr

All trades executed autonomously through AutoResearch's execution engine via Bankr wallet on Base mainnet.

### Trade Log

| # | Action | TX Hash | Basescan |
|---|--------|---------|----------|
| 1 | 1 USDC → 0.000464 ETH | `0x752f7393...` | [View →](https://basescan.org/tx/0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8) |
| 2 | 0.50 USDC → 0.000239 ETH | `0xe0632057...` | [View →](https://basescan.org/tx/0xe0632057b061d59f4ba87fbfd60eb047850f939c4a8a34e6f5f94e5d047a6446) |
| 3 | 0.001 ETH → 2.076 USDC | `0x36953cfe...` | [View →](https://basescan.org/tx/0x36953cfe0b1fd9ee24173cee299132504142d3eb90ebf548b0e23b4bbe6ce9cc) |
| 4 | 0.001 ETH → 2.075 USDC | `0x599089ce...` | [View →](https://basescan.org/tx/0x599089ce801485b25d1795e0ca0b98d826be560c2599eaee0312d6e2189c9dd9) |
| 5 | 0.50 USDC → ETH | `0x3682ed12...` | [View →](https://basescan.org/tx/0x3682ed1263f449286110d672a8e66f3b421e33a550b4acef0deb620c40685c29) |
| 6 | 0.001 ETH → 2.076 USDC | `0x137bfaa5...` | [View →](https://basescan.org/tx/0x137bfaa5f80adc9273110f6458c52995edfc4a15c5fd973a9e3b92c428127b36) |
| 7 | 0.25 USDC → 0.000120 ETH | `0x44ba7c16...` | [View →](https://basescan.org/tx/0x44ba7c1685c4b5c93865338de580436be1981c3556f6f6db7c03334319382a32) |
| 8 | 0.0005 ETH → 1.038 USDC | `0xff4e4106...` | [View →](https://basescan.org/tx/0xff4e4106305684e474893c52f06fcaa5bde12a479edbc3de67a45c7b41fd4778) |
| 9 | 0.25 USDC → 0.000120 ETH | `0xf27d6218...` | [View →](https://basescan.org/tx/0xf27d6218976a3fc097c63f051e017845caabfa4a971e1aa652eae58543598f11) |
| 10 | 0.0005 ETH → 1.038 USDC | `0xdd78d34f...` | [View →](https://basescan.org/tx/0xdd78d34f66b021bd10b9322969db5aea14cf0e6e3f672d8262f3a8ee7dd729b8) |

**Wallet:** `0x8f9fa2bfd50079c1767d63effbfe642216bfcb01` ([Basescan →](https://basescan.org/address/0x8f9fa2bfd50079c1767d63effbfe642216bfcb01))
**Chain:** Base (Chain ID: 8453)
**DEX:** Uniswap V3 (routed via Bankr)
**Date:** March 21-22, 2026

### Execution Method

```javascript
// Trades execute via natural language prompts to Bankr API
const res = await fetch('https://api.bankr.bot/agent/prompt', {
  method: 'POST',
  headers: { 'X-API-Key': BANKR_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Swap 0.50 USDC to ETH on Base' })
});
// Async: returns jobId → poll /agent/job/{jobId} → completed with TX hash
```

---

## Bankr LLM Gateway Usage

| Metric | Value |
|--------|-------|
| **Total LLM Calls** | 200+ (222 experiments, some skipped) |
| **Credits Before** | $9.85 |
| **Credits After** | ~$3.13 |
| **Credits Used** | ~$6.72 |
| **Gateway Endpoint** | `llm.bankr.bot` |
| **Models Used** | `claude-haiku-4.5` (exp 46-106), `claude-sonnet-4.5` (exp 109+) |
| **API Pattern** | `/v1/chat/completions` (OpenAI-compatible) |

---

## Bankr Wallet State (March 22, 2026)

| Asset | Balance | USD |
|-------|---------|-----|
| ETH | ~0.005 | ~$10.40 |
| USDC | ~$2.50 | $2.50 |
| BNKR | 8,746 | ~$3.37 |
| **Total** | | **~$16.27** |

---

## Contract Interactions Summary

| Type | Count | Proof |
|------|-------|-------|
| DEX Swaps (Base mainnet) | **10** | All verified on Basescan (links above) |
| LLM Gateway calls | 200+ | Credit deduction $9.85 → $3.13 |

All transactions are on-chain, on mainnet, with real capital. No testnet. No simulations.

---

Built with teeth. 🌑
