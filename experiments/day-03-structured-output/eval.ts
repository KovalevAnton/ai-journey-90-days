import Anthropic from "@anthropic-ai/sdk";
import { BriefSchema } from "./schema.js";
import { cases } from "./cases.js";
import { writeFileSync, mkdirSync } from "node:fs";

const client = new Anthropic();

const SYSTEM = `You extract structured data from freelance project briefs.
Return ONLY a JSON object wrapped in <json></json> XML tags.
The JSON must have exactly these fields:
- title (string): short project title, 2-6 words
- budget_usd (number | null): fixed budget in USD, or null if not stated in USD or not a fixed amount
- deadline (string | null): deadline as stated, or null if not mentioned

Do not add any text outside the <json> tags. Do not explain.`;

async function callClaude(input: string): Promise<string> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: "user", content: input }],
  });
  const block = msg.content[0];
  if (block.type !== "text") throw new Error("non-text block");
  return block.text;
}

function extractJson(raw: string): string | null {
  const match = raw.match(/<json>([\s\S]*?)<\/json>/);
  return match ? match[1].trim() : null;
}

type Result = {
  idx: number;
  tag: string;
  pass: boolean;
  error?: string;
};

async function main() {
  const results: Result[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    try {
      const raw = await callClaude(c.input);
      const jsonStr = extractJson(raw);
      if (!jsonStr) {
        results.push({ idx: i, tag: c.tag, pass: false, error: "no <json> tags found" });
        continue;
      }
      const parsed = JSON.parse(jsonStr);
      const zod = BriefSchema.safeParse(parsed);
      if (!zod.success) {
        const issues = zod.error.issues.map((e) => `${e.path}: ${e.message}`).join("; ");
        results.push({ idx: i, tag: c.tag, pass: false, error: `schema: ${issues}` });
        continue;
      }
      results.push({ idx: i, tag: c.tag, pass: true });
    } catch (err: any) {
      results.push({ idx: i, tag: c.tag, pass: false, error: err.message });
    }
  }

  // Print table
  console.log("\n# | tag                    | result | error");
  console.log("--|------------------------|--------|------");
  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    const err = r.error ?? "";
    console.log(
      `${String(r.idx).padStart(2)} | ${r.tag.padEnd(22)} | ${status.padEnd(6)} | ${err}`
    );
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nScore: ${passed}/${results.length}`);

  // Save run
  mkdirSync("runs", { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(`runs/${ts}.json`, JSON.stringify(results, null, 2));
  console.log(`Saved to runs/${ts}.json`);
}

main().catch(console.error);
