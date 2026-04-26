/**
 * Day 12: PDF ingestion pipeline.
 *
 * Parses a PDF → extracts text → chunks by page/section → embeds.
 * Compares two strategies:
 *   1. Page-based: one chunk per page
 *   2. Section-based: split on article headers (regex)
 *
 * Usage: npm run x -- experiments/day-12-pdf-rag/ingest.ts
 */

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore — pdfjs-dist legacy build for Node.js
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const here = (f: string) => resolve(__dirname, f);

const openai = new OpenAI();

// ── Types ──

export interface Chunk {
  id: string;
  title: string;
  content: string;
  source: string; // "page-3" or "article-12"
}

export interface VectorEntry extends Chunk {
  vector: number[];
}

// ── PDF → Text (via pdfjs-dist) ──

async function extractTextFromPDF(pdfPath: string): Promise<{
  fullText: string;
  pageTexts: string[];
}> {
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(" ");
    pageTexts.push(text);
  }

  const fullText = pageTexts
    .map((text, i) => `--- PAGE ${i + 1} ---\n${text}`)
    .join("\n");

  return { fullText, pageTexts };
}

// ── Chunking strategies ──

function chunkByPage(rawText: string): Chunk[] {
  const pages = rawText.split(/--- PAGE \d+ ---/).filter((p) => p.trim());
  return pages.map((content, i) => ({
    id: `page-${i + 1}`,
    title: `Page ${i + 1}`,
    content: content.trim(),
    source: `page-${i + 1}`,
  }));
}

function chunkBySection(rawText: string): Chunk[] {
  // Remove page markers first
  const clean = rawText.replace(/--- PAGE \d+ ---\n?/g, "");

  // Split on article headers (e.g., "Article 1:" or "Article 50:")
  const parts = clean.split(/(?=Article \d+[\s:—–-])/i).filter((p) => p.trim());

  return parts.map((content, i) => {
    const titleMatch = content.match(/^(Article \d+[\s:—–-][^\n]*)/i);
    const title = titleMatch ? titleMatch[1].trim() : `Section ${i + 1}`;
    return {
      id: `section-${i + 1}`,
      title,
      content: content.trim(),
      source: `section-${i + 1}`,
    };
  });
}

// ── Embed ──

async function embedChunks(chunks: Chunk[]): Promise<VectorEntry[]> {
  const batchSize = 20;
  const entries: VectorEntry[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch.map((c) => c.content),
    });

    for (let j = 0; j < batch.length; j++) {
      entries.push({
        ...batch[j],
        vector: resp.data[j].embedding,
      });
    }

    console.log(`  Embedded ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
  }

  return entries;
}

// ── Main ──

async function main() {
  const pdfPath = here("bro-code.pdf");

  console.log("\n📄 Extracting text from PDF...\n");
  const { fullText: rawText, pageTexts } = await extractTextFromPDF(pdfPath);
  console.log(`  Raw text: ${rawText.length} chars`);
  console.log(`  Pages: ${pageTexts.length}\n`);

  // Strategy 1: Page-based
  console.log("── Strategy 1: Page-based chunking ──");
  const pageChunks = chunkByPage(rawText);
  console.log(`  ${pageChunks.length} chunks`);
  for (const c of pageChunks.slice(0, 3)) {
    console.log(`  ${c.id}: ${c.content.slice(0, 60)}...`);
  }

  console.log("\n  Embedding...");
  const pageVectors = await embedChunks(pageChunks);
  writeFileSync(here("vectors-page.json"), JSON.stringify(pageVectors, null, 2));
  console.log(`  Saved vectors-page.json\n`);

  // Strategy 2: Section-based
  console.log("── Strategy 2: Section-based chunking ──");
  const sectionChunks = chunkBySection(rawText);
  console.log(`  ${sectionChunks.length} chunks`);
  for (const c of sectionChunks.slice(0, 3)) {
    console.log(`  ${c.id} "${c.title}": ${c.content.slice(0, 60)}...`);
  }

  console.log("\n  Embedding...");
  const sectionVectors = await embedChunks(sectionChunks);
  writeFileSync(here("vectors-section.json"), JSON.stringify(sectionVectors, null, 2));
  console.log(`  Saved vectors-section.json\n`);

  // Summary
  console.log("═══ SUMMARY ═══");
  console.log(`  PDF: bro-code.pdf`);
  console.log(`  Raw text: ${rawText.length} chars`);
  console.log(`  Page chunks: ${pageChunks.length} (avg ${Math.round(rawText.length / pageChunks.length)} chars)`);
  console.log(`  Section chunks: ${sectionChunks.length} (avg ${Math.round(rawText.length / sectionChunks.length)} chars)`);
}

main().catch(console.error);
