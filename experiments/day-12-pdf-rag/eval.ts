/**
 * Day 12: Compare page-based vs section-based retrieval from PDF.
 *
 * Same questions as Day 10 eval, but now over PDF-extracted vectors.
 * Shows how chunking strategy affects retrieval from real PDFs.
 *
 * Usage: npm run x -- experiments/day-12-pdf-rag/eval.ts
 */

import { retrieve } from "./rag.js";

// ── Types ──

interface TestCase {
  question: string;
  expectedSubstring: string; // substring in title or content
  description: string;
}

// ── Test cases (subset from Day 10) ──

const cases: TestCase[] = [
  { question: "Can I date my bro's ex-girlfriend?", expectedSubstring: "ex", description: "Ex Rule" },
  { question: "My bro didn't high-five me back", expectedSubstring: "high five", description: "High Five" },
  { question: "Who controls the music in the car?", expectedSubstring: "shotgun", description: "Shotgun" },
  { question: "How much should I tip when splitting the bill?", expectedSubstring: "tab", description: "Tab Splitting" },
  { question: "My bro is crying after a breakup", expectedSubstring: "breakup", description: "Breakup" },
  { question: "Can I wear capri pants?", expectedSubstring: "capri", description: "Capri Pants" },
  { question: "Should I help my bro move?", expectedSubstring: "mov", description: "Moving Day" },
  { question: "What does the hot-to-crazy scale mean?", expectedSubstring: "crazy", description: "Hot-to-Crazy" },
  { question: "When can I prioritize my girlfriend over bros?", expectedSubstring: "exception", description: "The Hard One" },
  { question: "What's the rule about wingmen?", expectedSubstring: "wing", description: "Wingman" },
];

// ── Check if result matches ──

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
  console.log(`\nPDF RAG Eval — ${cases.length} questions\n`);
  console.log("Comparing page-based vs section-based retrieval from PDF\n");

  let pageScore = 0;
  let sectionScore = 0;

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];

    const pageResults = await retrieve(tc.question, "vectors-page.json", 5);
    const sectionResults = await retrieve(tc.question, "vectors-section.json", 5);

    const pageHit = checkHit(pageResults, tc.expectedSubstring);
    const sectionHit = checkHit(sectionResults, tc.expectedSubstring);

    if (pageHit) pageScore++;
    if (sectionHit) sectionScore++;

    const pIcon = pageHit ? "✓" : "✗";
    const sIcon = sectionHit ? "✓" : "✗";

    console.log(
      `[${i + 1}/${cases.length}] ${tc.description.padEnd(15)} page:${pIcon}  section:${sIcon}  "${tc.question.slice(0, 50)}"`
    );

    if (!pageHit || !sectionHit) {
      if (!pageHit) {
        console.log(`         page top-5: [${pageResults.map((r) => r.title).join(" | ")}]`);
      }
      if (!sectionHit) {
        console.log(`         section top-5: [${sectionResults.map((r) => r.title).join(" | ")}]`);
      }
    }
  }

  console.log(`\n═══ RESULTS ═══`);
  const pPct = Math.round((pageScore / cases.length) * 100);
  const sPct = Math.round((sectionScore / cases.length) * 100);
  console.log(`  Page-based:    ${pageScore}/${cases.length} (${pPct}%) ${"█".repeat(Math.round(pPct / 5))}${"░".repeat(20 - Math.round(pPct / 5))}`);
  console.log(`  Section-based: ${sectionScore}/${cases.length} (${sPct}%) ${"█".repeat(Math.round(sPct / 5))}${"░".repeat(20 - Math.round(sPct / 5))}`);
  console.log();
}

main().catch(console.error);
