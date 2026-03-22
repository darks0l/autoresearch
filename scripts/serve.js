#!/usr/bin/env node
/**
 * Launch AutoResearch x402 Service
 * 
 * Usage:
 *   node scripts/serve.js [--port 18793]
 * 
 * Environment:
 *   AUTORESEARCH_PORT   — Port (default: 18793)
 *   FACILITATOR_URL     — DARKSOL Facilitator URL
 *   RECEIVER_WALLET     — Payment receiver address
 *   BANKR_API_KEY       — Bankr API key for LLM mutations
 */

const port = process.argv.includes('--port')
  ? process.argv[process.argv.indexOf('--port') + 1]
  : process.env.AUTORESEARCH_PORT || '18793';

process.env.AUTORESEARCH_PORT = port;

// Import and start server — dynamic import so env is set first
await import('../src/server.js');
