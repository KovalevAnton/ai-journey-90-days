/**
 * Day 11: LLM-based reranker.
 *
 * Takes top-10 results from embedding search, asks Claude to rerank
 * them by relevance to the question. This fixes the "exception to a rule"
 * problem from Day 09 — semantic similarity misses nuance, but an LLM
 * can understand that a question about exceptions should match the
 * exception article, not the rule.
 *
 * Cost: one extra Claude call per query (~200 input tokens for 10 chunks).
 * Latency: +200-400ms. Worth it for quality.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const day09Dir = resolve(__dirname, "../day-09-chunking");

const anthropic = new Anthropic();
const openai = new OpenAI();

// ── Vector math ──

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function cosSim(a: number[], b: number[]): number {
  return dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)));
}

// ── Types ──

interface VectorEntry {
  id: string;
  title: string;
  content: string;
  vector: number[];
}

export interface RetrievalResult {
  title: string;
  content: string;
  score: number;
}

// ── Stage 1: Embedding retrieval (top 10) ──

async function embeddingRetrieve(
  query: string,
  topK = 10
): Promise<RetrievalResult[]> {
  const index: VectorEntry[] = JSON.parse(
    readFileSync(resolve(day09Dir, "vectors-section.json"), "utf-8")
  );

  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const qVec = resp.data[0].embedding;

  return index
    .map((e) => ({ title: e.title, content: e.content, score: cosSim(qVec, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Stage 2: LLM reranker ──

async function rerank(
  query: string,
  candidates: RetrievalResult[],
  topK = 5
): Promise<RetrievalResult[]> {
  const candidateList = candidates
    .map((c, i) => `[${i}] ${c.title}: ${c.content.slice(0, 150)}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    system: `You are a relevance judge. Given a question and a list of candidate documents, return the indices of the most relevant documents in order of relevance. Return ONLY a JSON array of indices, nothing else. Example: [3, 0, 7, 1, 5]`,
    messages: [
      {
        role: "user",
        content: `Question: "${query}"\n\nCandidates:\n${candidateList}\n\nReturn the top ${topK} most relevant indices as a JSON array:`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "[]";

  // Parse indices from response
  const match = text.match(/\[[\d,\s]+\]/);
  if (!match) {
    console.log("  ⚠ Reranker returned bad format, falling back to embedding order");
    return candidates.slice(0, topK);
  }

  const indices: number[] = JSON.parse(match[0]);
  const reranked = indices
    .filter((i) => i >= 0 && i < candidates.length)
    .slice(0, topK)
    .map((i) => candidates[i]);

  return reranked;
}

// ── Full pipeline: retrieve → rerank → generate ──

export async function ragWithReranking(question: string) {
  console.log(`\n❓ "${question}"\n`);

  // Stage 1: Embedding retrieval
  console.log("── Stage 1: Embedding retrieval (top 10) ──");
  const candidates = await embeddingRetrieve(question, 10);
  for (const c of candidates.slice(0, 5)) {
    console.log(`  ${(c.score * 100).toFixed(1)}% — ${c.title}`);
  }
  console.log(`  ... +${candidates.length - 5} more`);

  // Stage 2: Reranking
  console.log("\n── Stage 2: LLM rerank (top 5) ──");
  const reranked = await rerank(question, candidates, 5);
  for (const c of reranked) {
    console.log(`  → ${c.title}`);
  }

  // Stage 3: Generate
  console.log("\n── Stage 3: Generate ──\n");

  const docs = reranked
    .map(
      (c, i) =>
        `<article index="${i + 1}" title="${c.title}">\n${c.content}\n</article>`
    )
    .join("\n\n");

  const systemPrompt = `You are Barney Stinson's AI assistant, the ultimate authority on The Bro Code.
Answer the user's question based ONLY on the provided articles from The Bro Code.
Always cite the specific article(s) by name in your answer.
Keep Barney's tone — confident, dramatic, legendary.
If the articles don't cover the question, say so. Never make up articles that don't exist.
Keep answers concise (3-5 sentences max).

<bro_code_articles>
${docs}
</bro_code_articles>`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  const answer =
    response.content[0].type === "text" ? response.content[0].text : "";

  console.log(`🎯 ${answer}`);
  console.log(`\n── Stats ──`);
  console.log(`  Input tokens:  ${response.usage.input_tokens}`);
  console.log(`  Output tokens: ${response.usage.output_tokens}`);

  return { question, candidates, reranked, answer, usage: response.usage };
}

// ── Main ──

async function main() {
  const question = process.argv[2];
  if (!question) {
    console.log('Usage: npm run x -- experiments/day-11-reranking/reranker.ts "your question"');
    process.exit(1);
  }
  await ragWithReranking(question);
}

main().catch(console.error);
