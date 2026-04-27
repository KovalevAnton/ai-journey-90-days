/**
 * Day 14: Query expansion for multi-turn RAG.
 *
 * Problem: follow-up questions like "What if he says it's okay?" embed
 * poorly because they lack context. Retrieval returns irrelevant docs.
 *
 * Solution: before retrieval, use Claude to rewrite the vague question
 * into a self-contained query using conversation history.
 *
 * "What if he says it's okay?" → "What if my bro gives explicit consent
 * to date his ex-girlfriend?"
 *
 * Usage: npm run x -- experiments/day-14-query-expansion/expand.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// ── Types ──

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ── Query expansion ──

export async function expandQuery(
  question: string,
  history: Message[]
): Promise<string> {
  // No history = no expansion needed
  if (history.length === 0) return question;

  const historyText = history
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    system: `You are a query rewriter. Given a conversation history and a follow-up question, rewrite the question to be self-contained — it should make sense without the history.

Rules:
- Keep it as a question
- Include all necessary context from the history
- Be concise (one sentence)
- If the question is already self-contained, return it unchanged
- Return ONLY the rewritten question, nothing else`,
    messages: [
      {
        role: "user",
        content: `Conversation history:\n${historyText}\n\nFollow-up question: "${question}"\n\nRewritten question:`,
      },
    ],
  });

  const expanded =
    response.content[0].type === "text"
      ? response.content[0].text.trim().replace(/^["']|["']$/g, "")
      : question;

  return expanded;
}

// ── Demo ──

const demos: { history: Message[]; question: string }[] = [
  {
    history: [
      { role: "user", content: "Can I date my bro's ex-girlfriend?" },
      {
        role: "assistant",
        content:
          "According to Article 5: The Ex Rule, you cannot pursue your Bro's ex without explicit written consent. The waiting period is six months minimum.",
      },
    ],
    question: "What if he says it's okay?",
  },
  {
    history: [
      { role: "user", content: "My bro left me hanging on a high five" },
      {
        role: "assistant",
        content:
          "Article 10: The High Five states that a Bro shall never leave another Bro hanging. This is a serious violation.",
      },
    ],
    question: "How do I recover from that?",
  },
  {
    history: [
      { role: "user", content: "Should I help my bro move?" },
      {
        role: "assistant",
        content:
          "Article 19: Moving Day says a Bro must always help another Bro move. The host must provide pizza and beer.",
      },
    ],
    question: "What do I get in return?",
  },
  {
    history: [
      {
        role: "user",
        content: "What does the hot-to-crazy scale mean?",
      },
      {
        role: "assistant",
        content:
          "Article 34: Hot-to-Crazy Scale describes the Vicky Mendoza Diagonal — the line above which hotness compensates for craziness.",
      },
    ],
    question: "Tell me more about the diagonal",
  },
];

async function main() {
  console.log("\nQuery Expansion Demo\n");

  for (const demo of demos) {
    const lastUserMsg = demo.history[0].content;
    console.log(`  Context: "${lastUserMsg.slice(0, 50)}..."`);
    console.log(`  Follow-up: "${demo.question}"`);

    const expanded = await expandQuery(demo.question, demo.history);
    console.log(`  Expanded: "${expanded}"`);
    console.log();
  }
}

main().catch(console.error);
