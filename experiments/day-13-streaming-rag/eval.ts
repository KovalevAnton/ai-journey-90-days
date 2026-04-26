/**
 * Day 13: Multi-turn RAG eval.
 *
 * Tests that follow-up questions work correctly by maintaining
 * conversation history. Each test is a 2-turn conversation where
 * the second question only makes sense with context from the first.
 *
 * Usage: npm run x -- experiments/day-13-streaming-rag/eval.ts
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

interface MultiTurnCase {
  name: string;
  turn1: { question: string; expectedFact: string };
  turn2: { question: string; expectedFact: string }; // follow-up
}

// ── Test cases ──

const cases: MultiTurnCase[] = [
  {
    name: "Ex Rule follow-up",
    turn1: {
      question: "Can I date my bro's ex-girlfriend?",
      expectedFact: "six months",
    },
    turn2: {
      question: "What if he says it's okay?",
      expectedFact: "consent",
    },
  },
  {
    name: "High Five follow-up",
    turn1: {
      question: "My bro left me hanging on a high five",
      expectedFact: "never",
    },
    turn2: {
      question: "How do I recover from that?",
      expectedFact: "high five",
    },
  },
  {
    name: "Moving Day follow-up",
    turn1: {
      question: "Should I help my bro move?",
      expectedFact: "pizza",
    },
    turn2: {
      question: "What do I get in return?",
      expectedFact: "beer",
    },
  },
  {
    name: "Breakup follow-up",
    turn1: {
      question: "My bro is going through a breakup, what do I do?",
      expectedFact: "vent",
    },
    turn2: {
      question: "How long should I let him talk about it?",
      expectedFact: "breakup",
    },
  },
];

// ── Retrieve ──

async function retrieve(query: string, topK = 5) {
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

// ── Build system prompt ──

function buildSystemPrompt(chunks: { title: string; content: string }[]): string {
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
When the user asks a follow-up question, use the conversation history for context.

<bro_code_articles>
${docs}
</bro_code_articles>`;
}

// ── Generate (non-streaming for eval) ──

async function generate(
  question: string,
  chunks: { title: string; content: string }[],
  history: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const messages = [
    ...history,
    { role: "user" as const, content: question },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: buildSystemPrompt(chunks),
    messages,
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ── Main ──

async function main() {
  console.log(`\nMulti-Turn RAG Eval — ${cases.length} conversations\n`);

  let turn1Pass = 0;
  let turn2Pass = 0;

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    console.log(`[${i + 1}/${cases.length}] ${tc.name}`);

    // Turn 1
    const chunks1 = await retrieve(tc.turn1.question, 5);
    const answer1 = await generate(tc.turn1.question, chunks1, []);
    const t1pass = answer1.toLowerCase().includes(tc.turn1.expectedFact.toLowerCase());
    if (t1pass) turn1Pass++;
    console.log(`  Turn 1 ${t1pass ? "✓" : "✗"}: "${tc.turn1.question.slice(0, 40)}..."`);

    // Turn 2 — with history from turn 1
    const history = [
      { role: "user" as const, content: tc.turn1.question },
      { role: "assistant" as const, content: answer1 },
    ];
    const chunks2 = await retrieve(tc.turn2.question, 5);
    const answer2 = await generate(tc.turn2.question, chunks2, history);
    const t2pass = answer2.toLowerCase().includes(tc.turn2.expectedFact.toLowerCase());
    if (t2pass) turn2Pass++;
    console.log(`  Turn 2 ${t2pass ? "✓" : "✗"}: "${tc.turn2.question.slice(0, 40)}..."`);

    if (!t1pass) console.log(`    Turn 1 missing: "${tc.turn1.expectedFact}" in "${answer1.slice(0, 100)}..."`);
    if (!t2pass) console.log(`    Turn 2 missing: "${tc.turn2.expectedFact}" in "${answer2.slice(0, 100)}..."`);
  }

  console.log(`\n═══ RESULTS ═══`);
  console.log(`  Turn 1 (initial):   ${turn1Pass}/${cases.length} (${Math.round((turn1Pass / cases.length) * 100)}%)`);
  console.log(`  Turn 2 (follow-up): ${turn2Pass}/${cases.length} (${Math.round((turn2Pass / cases.length) * 100)}%)`);
  console.log();
}

main().catch(console.error);
