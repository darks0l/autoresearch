import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '..', 'docs', 'report.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
await page.goto(`file://${htmlPath}`);
await page.waitForTimeout(1000);

// Capture a taller viewport to include summary + chart
await page.screenshot({ 
  path: resolve(__dirname, 'cover-autoresearch.jpg'), 
  type: 'jpeg', 
  quality: 92,
  clip: { x: 0, y: 0, width: 1280, height: 900 }
});
console.log('✅ cover-autoresearch.jpg saved (summary section)');

await browser.close();
