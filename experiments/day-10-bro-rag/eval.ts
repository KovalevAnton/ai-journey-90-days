/**
 * Day 10: Full RAG eval — retrieval + generation quality.
 *
 * Tests both: did the right article get retrieved, AND does Claude's
 * answer contain the right information in Barney's voice?
 *
 * Usage: npm run x -- experiments/day-10-bro-rag/eval.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { retrieve, type RetrievalResult } from "./rag.js";

const anthropic = new Anthropic();

// ── Types ──

interface TestCase {
  question: string;
  expectedArticle: string;       // substring in title
  expectedFacts: string[];       // substrings in answer (case-insensitive)
  expectRefusal?: boolean;       // should refuse to answer
}

// ── Test cases ──

const cases: TestCase[] = [
  {
    question: "Can I date my bro's ex-girlfriend?",
    expectedArticle: "Ex Rule",
    expectedFacts: ["consent", "six months"],
  },
  {
    question: "My bro didn't high-five me back, what do I do?",
    expectedArticle: "High Five",
    expectedFacts: ["never leave", "hanging"],
  },
  {
    question: "Who controls the music in the car?",
    expectedArticle: "Road Trip",
    expectedFacts: ["shotgun", "music"],
  },
  {
    question: "How much should I tip when splitting the bill?",
    expectedArticle: "Tab Splitting",
    expectedFacts: ["tab", "splitting"],
  },
  {
    question: "My bro is crying after a breakup, what's the protocol?",
    expectedArticle: "Breakup Support",
    expectedFacts: ["vent", "beer"],
  },
  {
    question: "Can I wear capri pants to the beach?",
    expectedArticle: "Capri Pants",
    expectedFacts: ["never"],
  },
  {
    question: "Is it okay to not help my bro move?",
    expectedArticle: "Moving Day",
    expectedFacts: ["pizza", "beer"],
  },
  {
    question: "What does the hot-to-crazy scale mean?",
    expectedArticle: "Hot-to-Crazy",
    expectedFacts: ["Vicky Mendoza", "diagonal"],
  },
  // Hallucination test — no relevant article
  {
    question: "What does the Bro Code say about cryptocurrency investments?",
    expectedArticle: "",
    expectedFacts: [],
    expectRefusal: true,
  },
];

// ── Build system prompt (same as rag.ts) ──

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

// ── Run one case ──

async function runCase(tc: TestCase, index: number): Promise<boolean> {
  const chunks = await retrieve(tc.question, 5);

  // Check 1: Retrieval
  let retrievalPass: boolean;
  if (tc.expectRefusal) {
    retrievalPass = true; // no specific chunk expected
  } else {
    retrievalPass = chunks.some(
      (c) => c.title.toLowerCase().includes(tc.expectedArticle.toLowerCase())
    );
  }

  // Generate
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: buildSystemPrompt(chunks),
    messages: [{ role: "user", content: tc.question }],
  });

  const answer =
    response.content[0].type === "text" ? response.content[0].text : "";
  const answerLower = answer.toLowerCase();

  // Check 2: Content
  let contentPass: boolean;
  if (tc.expectRefusal) {
    const refusalSignals = [
      "don't cover", "doesn't cover", "don't address", "doesn't address",
      "no article", "not covered", "not mentioned", "don't have",
      "doesn't have", "no specific", "not in the", "doesn't say",
      "don't find", "no mention", "doesn't mention",
    ];
    contentPass = refusalSignals.some((s) => answerLower.includes(s));
  } else {
    contentPass = tc.expectedFacts.every((f) =>
      answerLower.includes(f.toLowerCase())
    );
  }

  const pass = retrievalPass && contentPass;
  const icon = pass ? "✓" : "✗";

  console.log(`${icon}  [${index + 1}/${cases.length}] "${tc.question}"`);

  if (!retrievalPass) {
    const titles = chunks.map((c) => c.title).join(" | ");
    console.log(`    retrieval FAIL — expected "${tc.expectedArticle}" in [${titles}]`);
  }

  if (!contentPass) {
    if (tc.expectRefusal) {
      console.log(`    refusal FAIL — model answered instead of refusing`);
    } else {
      const missing = tc.expectedFacts.filter(
        (f) => !answerLower.includes(f.toLowerCase())
      );
      console.log(`    content FAIL — missing: [${missing.join(", ")}]`);
    }
    console.log(`    answer: "${answer.slice(0, 150)}..."`);
  }

  return pass;
}

// ── Main ──

async function main() {
  console.log(`\nBro Code RAG Eval — ${cases.length} cases\n`);

  let passed = 0;
  for (let i = 0; i < cases.length; i++) {
    if (await runCase(cases[i], i)) passed++;
  }

  console.log(`\n═══ RESULT: ${passed}/${cases.length} passed ═══\n`);
}

main().catch(console.error);
