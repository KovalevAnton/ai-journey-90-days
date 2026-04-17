import Anthropic from "@anthropic-ai/sdk";
import { BriefSchema, type Brief } from "./schema.js";
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

// ── Content assertions ─────────────────────────────────

type FieldResult = { field: string; pass: boolean; expected: unknown; got: unknown };

function checkTitle(got: string, expected: string): FieldResult {
  // Fuzzy stem match: compare first 5 chars of each keyword (>3 letters)
  // "illustration" and "illustrator" both stem to "illus" → match
  const stem = (w: string) => w.toLowerCase().slice(0, 5);
  const keywords = expected.split(/\s+/).filter((w) => w.length > 3);
  const gotWords = got.toLowerCase();
  const pass = keywords.every((kw) => gotWords.includes(stem(kw)));
  return { field: "title", pass, expected, got };
}

function checkExact(field: string, got: unknown, expected: unknown): FieldResult {
  const pass = got === expected;
  return { field, pass, expected, got };
}

function checkDeadline(got: string | null, expected: string | null): FieldResult {
  // Both null → pass. One null → fail. Otherwise: expected must appear inside got.
  // "August 2026" matches "3 months starting August 2026".
  if (got === null && expected === null) return { field: "deadline", pass: true, expected, got };
  if (got === null || expected === null) return { field: "deadline", pass: false, expected, got };
  const pass = got.toLowerCase().includes(expected.toLowerCase());
  return { field: "deadline", pass, expected, got };
}

function checkContent(got: Brief, expected: Brief): FieldResult[] {
  return [
    checkTitle(got.title, expected.title),
    checkExact("budget_usd", got.budget_usd, expected.budget_usd),
    checkDeadline(got.deadline, expected.deadline),
  ];
}

// ── Main ────────────────────────────────────────────────

type Result = {
  idx: number;
  tag: string;
  schemaPass: boolean;
  fields: FieldResult[];
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
        results.push({ idx: i, tag: c.tag, schemaPass: false, fields: [], error: "no <json> tags" });
        continue;
      }
      const parsed = JSON.parse(jsonStr);
      const zod = BriefSchema.safeParse(parsed);
      if (!zod.success) {
        const msg = zod.error.issues.map((e) => `${e.path}: ${e.message}`).join("; ");
        results.push({ idx: i, tag: c.tag, schemaPass: false, fields: [], error: msg });
        continue;
      }
      const fields = checkContent(zod.data, c.expected);
      results.push({ idx: i, tag: c.tag, schemaPass: true, fields });
    } catch (err: any) {
      results.push({ idx: i, tag: c.tag, schemaPass: false, fields: [], error: err.message });
    }
  }

  // ── Print table ──
  console.log("\n #  tag                     schema  title   budget  deadline  errors");
  console.log("──  ──────────────────────  ──────  ──────  ──────  ────────  ──────");
  let schemaTotal = 0, fieldTotal = 0, fieldPass = 0;

  for (const r of results) {
    const s = r.schemaPass ? "  OK  " : " FAIL ";
    schemaTotal += r.schemaPass ? 1 : 0;

    let t = "  --  ", b = "  --  ", d = "  --    ";
    if (r.schemaPass) {
      for (const f of r.fields) {
        fieldTotal++;
        if (f.pass) fieldPass++;
        const mark = f.pass ? "  OK  " : " FAIL ";
        if (f.field === "title") t = mark;
        if (f.field === "budget_usd") b = mark;
        if (f.field === "deadline") d = mark + "  ";
      }
    }
    const err = r.error ?? r.fields.filter((f) => !f.pass).map((f) => `${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.got)}`).join("; ");

    console.log(
      `${String(r.idx).padStart(2)}  ${r.tag.padEnd(22)}  ${s}  ${t}  ${b}  ${d}  ${err}`
    );
  }

  console.log(`\nSchema: ${schemaTotal}/${results.length}`);
  console.log(`Fields: ${fieldPass}/${fieldTotal}`);

  // Save run
  mkdirSync("runs", { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(`runs/${ts}.json`, JSON.stringify(results, null, 2));
  console.log(`Saved to runs/${ts}.json`);
}

main().catch(console.error);
