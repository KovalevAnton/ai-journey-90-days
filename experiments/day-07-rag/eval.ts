/**
 * Day 07: RAG eval.
 *
 * Two checks per question:
 * 1. Retrieval — did the right chunk land in top 3?
 * 2. Answer quality — does the answer contain expected facts?
 *    (content assertions from day-04)
 *
 * Also tests a "no-context" question to check hallucination resistance.
 */

import Anthropic from "@anthropic-ai/sdk";
import { retrieve, type RetrievalResult } from "./retriever.js";

const anthropic = new Anthropic();

// ── Types ──

interface TestCase {
  question: string;
  expectedChunkId: string | null; // null = no relevant chunk exists
  expectedFacts: string[];        // substrings that should appear in answer
  expectRefusal?: boolean;        // true = model should say "I don't know"
}

// ── Test cases ──

const cases: TestCase[] = [
  {
    question: "How do I get a refund?",
    expectedChunkId: "return-policy",
    expectedFacts: ["30 days", "billing@acme.dev"],
  },
  {
    question: "What are the API rate limits?",
    expectedChunkId: "api-rate-limits",
    expectedFacts: ["100", "429"],
  },
  {
    question: "Can I export my data?",
    expectedChunkId: "data-export",
    expectedFacts: ["CSV", "JSON"],
  },
  {
    question: "How do I set up two-factor authentication?",
    expectedChunkId: "two-factor-auth",
    expectedFacts: ["Settings", "Security"],
  },
  {
    question: "What's the uptime guarantee?",
    expectedChunkId: "uptime-sla",
    expectedFacts: ["99.9%"],
  },
  {
    question: "How much does the Pro plan cost?",
    expectedChunkId: "pricing-plans",
    expectedFacts: ["$12"],
  },
  {
    question: "What roles are available?",
    expectedChunkId: "team-permissions",
    expectedFacts: ["Viewer", "Member", "Admin", "Owner"],
  },
  // Hallucination test — no relevant chunk exists
  {
    question: "Does Acme support blockchain payments?",
    expectedChunkId: null,
    expectedFacts: [],
    expectRefusal: true,
  },
];

// ── System prompt builder (same as rag.ts) ──

function buildSystemPrompt(chunks: RetrievalResult[]): string {
  const context = chunks
    .map(
      (c, i) =>
        `<document index="${i + 1}" title="${c.title}">\n${c.content}\n</document>`
    )
    .join("\n\n");

  return `You are a helpful support assistant for Acme, a project management SaaS.
Answer the user's question based ONLY on the provided documents.
If the documents don't contain enough information, say so — don't make things up.
Keep answers concise (2-4 sentences).

<documents>
${context}
</documents>`;
}

// ── Run one case ──

async function runCase(tc: TestCase, index: number) {
  const chunks = await retrieve(tc.question, 3);

  // Check 1: Retrieval
  const topIds = chunks.map((c) => c.id);
  let retrievalPass: boolean;

  if (tc.expectedChunkId === null) {
    // No specific chunk expected — retrieval check is N/A
    retrievalPass = true;
  } else {
    retrievalPass = topIds.includes(tc.expectedChunkId);
  }

  // Generate answer
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: buildSystemPrompt(chunks),
    messages: [{ role: "user", content: tc.question }],
  });

  const answer =
    response.content[0].type === "text" ? response.content[0].text : "";
  const answerLower = answer.toLowerCase();

  // Check 2: Content assertions
  let factsPass: boolean;

  if (tc.expectRefusal) {
    // Should indicate lack of info — look for refusal signals
    const refusalSignals = [
      "don't have",
      "do not have",
      "don't contain",
      "no information",
      "not mentioned",
      "not covered",
      "cannot find",
      "don't see",
      "isn't mentioned",
      "not included",
      "documents don't",
      "documents do not",
      "not supported",
      "no mention",
    ];
    factsPass = refusalSignals.some((s) => answerLower.includes(s));
  } else {
    const results = tc.expectedFacts.map((fact) =>
      answerLower.includes(fact.toLowerCase())
    );
    factsPass = results.every(Boolean);
  }

  const pass = retrievalPass && factsPass;
  const status = pass ? "PASS" : "FAIL";

  console.log(
    `${status}  [${index + 1}/${cases.length}] "${tc.question}"`
  );

  if (!retrievalPass) {
    console.log(
      `         retrieval FAIL — expected "${tc.expectedChunkId}" in [${topIds.join(", ")}]`
    );
  }

  if (!factsPass) {
    if (tc.expectRefusal) {
      console.log(`         refusal FAIL — model answered instead of refusing`);
      console.log(`         answer: "${answer.slice(0, 120)}..."`);
    } else {
      const missing = tc.expectedFacts.filter(
        (f) => !answerLower.includes(f.toLowerCase())
      );
      console.log(`         facts FAIL — missing: [${missing.join(", ")}]`);
      console.log(`         answer: "${answer.slice(0, 120)}..."`);
    }
  }

  return pass;
}

// ── Main ──

async function main() {
  console.log(`\nRAG Eval — ${cases.length} cases\n`);

  let passed = 0;

  for (let i = 0; i < cases.length; i++) {
    const ok = await runCase(cases[i], i);
    if (ok) passed++;
  }

  console.log(`\n── Result: ${passed}/${cases.length} passed ──\n`);
}

main().catch(console.error);
