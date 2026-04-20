/**
 * Step 2: semantic search. Embed a query, find closest chunks.
 * Run after embed.ts has created vectors.json.
 *
 * Usage: npm run search "how do I get a refund?"
 */

import OpenAI from "openai";
import { chunks } from "./docs.js";
import { readFileSync } from "node:fs";

const openai = new OpenAI();

// ── Cosine similarity (from day-03 review, written by hand) ──

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

// ── Load index from disk ──

interface IndexEntry {
  id: string;
  title: string;
  vector: number[];
}

function loadIndex(): IndexEntry[] {
  const raw = readFileSync("vectors.json", "utf-8");
  return JSON.parse(raw);
}

// ── Embed query ──

async function embedQuery(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// ── Search: find top K closest chunks ──

async function search(query: string, topK = 3) {
  const index = loadIndex();
  const queryVec = await embedQuery(query);

  // Score every chunk
  const scored = index.map((entry) => ({
    ...entry,
    score: cosineSimilarity(queryVec, entry.vector),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

// ── Main ──

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.log("Usage: npm run search \"your question here\"");
    process.exit(1);
  }

  console.log(`\nQuery: "${query}"\n`);

  const results = await search(query);

  for (const r of results) {
    // Find original chunk to show full content
    const chunk = chunks.find((c) => c.id === r.id);
    const similarity = (r.score * 100).toFixed(1);

    console.log(`── ${r.title} (${similarity}%) ──`);
    console.log(chunk?.content ?? "(content not found)");
    console.log();
  }
}

main().catch(console.error);
