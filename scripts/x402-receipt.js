#!/usr/bin/env node
/**
 * Execute a REAL x402 payment on Base via DARKSOL Facilitator
 * Signs EIP-3009 transferWithAuthorization, settles on-chain
 * Creates a verifiable receipt for hackathon submission
 */
import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Config
const FACILITATOR_URL = 'https://facilitator.darksol.net';
const CHAIN_ID = 8453; // Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const RECEIVER = '0x3e6e304421993D7E95a77982E11C93610DD4fFC5'; // AutoResearch service wallet
const AMOUNT = '100000'; // 0.10 USDC (6 decimals) — price of /strategy/signal

// Load deployer key
const keyFile = readFileSync(resolve(__dirname, '../../.keys/base-deployer.txt'), 'utf8');
const pk = keyFile.match(/DEPLOYER_KEY=(0x[a-f0-9]+)/i)?.[1];
if (!pk) throw new Error('No deployer key found');

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(pk, provider);

console.log('🌑 AutoResearch x402 Receipt Generator');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`From:     ${wallet.address}`);
console.log(`To:       ${RECEIVER}`);
console.log(`Amount:   ${parseInt(AMOUNT) / 1e6} USDC`);
console.log(`Chain:    Base (${CHAIN_ID})`);
console.log(`Service:  /strategy/signal`);
console.log();

// EIP-3009 domain and types
const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: CHAIN_ID,
  verifyingContract: USDC_ADDRESS,
};

const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// Generate unique nonce
const nonce = ethers.hexlify(ethers.randomBytes(32));
const validAfter = 0;
const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour

const message = {
  from: wallet.address,
  to: RECEIVER,
  value: AMOUNT,
  validAfter,
  validBefore,
  nonce,
};

console.log('📝 Signing EIP-3009 transferWithAuthorization...');
const signature = await wallet.signTypedData(domain, types, message);
const { v, r, s } = ethers.Signature.from(signature);

console.log(`✅ Signed | nonce: ${nonce.slice(0, 18)}...`);
console.log();

// Step 1: Verify
console.log('🔍 Step 1: Verify via facilitator...');
const verifyPayload = {
  chainId: CHAIN_ID,
  token: USDC_ADDRESS,
  from: wallet.address,
  to: RECEIVER,
  value: AMOUNT,
  validAfter,
  validBefore,
  nonce,
};

const verifyRes = await fetch(`${FACILITATOR_URL}/api/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(verifyPayload),
});
const verifyData = await verifyRes.json();
console.log('Verify:', JSON.stringify(verifyData));

if (!verifyData.valid) {
  console.error('❌ Verification failed:', verifyData.reason);
  process.exit(1);
}
console.log('✅ Payment verified');
console.log();

// Step 2: Settle on-chain
console.log('⛓️  Step 2: Settle on-chain via DARKSOL Facilitator...');
const settlePayload = {
  ...verifyPayload,
  v,
  r,
  s,
};

const settleRes = await fetch(`${FACILITATOR_URL}/api/settle`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(settlePayload),
});
const settleData = await settleRes.json();
console.log('Settle:', JSON.stringify(settleData));

if (!settleData.success) {
  console.error('❌ Settlement failed:', settleData.error || settleData.reason);
  process.exit(1);
}

console.log();
console.log('🎉 x402 PAYMENT SETTLED ON-CHAIN');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`TX Hash:     ${settleData.txHash}`);
console.log(`Block:       ${settleData.blockNumber}`);
console.log(`Gas Used:    ${settleData.gasUsed}`);
console.log(`Amount:      0.10 USDC`);
console.log(`Explorer:    https://basescan.org/tx/${settleData.txHash}`);
console.log(`Facilitator: ${FACILITATOR_URL}`);
console.log(`Protocol:    x402 (EIP-3009)`);
console.log(`Service:     AutoResearch /strategy/signal`);
console.log();

// Save receipt
const receipt = {
  protocol: 'x402',
  standard: 'EIP-3009',
  chain: 'Base',
  chainId: CHAIN_ID,
  facilitator: '0x2c8BcFC4EED3d0F3e25FdAfE084851A19cd59a80',
  facilitatorUrl: FACILITATOR_URL,
  txHash: settleData.txHash,
  blockNumber: settleData.blockNumber,
  gasUsed: settleData.gasUsed,
  from: wallet.address,
  to: RECEIVER,
  amount: '0.10',
  amountRaw: AMOUNT,
  token: 'USDC',
  tokenAddress: USDC_ADDRESS,
  service: '/strategy/signal',
  serviceDescription: 'AutoResearch live trading signal',
  agent: 'ERC-8004 #31929',
  timestamp: new Date().toISOString(),
  explorerUrl: `https://basescan.org/tx/${settleData.txHash}`,
};

writeFileSync(resolve(__dirname, '../data/x402-receipt.json'), JSON.stringify(receipt, null, 2));
console.log('💾 Receipt saved to data/x402-receipt.json');
