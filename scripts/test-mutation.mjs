import { parseMutationResponse, generateMutation } from '../src/controller.js';

// Test parseMutationResponse
const testResp = `HYPOTHESIS: Test change - tighter stops

Here is the modified strategy:
\`\`\`javascript
export class Strategy {
  constructor() {
    this.atrPeriod = 5;
    this.bars = [];
  }
  onBar(barData, portfolio) { return []; }
}
\`\`\``;

const result = parseMutationResponse(testResp);
console.log('Parse result:', JSON.stringify(result).slice(0, 300));
