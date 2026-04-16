// hello.ts
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const client = new Anthropic(); // читает ANTHROPIC_API_KEY из env

const userMessage = `I have 10 years of frontend experience (React, Next, TS)
and I'm pivoting to AI engineering in 90 days. What's the single highest-leverage
thing I should learn in week 1 that I'm probably underestimating?`;

const systems = [
  { tag: "neutral", text: "You are Claude, a helpful AI assistant." },
  {
    tag: "terse-senior",
    text: "You are a terse senior engineer. Answer in at most 3 sentences. No hedging. If the user's question has a wrong premise, say so first.",
  },
  {
    tag: "yc-sceptic",
    text: "You are a sceptical Y Combinator partner. Ask me the single hardest question about my plan instead of answering.",
  },
];

for (const s of systems) {
  const started = Date.now();
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: s.text,
    messages: [{ role: "user", content: userMessage }],
  });
  const ms = Date.now() - started;
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");

  console.log(`\n=== ${s.tag} (${ms}ms) ===`);
  console.log(text);

  mkdirSync("runs", { recursive: true });
  writeFileSync(
    join("runs", `${Date.now()}-${s.tag}.json`),
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        tag: s.tag,
        model: res.model,
        latency_ms: ms,
        system: s.text,
        input: userMessage,
        output: text,
        usage: res.usage,
        stop_reason: res.stop_reason,
      },
      null,
      2,
    ),
  );
}
