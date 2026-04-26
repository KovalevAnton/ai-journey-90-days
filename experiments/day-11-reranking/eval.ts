/**
 * Day 11: Compare retrieval with and without reranking.
 *
 * Runs the same 12 questions from Day 09 eval, but now with
 * a reranking step. Shows if reranking fixes the edge cases
 * that pure embedding search missed.
 *
 * Usage: npm run x -- experiments/day-11-reranking/eval.ts
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

interface TestCase {
  question: string;
  expectedArticle: string;
  description: string;
}

// ── Same test cases as Day 09 ──

const cases: TestCase[] = [
  { question: "Can I date my bro's ex-girlfriend?", expectedArticle: "Ex Rule", description: "Direct" },
  { question: "Who gets to sit in the front seat of the car?", expectedArticle: "Shotgun", description: "Direct" },
  { question: "My friend is going through a breakup, what should I do?", expectedArticle: "Breakup Support", description: "Direct" },
  { question: "Is it okay to wear shorts that go below the knee?", expectedArticle: "Capri Pants", description: "Indirect" },
  { question: "How do I split the bill at a restaurant with my bros?", expectedArticle: "Tab Splitting", description: "Direct" },
  { question: "My bro left me hanging on a high five", expectedArticle: "High Five", description: "Direct" },
  { question: "What's the rule about texting too much?", expectedArticle: "Drive-By Text", description: "Indirect" },
  { question: "Should I help my friend move to a new apartment?", expectedArticle: "Moving Day", description: "Direct" },
  { question: "How long should a best man speech be?", expectedArticle: "Wedding", description: "Indirect" },
  { question: "Can I switch which football team I support?", expectedArticle: "Sports Allegiance", description: "Indirect" },
  { question: "What does the Vicky Mendoza Diagonal mean?", expectedArticle: "Hot-to-Crazy", description: "Terminology" },
  { question: "When is it okay to prioritize your girlfriend over your friends?", expectedArticle: "Bro Before Ho Exceptions", description: "Exception — THE HARD ONE" },
];

// ── Embedding retrieval ──

async function embeddingRetrieve(queryVec: number[], topK: number) {
  const index: VectorEntry[] = JSON.parse(
    readFileSync(resolve(day09Dir, "vectors-section.json"), "utf-8")
  );

  return index
    .map((e) => ({ title: e.title, content: e.content, score: cosSim(queryVec, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Reranker ──

async function rerank(
  query: string,
  candidates: { title: string; content: string; score: number }[],
  topK: number
) {
  const candidateList = candidates
    .map((c, i) => `[${i}] ${c.title}: ${c.content.slice(0, 150)}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    system: `You are a relevance judge. Given a question and candidate documents, return the indices of the most relevant documents in order. Return ONLY a JSON array of indices.`,
    messages: [
      {
        role: "user",
        content: `Question: "${query}"\n\nCandidates:\n${candidateList}\n\nReturn top ${topK} as JSON array:`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  const match = text.match(/\[[\d,\s]+\]/);
  if (!match) return candidates.slice(0, topK);

  const indices: number[] = JSON.parse(match[0]);
  return indices
    .filter((i) => i >= 0 && i < candidates.length)
    .slice(0, topK)
    .map((i) => candidates[i]);
}

// ── Main ──

async function main() {
  console.log(`\nReranking Eval — ${cases.length} questions\n`);

  let embeddingScore = 0;
  let rerankScore = 0;

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];

    // Embed question
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: tc.question,
    });
    const qVec = resp.data[0].embedding;

    // Embedding top-5
    const embTop5 = await embeddingRetrieve(qVec, 5);
    const embHit = embTop5.some((c) =>
      c.title.toLowerCase().includes(tc.expectedArticle.toLowerCase())
    );
    if (embHit) embeddingScore++;

    // Reranked: retrieve top-10, rerank to top-5
    const candidates = await embeddingRetrieve(qVec, 10);
    const reranked = await rerank(tc.question, candidates, 5);
    const rerankHit = reranked.some((c) =>
      c.title.toLowerCase().includes(tc.expectedArticle.toLowerCase())
    );
    if (rerankHit) rerankScore++;

    const embIcon = embHit ? "✓" : "✗";
    const rerIcon = rerankHit ? "✓" : "✗";

    console.log(
      `[${i + 1}/${cases.length}] ${tc.description.padEnd(18)} emb:${embIcon}  rerank:${rerIcon}  "${tc.question.slice(0, 50)}"`
    );

    if (!embHit || !rerankHit) {
      console.log(`         emb top-5: [${embTop5.map((c) => c.title).join(" | ")}]`);
      console.log(`         reranked:  [${reranked.map((c) => c.title).join(" | ")}]`);
    }
  }

  console.log(`\n═══ RESULTS ═══`);
  const embPct = Math.round((embeddingScore / cases.length) * 100);
  const rerPct = Math.round((rerankScore / cases.length) * 100);
  console.log(`  Embedding only:  ${embeddingScore}/${cases.length} (${embPct}%) ${"█".repeat(Math.round(embPct / 5))}${"░".repeat(20 - Math.round(embPct / 5))}`);
  console.log(`  With reranking:  ${rerankScore}/${cases.length} (${rerPct}%) ${"█".repeat(Math.round(rerPct / 5))}${"░".repeat(20 - Math.round(rerPct / 5))}`);
  console.log(`\n  Improvement: ${rerankScore - embeddingScore} cases fixed by reranking\n`);
}

main().catch(console.error);
