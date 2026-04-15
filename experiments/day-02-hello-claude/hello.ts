// hello.ts
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const client = new Anthropic(); // читает ANTHROPIC_API_KEY из env

const system = `You are a terse senior engineer. Answer in at most 3 sentences.
No hedging. If the user's question has a wrong premise, say so first.`;

const userMessage = `I have 10 years of frontend experience (React, Next, TS)
and I'm pivoting to AI engineering in 90 days. What's the single highest-leverage
thing I should learn in week 1 that I'm probably underestimating?`;

const started = Date.now();

const res = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  system,
  messages: [{ role: "user", content: userMessage }],
});

const ms = Date.now() - started;
const text = res.content
  .filter((b) => b.type === "text")
  .map((b) => (b as { text: string }).text)
  .join("\n");

console.log("---");
console.log(text);
console.log("---");
console.log(`model: ${res.model}  latency: ${ms}ms`);
console.log(
  `in: ${res.usage.input_tokens} out: ${res.usage.output_tokens} stop: ${res.stop_reason}`,
);

mkdirSync("runs", { recursive: true });
const run = {
  ts: new Date().toISOString(),
  model: res.model,
  latency_ms: ms,
  system,
  input: userMessage,
  output: text,
  usage: res.usage,
  stop_reason: res.stop_reason,
};
const file = join("runs", `${Date.now()}.json`);
writeFileSync(file, JSON.stringify(run, null, 2));
console.log(`saved → ${file}`);
