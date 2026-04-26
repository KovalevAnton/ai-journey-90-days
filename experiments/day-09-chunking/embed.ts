/**
 * Day 09: Embed chunks from all three strategies.
 * Saves vectors for each strategy separately.
 *
 * Usage: npm run embed
 */

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Chunk } from "./chunk.js";

const openai = new OpenAI();
const __dirname = dirname(fileURLToPath(import.meta.url));
const here = (f: string) => resolve(__dirname, f);

// ── Embed a batch of texts ──

async function embedBatch(texts: string[]): Promise<number[][]> {
  // OpenAI allows up to 2048 inputs per call, we're well under that
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

// ── Process one strategy ──

async function embedStrategy(filename: string) {
  const chunks: Chunk[] = JSON.parse(readFileSync(here(filename), "utf-8"));

  console.log(`  Embedding ${chunks.length} chunks from ${filename}...`);

  // Embed: title + content for richer vectors
  const texts = chunks.map((c) => `${c.title}: ${c.content}`);
  const vectors = await embedBatch(texts);

  const index = chunks.map((chunk, i) => ({
    id: chunk.id,
    title: chunk.title,
    content: chunk.content,
    vector: vectors[i],
  }));

  const outfile = filename.replace("chunks-", "vectors-");
  writeFileSync(here(outfile), JSON.stringify(index));

  const sizeKB = (JSON.stringify(index).length / 1024).toFixed(0);
  console.log(`  → ${outfile} (${sizeKB} KB, ${vectors[0].length} dims)\n`);
}

// ── Main ──

async function main() {
  console.log("\nEmbedding all three chunking strategies:\n");

  await embedStrategy("chunks-naive.json");
  await embedStrategy("chunks-section.json");
  await embedStrategy("chunks-overlap.json");

  console.log("Done! All vectors saved.");
}

main().catch(console.error);
