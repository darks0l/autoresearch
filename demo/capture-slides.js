/**
 * Capture slides as screenshots using a local HTTP server + browser screenshot
 * Then compile into video with ffmpeg.
 */
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLIDES = 8;
const PORT = 18799;

// Serve the slides HTML
const html = readFileSync(resolve(__dirname, 'slides.html'), 'utf-8');
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(PORT, async () => {
  console.log(`Server on http://localhost:${PORT}`);
  
  // Use PowerShell to take screenshots via browser
  // We'll use the openclaw browser tool approach instead
  console.log('Server ready. Use browser tool to screenshot each slide.');
  console.log('URLs:');
  for (let i = 1; i <= SLIDES; i++) {
    console.log(`  Slide ${i}: http://localhost:${PORT}?slide=${i}`);
  }
  
  // Keep server alive for 120 seconds
  setTimeout(() => {
    server.close();
    console.log('Server closed.');
  }, 120000);
});
