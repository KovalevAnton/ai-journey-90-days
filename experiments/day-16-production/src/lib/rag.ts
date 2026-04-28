/**
 * RAG engine — retrieve + expand + generate.
 * Vectors are pre-computed and shipped with the app.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import vectors from "@/data/vectors.json";

const anthropic = new Anthropic();
const openai = new OpenAI();

// ── Types ──

interface VectorEntry {
  id: string;
  title: string;
  content: string;
  vector: number[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RetrievalResult {
  title: string;
  content: string;
  score: number;
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

export async function retrieve(query: string, topK = 5): Promise<RetrievalResult[]> {
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const qVec = resp.data[0].embedding;

  return (vectors as VectorEntry[])
    .map((e) => ({ title: e.title, content: e.content, score: cosSim(qVec, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Query expansion ──

export async function expandQuery(question: string, history: Message[]): Promise<string> {
  // Always run expansion: handles both history context AND translation to English
  const historyText = history.length > 0
    ? history
        .slice(-6)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
    : "(no history)";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    system: `You are a query rewriter for a retrieval system. The knowledge base is in English.
Rewrite the question to be self-contained (using conversation history if present) AND translate it to English.
Return ONLY the rewritten English question, nothing else.`,
    messages: [{
      role: "user",
      content: `History:\n${historyText}\n\nQuestion: "${question}"\n\nRewritten English query:`,
    }],
  });

  return response.content[0].type === "text"
    ? response.content[0].text.trim().replace(/^["']|["']$/g, "")
    : question;
}

// ── System prompt ──

export function buildSystemPrompt(chunks: RetrievalResult[]): string {
  const docs = chunks
    .map((c, i) => `<article index="${i + 1}" title="${c.title}">\n${c.content}\n</article>`)
    .join("\n\n");

  return `You are Barney Stinson's AI assistant, the ultimate authority on The Bro Code.
Answer the user's question based ONLY on the provided articles from The Bro Code.
Always cite the specific article(s) by name in your answer.
Keep Barney's tone — confident, dramatic, legendary.
If the articles don't cover the question, say so. Never make up articles that don't exist.
Keep answers concise (3-5 sentences max).
IMPORTANT: Always respond in the same language the user writes in. If they write in Spanish, answer in Spanish. If in Russian, answer in Russian. The articles are in English but your response must match the user's language.

<bro_code_articles>
${docs}
</bro_code_articles>`;
}

// ── Streaming generation ──

export function streamAnswer(
  question: string,
  history: Message[],
  chunks: RetrievalResult[]
) {
  const messages: Message[] = [...history, { role: "user", content: question }];

  return anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: buildSystemPrompt(chunks),
    messages,
  });
}
