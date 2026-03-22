import fs from 'fs';

const bankrConfig = JSON.parse(fs.readFileSync('C:/Users/favcr/.bankr/config.json', 'utf8'));
const API_KEY = bankrConfig.apiKey;
const results = [];

async function trade(i) {
  const prompt = i % 2 === 0 ? 'Swap 0.0005 ETH to USDC on Base' : 'Swap 0.5 USDC to ETH on Base';
  try {
    const r1 = await fetch('https://api.bankr.bot/agent/prompt', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, sessionId: 'ar-final-' + Date.now() + '-' + i })
    });
    const j1 = await r1.json();
    if (!j1.jobId) { console.log(i, 'no jobId:', JSON.stringify(j1).slice(0,80)); return; }

    for (let a = 0; a < 15; a++) {
      await new Promise(r => setTimeout(r, 3500));
      const r2 = await fetch('https://api.bankr.bot/agent/job/' + j1.jobId, { headers: { 'X-API-Key': API_KEY } });
      const j2 = await r2.json();
      if (j2.status === 'completed' || j2.status === 'failed') {
        const tx = j2.result?.match(/0x[a-fA-F0-9]{64}/)?.[0];
        if (tx) { results.push({ i, prompt, tx }); console.log('✅ Trade', i+1, tx.slice(0, 14) + '...'); }
        else console.log('⚠️  Trade', i+1, 'done, no TX:', String(j2.result || '').slice(0, 80));
        return;
      }
    }
    console.log('⏱️  Trade', i+1, 'timeout');
  } catch (e) {
    console.log('❌ Trade', i+1, 'error:', e.message);
  }
}

const count = parseInt(process.argv[2] || '20');
console.log(`Running ${count} trades...`);
for (let i = 0; i < count; i++) {
  await trade(i);
}

console.log('\nDONE:', results.length, '/', count, 'trades successful');
fs.writeFileSync('data/final-trades.json', JSON.stringify(results, null, 2));
