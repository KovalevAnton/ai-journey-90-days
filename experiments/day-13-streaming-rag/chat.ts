/**
 * Day 13: Streaming RAG with multi-turn conversation.
 *
 * Interactive CLI chat over The Bro Code. Features:
 *   1. Streaming — tokens appear as they're generated
 *   2. Multi-turn — conversation history maintained
 *   3. Context-aware — follow-up questions work without restating
 *
 * Usage: npm run x -- experiments/day-13-streaming-rag/chat.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const day09Dir = resolve(__dirname, "../day-09-chunking");

const anthropic = new Anthropic();
const openai = new OpenAI();

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

// ── Vector math ──

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function cosSim(a: number[], b: number[]): number {
  return dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)));
}

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
    .map((e) => ({ title: e.title, content: e.content, score: cosSim(qVec, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Build system prompt ──

function buildSystemPrompt(chunks: { title: string; content: string; score: number }[]): string {
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
When the user asks a follow-up question, use the conversation history for context.

<bro_code_articles>
${docs}
</bro_code_articles>`;
}

// ── Streaming RAG turn ──

async function streamingRagTurn(
  question: string,
  history: Message[]
): Promise<string> {
  // Retrieve based on current question
  process.stdout.write("\x1b[90m  retrieving...\x1b[0m");
  const chunks = await retrieve(question, 5);
  process.stdout.write(
    `\r\x1b[90m  retrieved: ${chunks.map((c) => c.title).join(", ")}\x1b[0m\n\n`
  );

  // Build messages array with history
  const messages: Message[] = [
    ...history,
    { role: "user", content: question },
  ];

  // Stream response
  let fullResponse = "";

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: buildSystemPrompt(chunks),
    messages,
  });

  process.stdout.write("\x1b[33m🎯 \x1b[0m");

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
      fullResponse += event.delta.text;
    }
  }

  const finalMessage = await stream.finalMessage();
  process.stdout.write(
    `\n\n\x1b[90m  tokens: ${finalMessage.usage.input_tokens} in / ${finalMessage.usage.output_tokens} out\x1b[0m\n`
  );

  return fullResponse;
}

// ── Main loop ──

async function main() {
  console.log("\n\x1b[1m══════════════════════════════════════\x1b[0m");
  console.log("\x1b[1m  The Bro Code — Interactive RAG Chat\x1b[0m");
  console.log("\x1b[1m══════════════════════════════════════\x1b[0m");
  console.log("\x1b[90m  Ask anything about The Bro Code.");
  console.log("  Follow-up questions work. Type 'quit' to exit.\x1b[0m\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const history: Message[] = [];

  const prompt = () => {
    rl.question("\x1b[36m❓ You: \x1b[0m", async (input) => {
      const question = input.trim();

      if (!question || question.toLowerCase() === "quit") {
        console.log("\n\x1b[90m  Suit up! 🤵\x1b[0m\n");
        rl.close();
        return;
      }

      try {
        const answer = await streamingRagTurn(question, history);

        // Add to history
        history.push({ role: "user", content: question });
        history.push({ role: "assistant", content: answer });

        console.log();
        prompt();
      } catch (err) {
        console.error("\n  Error:", err);
        prompt();
      }
    });
  };

  prompt();
}

main();
