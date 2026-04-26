/**
 * Day 09: Chunk a real markdown document into overlapping pieces.
 *
 * Three strategies compared:
 * 1. Naive — fixed-size character splits (no awareness of structure)
 * 2. Section-based — split on markdown headers (respects document structure)
 * 3. Overlapping — section-based with overlap between adjacent chunks
 *
 * Usage: npm run chunk
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const here = (f: string) => resolve(__dirname, f);

// ── Types ──

export interface Chunk {
  id: string;
  title: string;
  content: string;
  strategy: "naive" | "section" | "overlap";
  charCount: number;
}

// ── Strategy 1: Naive fixed-size chunking ──

function naiveChunk(text: string, size = 500, step = 500): Chunk[] {
  const chunks: Chunk[] = [];
  for (let i = 0; i < text.length; i += step) {
    const slice = text.slice(i, i + size);
    chunks.push({
      id: `naive-${chunks.length}`,
      title: `Chunk ${chunks.length} (chars ${i}-${i + size})`,
      content: slice.trim(),
      strategy: "naive",
      charCount: slice.trim().length,
    });
  }
  return chunks;
}

// ── Strategy 2: Section-based (split on ## headers) ──

function sectionChunk(text: string): Chunk[] {
  // Split on ## headers (keeping the header with its content)
  const sections = text.split(/(?=^## )/m).filter((s) => s.trim());

  return sections.map((section, i) => {
    // Extract title from header line
    const headerMatch = section.match(/^##\s+(.+)/m);
    const title = headerMatch ? headerMatch[1].trim() : `Section ${i}`;

    // Remove the header line from content, keep body
    const body = section.replace(/^##\s+.+\n*/m, "").trim();

    return {
      id: `section-${i}`,
      title,
      content: body || section.trim(),
      strategy: "section" as const,
      charCount: body.length,
    };
  });
}

// ── Strategy 3: Section-based with overlap ──

function overlapChunk(text: string): Chunk[] {
  const sections = sectionChunk(text);

  return sections.map((chunk, i) => {
    let content = chunk.content;

    // Prepend last 2 sentences of previous section
    if (i > 0) {
      const prevSentences = sections[i - 1].content
        .split(/(?<=[.!?])\s+/)
        .slice(-2)
        .join(" ");
      content = `[context from ${sections[i - 1].title}]: ${prevSentences}\n\n${content}`;
    }

    // Append first 2 sentences of next section
    if (i < sections.length - 1) {
      const nextSentences = sections[i + 1].content
        .split(/(?<=[.!?])\s+/)
        .slice(0, 2)
        .join(" ");
      content = `${content}\n\n[context from ${sections[i + 1].title}]: ${nextSentences}`;
    }

    return {
      ...chunk,
      id: `overlap-${i}`,
      content,
      strategy: "overlap" as const,
      charCount: content.length,
    };
  });
}

// ── Main ──

function main() {
  const raw = readFileSync(here("bro-code.md"), "utf-8");

  console.log(`\nDocument: bro-code.md (${raw.length} chars)\n`);

  // Run all three strategies
  const naive = naiveChunk(raw);
  const section = sectionChunk(raw);
  const overlap = overlapChunk(raw);

  console.log("── Strategy 1: Naive (500-char fixed splits) ──");
  console.log(`  Chunks: ${naive.length}`);
  console.log(
    `  Avg size: ${Math.round(naive.reduce((s, c) => s + c.charCount, 0) / naive.length)} chars`
  );
  console.log(`  Sample: "${naive[0].content.slice(0, 80)}..."\n`);

  console.log("── Strategy 2: Section-based (split on ## headers) ──");
  console.log(`  Chunks: ${section.length}`);
  console.log(
    `  Avg size: ${Math.round(section.reduce((s, c) => s + c.charCount, 0) / section.length)} chars`
  );
  console.log(`  Titles: ${section.slice(0, 5).map((c) => c.title).join(", ")}...\n`);

  console.log("── Strategy 3: Overlapping (sections + context bleed) ──");
  console.log(`  Chunks: ${overlap.length}`);
  console.log(
    `  Avg size: ${Math.round(overlap.reduce((s, c) => s + c.charCount, 0) / overlap.length)} chars`
  );

  // Save all three for embedding comparison
  writeFileSync(here("chunks-naive.json"), JSON.stringify(naive, null, 2));
  writeFileSync(here("chunks-section.json"), JSON.stringify(section, null, 2));
  writeFileSync(here("chunks-overlap.json"), JSON.stringify(overlap, null, 2));

  console.log("\nSaved: chunks-naive.json, chunks-section.json, chunks-overlap.json");

  // Preview: show a section chunk vs its overlapping version
  console.log("\n── Comparison: Section vs Overlap (Article 5) ──");
  const secEx = section.find((c) => c.title.includes("Ex Rule"));
  const overEx = overlap.find((c) => c.title.includes("Ex Rule"));
  if (secEx && overEx) {
    console.log(`\nSection (${secEx.charCount} chars):`);
    console.log(secEx.content);
    console.log(`\nOverlap (${overEx.charCount} chars):`);
    console.log(overEx.content);
  }
}

main();
