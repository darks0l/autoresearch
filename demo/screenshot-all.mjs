import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dirname, 'slides.html'), 'utf-8');

// Start server
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

await new Promise(r => server.listen(9877, r));
console.log('Server on 9877');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

for (let i = 1; i <= 8; i++) {
  await page.goto(`http://localhost:9877?slide=${i}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const path = resolve(__dirname, `slide${String(i).padStart(2, '0')}.jpg`);
  await page.screenshot({ path, type: 'jpeg', quality: 90 });
  console.log(`Captured slide ${i}`);
}

await browser.close();
server.close();
console.log('Done!');
