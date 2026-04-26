/**
 * Day 09: Eval — compare retrieval accuracy across chunking strategies.
 *
 * For each test question, checks if the correct article lands in top-3
 * results for each strategy. Then compares which strategy wins.
 *
 * Usage: npm run eval
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

interface TestCase {
  question: string;
  expectedArticle: string; // substring that should be in the top result's title or content
  description: string;     // what we're testing
}

// ── Test cases ──

const cases: TestCase[] = [
  {
    question: "Can I date my bro's ex-girlfriend?",
    expectedArticle: "Ex Rule",
    description: "Direct question about the ex rule",
  },
  {
    question: "Who gets to sit in the front seat of the car?",
    expectedArticle: "Shotgun",
    description: "Shotgun rules",
  },
  {
    question: "My friend is going through a breakup, what should I do?",
    expectedArticle: "Breakup Support",
    description: "Breakup support protocol",
  },
  {
    question: "Is it okay to wear shorts that go below the knee?",
    expectedArticle: "Capri Pants",
    description: "Capri pants ban (indirect question)",
  },
  {
    question: "How do I split the bill at a restaurant with my bros?",
    expectedArticle: "Tab Splitting",
    description: "Tab splitting etiquette",
  },
  {
    question: "My bro left me hanging on a high five",
    expectedArticle: "High Five",
    description: "High five protocol",
  },
  {
    question: "What's the rule about texting too much?",
    expectedArticle: "Drive-By Text",
    description: "Text message limits",
  },
  {
    question: "Should I help my friend move to a new apartment?",
    expectedArticle: "Moving Day",
    description: "Moving day obligations",
  },
  {
    question: "How long should a best man speech be?",
    expectedArticle: "Wedding",
    description: "Wedding behavior (indirect — speech length)",
  },
  {
    question: "Can I switch which football team I support?",
    expectedArticle: "Sports Allegiance",
    description: "Sports allegiance (indirect question)",
  },
  {
    question: "What does the Vicky Mendoza Diagonal mean?",
    expectedArticle: "Hot-to-Crazy",
    description: "Hot-to-crazy scale terminology",
  },
  {
    question: "When is it okay to prioritize your girlfriend over your friends?",
    expectedArticle: "Bro Before Ho Exceptions",
    description: "The One exception (nuanced question)",
  },
];

// ── Search ──

function searchIndex(index: VectorEntry[], queryVec: number[], topK = 3) {
  const scored = index.map((entry) => ({
    ...entry,
    score: cosineSimilarity(queryVec, entry.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// ── Main ──

async function main() {
  console.log(`\nBro Code Retrieval Eval — ${cases.length} questions\n`);

  const strategies = [
    { name: "Naive", file: "vectors-naive.json" },
    { name: "Section", file: "vectors-section.json" },
    { name: "Overlap", file: "vectors-overlap.json" },
  ];

  // Load all indices
  const indices: Record<string, VectorEntry[]> = {};
  for (const s of strategies) {
    try {
      indices[s.name] = JSON.parse(readFileSync(here(s.file), "utf-8"));
    } catch {
      console.log(`  ⚠ ${s.file} not found — run embed.ts first`);
      return;
    }
  }

  // Score tracking
  const scores: Record<string, number> = {};
  for (const s of strategies) scores[s.name] = 0;

  // Run each case
  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];

    // Embed question
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: tc.question,
    });
    const queryVec = response.data[0].embedding;

    console.log(`[${i + 1}/${cases.length}] "${tc.question}"`);
    console.log(`  Expected: ${tc.expectedArticle} (${tc.description})`);

    for (const s of strategies) {
      const results = searchIndex(indices[s.name], queryVec);
      const topTitles = results.map((r) => r.title);

      // Check if expected article is in top 3 (by title substring match)
      const found = results.some(
        (r) =>
          r.title.toLowerCase().includes(tc.expectedArticle.toLowerCase()) ||
          r.content.toLowerCase().includes(tc.expectedArticle.toLowerCase())
      );

      if (found) {
        scores[s.name]++;
        console.log(`  ✓ ${s.name}: [${topTitles.join(" | ")}]`);
      } else {
        console.log(`  ✗ ${s.name}: [${topTitles.join(" | ")}]`);
      }
    }
    console.log();
  }

  // Summary
  console.log("═══ RESULTS ═══\n");
  for (const s of strategies) {
    const pct = Math.round((scores[s.name] / cases.length) * 100);
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    console.log(`  ${s.name.padEnd(10)} ${scores[s.name]}/${cases.length} (${pct}%) ${bar}`);
  }
  console.log();

  // Winner
  const winner = strategies.reduce((best, s) =>
    scores[s.name] > scores[best.name] ? s : best
  );
  console.log(`  Winner: ${winner.name} strategy\n`);
}

main().catch(console.error);
