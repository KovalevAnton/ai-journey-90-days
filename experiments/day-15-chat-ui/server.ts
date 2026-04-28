/**
 * Day 15: Chat-with-docs API server.
 *
 * Express server that wires together the full RAG pipeline:
 *   POST /api/ingest  — upload + chunk + embed a document
 *   POST /api/chat     — expand → retrieve → stream response (SSE)
 *
 * Usage: npm run x -- experiments/day-15-chat-ui/server.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import express from "express";
import cors from "cors";
import multer from "multer";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const here = (f: string) => resolve(__dirname, f);

const anthropic = new Anthropic();
const openai = new OpenAI();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(here("public")));

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

// ── Vector store (in-memory) ──

let vectorStore: VectorEntry[] = [];
let documentName = "";

function loadVectors() {
  const path = here("vectors.json");
  if (existsSync(path)) {
    vectorStore = JSON.parse(readFileSync(path, "utf-8"));
    documentName = "Previously loaded document";
    console.log(`  Loaded ${vectorStore.length} vectors from disk`);
  }
}

// ── Chunking ──

function chunkBySection(text: string): { id: string; title: string; content: string }[] {
  // Try markdown headers first
  let parts = text.split(/(?=^## )/m).filter((p) => p.trim());

  // If no headers, try "Article N:" pattern
  if (parts.length <= 1) {
    parts = text.split(/(?=Article \d+[\s:—–-])/i).filter((p) => p.trim());
  }

  // Fallback: split by double newlines into ~500 char chunks
  if (parts.length <= 1) {
    const paragraphs = text.split(/\n\n+/);
    parts = [];
    let current = "";
    for (const p of paragraphs) {
      if (current.length + p.length > 500 && current) {
        parts.push(current);
        current = p;
      } else {
        current += (current ? "\n\n" : "") + p;
      }
    }
    if (current) parts.push(current);
  }

  return parts.map((content, i) => {
    const firstLine = content.split("\n")[0].replace(/^##\s*/, "").trim();
    const title = firstLine.slice(0, 80) || `Section ${i + 1}`;
    return { id: `section-${i + 1}`, title, content: content.trim() };
  });
}

// ── Embed ──

async function embedChunks(chunks: { id: string; title: string; content: string }[]): Promise<VectorEntry[]> {
  const batchSize = 20;
  const entries: VectorEntry[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch.map((c) => c.content),
    });
    for (let j = 0; j < batch.length; j++) {
      entries.push({ ...batch[j], vector: resp.data[j].embedding });
    }
  }

  return entries;
}

// ── Retrieve ──

async function retrieve(query: string, topK = 5) {
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const qVec = resp.data[0].embedding;

  return vectorStore
    .map((e) => ({ title: e.title, content: e.content, score: cosSim(qVec, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Query expansion ──

async function expandQuery(question: string, history: Message[]): Promise<string> {
  if (history.length === 0) return question;

  const historyText = history.map((m) => `${m.role}: ${m.content}`).join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    system: `You are a query rewriter. Rewrite the follow-up question to be self-contained using the conversation history. Return ONLY the rewritten question.`,
    messages: [{
      role: "user",
      content: `History:\n${historyText}\n\nFollow-up: "${question}"\n\nRewritten:`,
    }],
  });

  return response.content[0].type === "text"
    ? response.content[0].text.trim().replace(/^["']|["']$/g, "")
    : question;
}

// ── Build system prompt ──

function buildSystemPrompt(chunks: { title: string; content: string }[]): string {
  const docs = chunks
    .map((c, i) => `<article index="${i + 1}" title="${c.title}">\n${c.content}\n</article>`)
    .join("\n\n");

  return `You are a helpful assistant that answers questions based on the provided documents.
Answer based ONLY on the provided articles. Always cite the article title.
If the articles don't cover the question, say so. Never make up information.
Keep answers concise (3-5 sentences max).

<documents>
${docs}
</documents>`;
}

// ── Routes ──

// File upload for ingestion
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/ingest", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const text = req.file.buffer.toString("utf-8");
    documentName = req.file.originalname;

    console.log(`\n📄 Ingesting: ${documentName} (${text.length} chars)`);

    const chunks = chunkBySection(text);
    console.log(`  ${chunks.length} chunks`);

    vectorStore = await embedChunks(chunks);
    writeFileSync(here("vectors.json"), JSON.stringify(vectorStore, null, 2));

    console.log(`  ✓ Ingested and embedded`);

    res.json({
      document: documentName,
      chunks: chunks.length,
      chars: text.length,
    });
  } catch (err: any) {
    console.error("Ingest error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Chat with streaming (SSE)
app.post("/api/chat", async (req, res) => {
  try {
    const { question, history = [] } = req.body as {
      question: string;
      history: Message[];
    };

    if (!question) {
      return res.status(400).json({ error: "No question provided" });
    }

    if (vectorStore.length === 0) {
      return res.status(400).json({ error: "No document loaded. Upload a file first." });
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // 1. Expand query
    const expanded = await expandQuery(question, history);
    res.write(`data: ${JSON.stringify({ type: "status", text: `Searching: "${expanded}"` })}\n\n`);

    // 2. Retrieve
    const chunks = await retrieve(expanded, 5);
    const titles = chunks.map((c) => c.title).join(", ");
    res.write(`data: ${JSON.stringify({ type: "status", text: `Found: ${titles}` })}\n\n`);

    // 3. Stream generation
    const messages: Message[] = [...history, { role: "user", content: question }];

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: buildSystemPrompt(chunks),
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ type: "token", text: event.delta.text })}\n\n`);
      }
    }

    const final = await stream.finalMessage();
    res.write(`data: ${JSON.stringify({
      type: "done",
      usage: { input: final.usage.input_tokens, output: final.usage.output_tokens },
    })}\n\n`);

    res.end();
  } catch (err: any) {
    console.error("Chat error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`);
    res.end();
  }
});

// Document info
app.get("/api/status", (_req, res) => {
  res.json({
    document: documentName || null,
    chunks: vectorStore.length,
  });
});

// ── Start ──

const PORT = 3333;

loadVectors();

app.listen(PORT, () => {
  console.log(`\n🚀 Chat-with-docs server running at http://localhost:${PORT}\n`);
});
