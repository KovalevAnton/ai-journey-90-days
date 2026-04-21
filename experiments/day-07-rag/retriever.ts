/**
 * Retriever module — reuses Day 6 vectors + cosine similarity.
 * Embeds a query via OpenAI, finds top K chunks by cosine similarity.
 */

import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const openai = new OpenAI();
const __dirname = dirname(fileURLToPath(import.meta.url));
const day06Dir = resolve(__dirname, "../day-06-embeddings");

// ── Vector math (hand-written, carried from day-03/day-06) ──

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

interface IndexEntry {
  id: string;
  title: string;
  vector: number[];
}

export interface RetrievalResult {
  id: string;
  title: string;
  content: string;
  score: number;
}

// ── Loaders ──

function loadIndex(): IndexEntry[] {
  const raw = readFileSync(resolve(day06Dir, "vectors.json"), "utf-8");
  return JSON.parse(raw);
}

async function loadChunks() {
  const mod = await import("../day-06-embeddings/docs.js");
  return mod.chunks as { id: string; title: string; content: string }[];
}

async function embedQuery(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// ── Public API ──

export async function retrieve(
  query: string,
  topK = 3
): Promise<RetrievalResult[]> {
  const index = loadIndex();
  const queryVec = await embedQuery(query);

  const scored = index.map((entry) => ({
    ...entry,
    score: cosineSimilarity(queryVec, entry.vector),
  }));

  scored.sort((a, b) => b.score - a.score);

  const chunks = await loadChunks();

  return scored.slice(0, topK).map((s) => {
    const chunk = chunks.find((c) => c.id === s.id);
    return {
      id: s.id,
      title: s.title,
      content: chunk?.content ?? "",
      score: s.score,
    };
  });
}
