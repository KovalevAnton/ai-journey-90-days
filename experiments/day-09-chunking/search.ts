/**
 * Day 09: Compare retrieval quality across three chunking strategies.
 *
 * Usage: npm run search "can I date my bro's ex?"
 */

import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const openai = new OpenAI();
const __dirname = dirname(fileURLToPath(import.meta.url));
const here = (f: string) => resolve(__dirname, f);

// ── Vector math ──

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function norm(v: number[]): number {
  return Math.sqrt(dotProduct(v, v));
}

function cosineSimilarity(a: number[], b: number[]): number {
  return dotProduct(a, b) / (norm(a) * norm(b));
}

// ── Types ──

interface VectorEntry {
  id: string;
  title: string;
  content: string;
  vector: number[];
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
}

// ── Search one index ──

async function searchIndex(
  indexFile: string,
  queryVec: number[],
  topK = 3
): Promise<SearchResult[]> {
  const index: VectorEntry[] = JSON.parse(readFileSync(here(indexFile), "utf-8"));

  const scored = index.map((entry) => ({
    id: entry.id,
    title: entry.title,
    content: entry.content,
    score: cosineSimilarity(queryVec, entry.vector),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// ── Main ──

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.log('Usage: npm run search "your question"');
    process.exit(1);
  }

  // Embed query
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const queryVec = response.data[0].embedding;

  console.log(`\nQuery: "${query}"\n`);

  const strategies = [
    { name: "Naive (500-char)", file: "vectors-naive.json" },
    { name: "Section-based", file: "vectors-section.json" },
    { name: "Overlapping", file: "vectors-overlap.json" },
  ];

  for (const strat of strategies) {
    console.log(`── ${strat.name} ──`);
    const results = await searchIndex(strat.file, queryVec);
    for (const r of results) {
      console.log(`  ${(r.score * 100).toFixed(1)}% — ${r.title}`);
    }
    console.log();
  }
}

main().catch(console.error);
