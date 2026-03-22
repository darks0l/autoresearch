import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '..', 'docs', 'report.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`file://${htmlPath}`);
await page.waitForTimeout(1000);

// Full page screenshot
await page.screenshot({ path: resolve(__dirname, 'report-cover.jpg'), type: 'jpeg', quality: 90, fullPage: false });
console.log('✅ report-cover.jpg saved');

// Also a full-page version
await page.screenshot({ path: resolve(__dirname, 'report-full.jpg'), type: 'jpeg', quality: 85, fullPage: true });
console.log('✅ report-full.jpg saved');

await browser.close();
