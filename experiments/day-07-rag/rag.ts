/**
 * Day 07: Full RAG pipeline.
 * 1. Embed the user's question (OpenAI)
 * 2. Retrieve top chunks by cosine similarity
 * 3. Send chunks + question to Claude → get grounded answer
 *
 * Usage: npm run rag "how do I get a refund?"
 */

import Anthropic from "@anthropic-ai/sdk";
import { retrieve, type RetrievalResult } from "./retriever.js";

const anthropic = new Anthropic();

// ── Build the system prompt with retrieved context ──

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

// ── RAG: retrieve + generate ──

async function rag(question: string) {
  // Step 1: Retrieve
  console.log(`\nQuestion: "${question}"\n`);
  console.log("── Retrieving... ──");

  const chunks = await retrieve(question, 3);

  for (const c of chunks) {
    console.log(`  ${c.title} (${(c.score * 100).toFixed(1)}%)`);
  }

  // Step 2: Generate
  console.log("\n── Generating... ──\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: buildSystemPrompt(chunks),
    messages: [{ role: "user", content: question }],
  });

  const answer =
    response.content[0].type === "text" ? response.content[0].text : "";

  console.log(`Answer: ${answer}`);
  console.log(`\n── Stats ──`);
  console.log(`  Input tokens:  ${response.usage.input_tokens}`);
  console.log(`  Output tokens: ${response.usage.output_tokens}`);
  console.log(`  Stop reason:   ${response.stop_reason}`);

  return { question, chunks, answer, usage: response.usage };
}

// ── Main ──

async function main() {
  const question = process.argv[2];
  if (!question) {
    console.log('Usage: npm run rag "your question here"');
    process.exit(1);
  }
  await rag(question);
}

main().catch(console.error);
