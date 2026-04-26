/**
 * Step 1: embed all document chunks and save vectors to disk.
 * Run once, then use search.ts to query.
 *
 * This is the "indexing" phase of RAG. In production you'd store
 * vectors in pgvector / Pinecone / Weaviate. Here — a JSON file.
 */

import OpenAI from "openai";
import { chunks } from "./docs.js";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const openai = new OpenAI(); // reads OPENAI_API_KEY from env
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Embed one or more texts in a single API call ──

async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small", // 1536 dimensions, cheapest
    input: texts,
  });

  // response.data is an array of { embedding: number[], index: number }
  // Sort by index to ensure order matches input
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

// ── Main ──

async function main() {
  console.log(`Embedding ${chunks.length} chunks...`);

  // Embed all chunk contents in one batch call (cheaper & faster)
  const texts = chunks.map((c) => `${c.title}: ${c.content}`);
  const vectors = await embedTexts(texts);

  // Build index: array of { id, title, vector }
  const index = chunks.map((chunk, i) => ({
    id: chunk.id,
    title: chunk.title,
    vector: vectors[i],
  }));

  // Save to disk
  writeFileSync(resolve(__dirname, "vectors.json"), JSON.stringify(index));

  console.log(`Saved ${index.length} vectors to vectors.json`);
  console.log(`Dimensions per vector: ${vectors[0].length}`);
  console.log(`File size: ${(JSON.stringify(index).length / 1024).toFixed(0)} KB`);
}

main().catch(console.error);
