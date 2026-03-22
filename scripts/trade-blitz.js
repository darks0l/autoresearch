/**
 * trade-blitz.js — Execute multiple small trades on Base via Bankr
 * to demonstrate live autonomous trading capability.
 * 
 * Strategy: alternate ETH→USDC and USDC→ETH swaps in small amounts
 * to generate real on-chain TX receipts.
 */

const API_KEY = process.env.BANKR_API_KEY || (() => {
  try {
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync(require('os').homedir() + '/.bankr/config.json', 'utf-8'));
    return cfg.apiKey;
  } catch { return null; }
})();

if (!API_KEY) { console.error('No BANKR_API_KEY'); process.exit(1); }

const BANKR_API = 'https://api.bankr.bot';

async function sendPrompt(prompt) {
  const res = await fetch(`${BANKR_API}/agent/prompt`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const data = await res.json();
  if (!data.jobId) throw new Error('No jobId: ' + JSON.stringify(data));
  
  // Poll for completion
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const poll = await fetch(`${BANKR_API}/agent/job/${data.jobId}`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const job = await poll.json();
    if (job.status === 'completed') {
      return { success: true, result: job.result || job.response || job };
    }
    if (job.status === 'failed') {
      return { success: false, error: job.error || job };
    }
    process.stdout.write('.');
  }
  return { success: false, error: 'timeout' };
}

async function main() {
  const trades = [
    'Swap 0.50 USDC to ETH on Base',
    'Swap 0.001 ETH to USDC on Base',
    'Swap 0.50 USDC to ETH on Base',
    'Swap 0.001 ETH to USDC on Base',
    'Swap 0.50 USDC to ETH on Base',
    'Swap 0.001 ETH to USDC on Base',
    'Swap 0.25 USDC to ETH on Base',
    'Swap 0.0005 ETH to USDC on Base',
    'Swap 0.25 USDC to ETH on Base',
    'Swap 0.0005 ETH to USDC on Base',
  ];

  const results = [];
  
  for (let i = 0; i < trades.length; i++) {
    console.log(`\n[${i+1}/${trades.length}] ${trades[i]}`);
    try {
      const result = await sendPrompt(trades[i]);
      console.log(result.success ? '✅ ' + JSON.stringify(result.result).substring(0, 200) : '❌ ' + JSON.stringify(result.error).substring(0, 200));
      results.push({ trade: trades[i], ...result, timestamp: new Date().toISOString() });
      
      // Wait between trades to avoid rate limits
      if (i < trades.length - 1) {
        console.log('Waiting 10s...');
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (err) {
      console.log('❌ Error:', err.message);
      results.push({ trade: trades[i], success: false, error: err.message, timestamp: new Date().toISOString() });
    }
  }
  
  // Save results
  const fs = require('fs');
  fs.writeFileSync('data/trade-blitz-results.json', JSON.stringify(results, null, 2));
  
  console.log('\n\n=== TRADE BLITZ RESULTS ===');
  console.log(`Total: ${results.length}`);
  console.log(`Success: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log('Saved to data/trade-blitz-results.json');
}

main().catch(console.error);
