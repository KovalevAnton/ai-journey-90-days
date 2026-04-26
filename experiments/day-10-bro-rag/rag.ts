/**
 * Day 10: Full RAG pipeline over The Bro Code.
 *
 * Retrieves top chunks using Day 09 section-based vectors,
 * sends them to Claude, gets a grounded answer citing articles.
 *
 * Usage: npm run x -- experiments/day-10-bro-rag/rag.ts "Can I date my bro's ex?"
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

// ── Retrieve ──

export async function retrieve(
  query: string,
  topK = 5
): Promise<RetrievalResult[]> {
  const index: VectorEntry[] = JSON.parse(
    readFileSync(resolve(day09Dir, "vectors-section.json"), "utf-8")
  );

  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const qVec = resp.data[0].embedding;

  const scored = index
    .map((e) => ({ title: e.title, content: e.content, score: cosSim(qVec, e.vector) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

// ── Build system prompt ──

function buildSystemPrompt(chunks: RetrievalResult[]): string {
  const docs = chunks
    .map(
      (c, i) =>
        `<article index="${i + 1}" title="${c.title}">\n${c.content}\n</article>`
    )
    .join("\n\n");

  return `You are Barney Stinson's AI assistant, the ultimate authority on The Bro Code.
Answer the user's question based ONLY on the provided articles from The Bro Code.
Always cite the specific article(s) by name in your answer.
Keep Barney's tone — confident, dramatic, legendary.
If the articles don't cover the question, say so. Never make up articles that don't exist.
Keep answers concise (3-5 sentences max).

<bro_code_articles>
${docs}
</bro_code_articles>`;
}

// ── RAG pipeline ──

export async function rag(question: string) {
  console.log(`\n❓ "${question}"\n`);
  console.log("── Retrieving... ──");

  const chunks = await retrieve(question, 5);

  for (const c of chunks) {
    console.log(`  ${(c.score * 100).toFixed(1)}% — ${c.title}`);
  }

  console.log("\n── Generating... ──\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: buildSystemPrompt(chunks),
    messages: [{ role: "user", content: question }],
  });

  const answer =
    response.content[0].type === "text" ? response.content[0].text : "";

  console.log(`🎯 ${answer}`);
  console.log(`\n── Stats ──`);
  console.log(`  Input tokens:  ${response.usage.input_tokens}`);
  console.log(`  Output tokens: ${response.usage.output_tokens}`);

  return { question, chunks, answer, usage: response.usage };
}

// ── Main (only runs when executed directly, not when imported) ──

const isMain = process.argv[1]?.endsWith("rag.ts");

if (isMain) {
  const question = process.argv[2];
  if (!question) {
    console.log('Usage: npm run x -- experiments/day-10-bro-rag/rag.ts "your question"');
    process.exit(1);
  }
  rag(question).catch(console.error);
}
