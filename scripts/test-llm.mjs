import CONFIG from '../src/config.js';
import fs from 'fs';

const currentCode = fs.readFileSync('./strategies/strategy.js', 'utf-8').slice(0, 2000);

const prompt = `Current strategy score: 8.176. Best Sharpe we have seen. Need to break past 8.2.

Current strategy code (first 2000 chars):
${currentCode}

Generate ONE targeted mutation. Return in this exact format:

HYPOTHESIS: <one sentence>

\`\`\`javascript
<complete modified strategy.js file>
\`\`\``;

const resp = await fetch(CONFIG.bankr.llmGateway, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${CONFIG.bankr.apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: CONFIG.research.mutationModel,
    messages: [
      { role: 'system', content: 'You are a trading strategy optimizer. Always return the complete modified strategy.js code in a fenced code block.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 3000
  })
});

const data = await resp.json();
const content = data.choices?.[0]?.message?.content || '';
console.log('Content length:', content.length);
console.log('Has code block:', content.includes('```'));
console.log('First 500 chars:', content.slice(0, 500));
