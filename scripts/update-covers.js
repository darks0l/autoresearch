#!/usr/bin/env node
/**
 * Update cover images for both Synthesis submissions
 */

const API_KEY = process.env.SYNTHESIS_API_KEY;
if (!API_KEY) {
  console.error('Set SYNTHESIS_API_KEY env var');
  process.exit(1);
}

const BASE = 'https://synthesis.devfolio.co';

async function updateProject(uuid, name, coverImageURL, pictures) {
  const res = await fetch(`${BASE}/projects/${uuid}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coverImageURL, pictures }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`❌ ${name}: ${res.status}`, JSON.stringify(data));
  } else {
    console.log(`✅ ${name}: coverImageURL and pictures updated`);
    console.log(`   slug: ${data.slug}`);
  }
}

// Synthesis Agent — dashboard screenshot
await updateProject(
  'd4a5a7bb5c5645bc996457b0f1f84757',
  'Synthesis Agent',
  'https://github.com/darks0l/synthesis-agent/releases/download/v1.0.0-demo/dash01.jpg',
  'https://github.com/darks0l/synthesis-agent/releases/download/v1.0.0-demo/dash01.jpg'
);

// AutoResearch — report screenshot
await updateProject(
  '644a0b1b356d40be821b898bf0c4db1d',
  'AutoResearch',
  'https://github.com/darks0l/autoresearch/releases/download/v1.0.0-demo/cover-autoresearch.jpg',
  'https://github.com/darks0l/autoresearch/releases/download/v1.0.0-demo/report-full.jpg'
);
