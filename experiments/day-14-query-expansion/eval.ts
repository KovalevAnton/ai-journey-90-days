/**
 * Day 14: Query expansion eval.
 *
 * Compares retrieval quality for follow-up questions:
 *   1. Raw question (no context) → retrieve
 *   2. Expanded question (rewritten with history) → retrieve
 *
 * Usage: npm run x -- experiments/day-14-query-expansion/eval.ts
 */

import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expandQuery } from "./expand.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const day09Dir = resolve(__dirname, "../day-09-chunking");

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

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TestCase {
  name: string;
  history: Message[];
  followUp: string;
  expectedSubstring: string;
}

// ── Test cases ──

const cases: TestCase[] = [
  {
    name: "Ex Rule consent",
    history: [
      { role: "user", content: "Can I date my bro's ex-girlfriend?" },
      {
        role: "assistant",
        content:
          "According to Article 5: The Ex Rule, you cannot pursue your Bro's ex without explicit written consent. Waiting period is six months.",
      },
    ],
    followUp: "What if he says it's okay?",
    expectedSubstring: "ex",
  },
  {
    name: "High five recovery",
    history: [
      { role: "user", content: "My bro left me hanging on a high five" },
      {
        role: "assistant",
        content:
          "Article 10: The High Five — a Bro shall never leave another Bro hanging.",
      },
    ],
    followUp: "How do I recover from that?",
    expectedSubstring: "high five",
  },
  {
    name: "Moving reward",
    history: [
      { role: "user", content: "Should I help my bro move?" },
      {
        role: "assistant",
        content:
          "Article 19: Moving Day — a Bro must always help another Bro move. Pizza and beer required.",
      },
    ],
    followUp: "What do I get in return?",
    expectedSubstring: "mov",
  },
  {
    name: "Breakup duration",
    history: [
      { role: "user", content: "My bro is going through a breakup" },
      {
        role: "assistant",
        content:
          "Article 37: Breakup Support — let him vent, provide beer, don't mention the ex for two weeks.",
      },
    ],
    followUp: "How long should I keep this up?",
    expectedSubstring: "breakup",
  },
  {
    name: "Crazy scale details",
    history: [
      { role: "user", content: "What does the hot-to-crazy scale mean?" },
      {
        role: "assistant",
        content:
          "Article 34: Hot-to-Crazy Scale — the Vicky Mendoza Diagonal is the line above which hotness compensates for craziness.",
      },
    ],
    followUp: "Tell me more about the diagonal",
    expectedSubstring: "crazy",
  },
  {
    name: "Wingman duties",
    history: [
      { role: "user", content: "What's the wingman oath?" },
      {
        role: "assistant",
        content:
          "Article 3: The Wingman Oath — a Bro must always serve as wingman when called upon.",
      },
    ],
    followUp: "What exactly do I have to do?",
    expectedSubstring: "wing",
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
    .map((e) => ({
      title: e.title,
      content: e.content,
      score: cosSim(qVec, e.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Check hit ──

function checkHit(
  results: { title: string; content: string }[],
  expected: string
): boolean {
  return results.some(
    (r) =>
      r.title.toLowerCase().includes(expected.toLowerCase()) ||
      r.content.toLowerCase().includes(expected.toLowerCase())
  );
}

// ── Main ──

async function main() {
  console.log(`\nQuery Expansion Eval — ${cases.length} follow-up questions\n`);

  let rawScore = 0;
  let expandedScore = 0;

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];

    // 1. Expand the query
    const expanded = await expandQuery(tc.followUp, tc.history);

    // 2. Retrieve with raw follow-up
    const rawResults = await retrieve(tc.followUp, 5);
    const rawHit = checkHit(rawResults, tc.expectedSubstring);
    if (rawHit) rawScore++;

    // 3. Retrieve with expanded query
    const expResults = await retrieve(expanded, 5);
    const expHit = checkHit(expResults, tc.expectedSubstring);
    if (expHit) expandedScore++;

    const rawIcon = rawHit ? "✓" : "✗";
    const expIcon = expHit ? "✓" : "✗";

    console.log(`[${i + 1}/${cases.length}] ${tc.name}`);
    console.log(`  Follow-up: "${tc.followUp}"`);
    console.log(`  Expanded:  "${expanded}"`);
    console.log(`  Raw: ${rawIcon}  Expanded: ${expIcon}`);

    if (!rawHit) {
      console.log(`  Raw top-5: [${rawResults.map((r) => r.title).join(" | ")}]`);
    }
    if (!expHit) {
      console.log(`  Exp top-5: [${expResults.map((r) => r.title).join(" | ")}]`);
    }
    console.log();
  }

  console.log(`═══ RESULTS ═══`);
  const rawPct = Math.round((rawScore / cases.length) * 100);
  const expPct = Math.round((expandedScore / cases.length) * 100);
  console.log(
    `  Raw follow-up:      ${rawScore}/${cases.length} (${rawPct}%) ${"█".repeat(Math.round(rawPct / 5))}${"░".repeat(20 - Math.round(rawPct / 5))}`
  );
  console.log(
    `  With expansion:     ${expandedScore}/${cases.length} (${expPct}%) ${"█".repeat(Math.round(expPct / 5))}${"░".repeat(20 - Math.round(expPct / 5))}`
  );
  console.log(
    `\n  Improvement: ${expandedScore - rawScore} cases fixed by query expansion\n`
  );
}

main().catch(console.error);
