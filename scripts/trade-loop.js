/**
 * trade-loop.js — Continuous small trades on Base via Bankr
 * Alternates ETH→USDC and USDC→ETH to generate on-chain proof.
 * Usage: node scripts/trade-loop.js [--count 100] [--delay 8]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';

const API_KEY = process.env.BANKR_API_KEY || (() => {
  try {
    return JSON.parse(readFileSync(homedir() + '/.bankr/config.json', 'utf-8')).apiKey;
  } catch { return null; }
})();

if (!API_KEY) { console.error('No BANKR_API_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const COUNT = parseInt(args.find((a,i) => args[i-1] === '--count') || '100');
const DELAY = parseInt(args.find((a,i) => args[i-1] === '--delay') || '8') * 1000;

const TRADES = [
  'Swap 0.0005 ETH to USDC on Base',
  'Swap 1 USDC to ETH on Base',
];

async function sendPrompt(prompt) {
  const res = await fetch('https://api.bankr.bot/agent/prompt', {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const data = await res.json();
  if (!data.jobId) throw new Error('No jobId: ' + JSON.stringify(data));
  
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const poll = await fetch(`https://api.bankr.bot/agent/job/${data.jobId}`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const job = await poll.json();
    if (job.status === 'completed') return { success: true, result: job.result || job.response || JSON.stringify(job) };
    if (job.status === 'failed') return { success: false, error: job.error || JSON.stringify(job) };
  }
  return { success: false, error: 'timeout' };
}

// Extract TX hash from Bankr response
function extractTx(text) {
  const match = String(text).match(/0x[a-fA-F0-9]{64}/);
  return match ? match[0] : null;
}

async function main() {
  const resultsFile = 'data/trade-loop-results.json';
  let results = [];
  if (existsSync(resultsFile)) {
    try { results = JSON.parse(readFileSync(resultsFile, 'utf-8')); } catch {}
  }
  
  let success = 0, fail = 0;
  console.log(`Starting trade loop: ${COUNT} trades, ${DELAY/1000}s delay`);
  console.log(`Existing results: ${results.length}`);
  
  for (let i = 0; i < COUNT; i++) {
    const trade = TRADES[i % TRADES.length];
    const num = results.length + 1;
    process.stdout.write(`[${num}] ${trade} ... `);
    
    try {
      const result = await sendPrompt(trade);
      const tx = result.success ? extractTx(result.result) : null;
      
      if (tx) {
        success++;
        console.log(`✅ ${tx}`);
        results.push({ n: num, trade, tx, success: true, ts: new Date().toISOString() });
      } else if (result.success) {
        // Bankr returned success but might have failed the swap
        const hasError = String(result.result).toLowerCase().includes('fail') || 
                        String(result.result).toLowerCase().includes('error') ||
                        String(result.result).toLowerCase().includes('below');
        if (hasError) {
          fail++;
          console.log(`⚠️ ${String(result.result).substring(0, 100)}`);
          results.push({ n: num, trade, tx: null, success: false, note: String(result.result).substring(0, 200), ts: new Date().toISOString() });
        } else {
          success++;
          console.log(`✅ (no TX hash) ${String(result.result).substring(0, 100)}`);
          results.push({ n: num, trade, tx: null, success: true, note: String(result.result).substring(0, 200), ts: new Date().toISOString() });
        }
      } else {
        fail++;
        console.log(`❌ ${String(result.error).substring(0, 100)}`);
        results.push({ n: num, trade, tx: null, success: false, error: String(result.error).substring(0, 200), ts: new Date().toISOString() });
      }
    } catch (err) {
      fail++;
      console.log(`❌ ${err.message}`);
      results.push({ n: num, trade, tx: null, success: false, error: err.message, ts: new Date().toISOString() });
    }
    
    // Save after every trade
    writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    // Progress report every 10 trades
    if (num % 10 === 0) {
      console.log(`--- Progress: ${num} trades, ${success} success, ${fail} failed ---`);
    }
    
    if (i < COUNT - 1) await new Promise(r => setTimeout(r, DELAY));
  }
  
  console.log(`\n=== FINAL: ${results.length} total, ${success} success, ${fail} failed ===`);
  const txHashes = results.filter(r => r.tx).map(r => r.tx);
  console.log(`Unique TX hashes: ${txHashes.length}`);
}

main().catch(console.error);
