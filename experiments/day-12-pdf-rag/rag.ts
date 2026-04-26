/**
 * Day 12: RAG over PDF-ingested vectors.
 *
 * Same pipeline as Day 10, but reads vectors from PDF ingestion.
 * Compares page-based vs section-based retrieval quality.
 *
 * Usage: npm run x -- experiments/day-12-pdf-rag/rag.ts "your question"
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const here = (f: string) => resolve(__dirname, f);

const anthropic = new Anthropic();

// Reuse OpenAI for embeddings
import OpenAI from "openai";
const openai = new OpenAI();

// ── Types ──

interface VectorEntry {
  id: string;
  title: string;
  content: string;
  source: string;
  vector: number[];
}

export interface RetrievalResult {
  title: string;
  content: string;
  score: number;
  source: string;
}

// ── Vector math ──

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function cosSim(a: number[], b: number[]): number {
  return dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)));
}

// ── Retrieve ──

export async function retrieve(
  query: string,
  vectorFile: string,
  topK = 5
): Promise<RetrievalResult[]> {
  const index: VectorEntry[] = JSON.parse(
    readFileSync(here(vectorFile), "utf-8")
  );

  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const qVec = resp.data[0].embedding;

  return index
    .map((e) => ({
      title: e.title,
      content: e.content,
      score: cosSim(qVec, e.vector),
      source: e.source,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Build system prompt ──

function buildSystemPrompt(chunks: RetrievalResult[]): string {
  const docs = chunks
    .map(
      (c, i) =>
        `<article index="${i + 1}" title="${c.title}" source="${c.source}">\n${c.content}\n</article>`
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

export async function rag(question: string, vectorFile = "vectors-section.json") {
  console.log(`\n❓ "${question}"\n`);
  console.log(`── Retrieving from ${vectorFile}... ──`);

  const chunks = await retrieve(question, vectorFile, 5);

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
  console.log(`  Source: ${vectorFile}`);
  console.log(`  Input tokens:  ${response.usage.input_tokens}`);
  console.log(`  Output tokens: ${response.usage.output_tokens}`);

  return { question, chunks, answer, usage: response.usage };
}

// ── Main ──

const isMain = process.argv[1]?.endsWith("rag.ts");

if (isMain) {
  const question = process.argv[2];
  if (!question) {
    console.log('Usage: npm run x -- experiments/day-12-pdf-rag/rag.ts "your question"');
    process.exit(1);
  }
  // Run both strategies for comparison
  console.log("\n══════════ PAGE-BASED ══════════");
  await rag(question, "vectors-page.json");
  console.log("\n══════════ SECTION-BASED ══════════");
  await rag(question, "vectors-section.json");
}
