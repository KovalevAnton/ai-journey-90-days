import Anthropic from "@anthropic-ai/sdk";
import { BriefSchema, type Brief } from "./schema.js";
import { cases } from "./cases.js";
import { writeFileSync, mkdirSync } from "node:fs";

const client = new Anthropic();

const TASK = `You extract structured data from freelance project briefs.
The JSON must have exactly these fields:
- title (string): short project title, 2-6 words
- budget_usd (number | null): fixed budget in USD, or null if not stated in USD or not a fixed amount
- deadline (string | null): deadline as stated, or null if not mentioned`;

// ════════════════════════════════════════════════════════
// Method 1: XML tags (day-03 approach)
// ════════════════════════════════════════════════════════

async function callXmlTags(input: string): Promise<unknown> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: `${TASK}\nReturn ONLY a JSON object wrapped in <json></json> XML tags. Do not explain.`,
    messages: [{ role: "user", content: input }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const match = text.match(/<json>([\s\S]*?)<\/json>/);
  if (!match) throw new Error("no <json> tags found");
  return JSON.parse(match[1].trim());
}

// ════════════════════════════════════════════════════════
// Method 2: Prefill (start assistant response with `{`)
// ════════════════════════════════════════════════════════

async function callPrefill(input: string): Promise<unknown> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: `${TASK}\nReturn ONLY valid JSON. No explanation, no markdown, no code fences.`,
    messages: [
      { role: "user", content: input },
      { role: "assistant", content: "{" }, // prefill: force Claude to continue from `{`
    ],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  // Claude continues from `{`, so we prepend it back
  return JSON.parse("{" + text);
}

// ════════════════════════════════════════════════════════
// Method 3: tool_use (define a fake tool, Claude returns args)
// ════════════════════════════════════════════════════════

async function callToolUse(input: string): Promise<unknown> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: TASK,
    tools: [
      {
        name: "save_brief",
        description: "Save the extracted brief data. Always call this tool with the extracted fields.",
        input_schema: {
          type: "object" as const,
          properties: {
            title: { type: "string", description: "Short project title, 2-6 words" },
            budget_usd: {
              type: ["number", "null"],
              description: "Fixed budget in USD, or null if not stated in USD or not fixed",
            },
            deadline: {
              type: ["string", "null"],
              description: "Deadline as stated in the brief, or null if not mentioned",
            },
          },
          required: ["title", "budget_usd", "deadline"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "save_brief" }, // force Claude to call this tool
    messages: [{ role: "user", content: input }],
  });

  // Find the tool_use block in the response
  const toolBlock = msg.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") throw new Error("no tool_use block");
  return toolBlock.input; // already parsed JSON object
}

// ════════════════════════════════════════════════════════
// Eval logic (reused from day-04)
// ════════════════════════════════════════════════════════

type FieldResult = { field: string; pass: boolean; expected: unknown; got: unknown };

function checkTitle(got: string, expected: string): FieldResult {
  const stem = (w: string) => w.toLowerCase().slice(0, 5);
  const keywords = expected.split(/\s+/).filter((w) => w.length > 3);
  const gotWords = got.toLowerCase();
  const pass = keywords.every((kw) => gotWords.includes(stem(kw)));
  return { field: "title", pass, expected, got };
}

function checkExact(field: string, got: unknown, expected: unknown): FieldResult {
  return { field, pass: got === expected, expected, got };
}

function checkDeadline(got: string | null, expected: string | null): FieldResult {
  if (got === null && expected === null) return { field: "deadline", pass: true, expected, got };
  if (got === null || expected === null) return { field: "deadline", pass: false, expected, got };
  return { field: "deadline", pass: got.toLowerCase().includes(expected.toLowerCase()), expected, got };
}

function checkContent(got: Brief, expected: Brief): FieldResult[] {
  return [
    checkTitle(got.title, expected.title),
    checkExact("budget_usd", got.budget_usd, expected.budget_usd),
    checkDeadline(got.deadline, expected.deadline),
  ];
}

// ════════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════════

type Method = { name: string; fn: (input: string) => Promise<unknown> };

const methods: Method[] = [
  { name: "xml_tags", fn: callXmlTags },
  { name: "prefill", fn: callPrefill },
  { name: "tool_use", fn: callToolUse },
];

type CaseResult = {
  method: string;
  idx: number;
  tag: string;
  schemaPass: boolean;
  fields: FieldResult[];
  error?: string;
};

async function main() {
  const allResults: CaseResult[] = [];

  for (const method of methods) {
    console.log(`\n🔄 Running: ${method.name}...`);
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      try {
        const parsed = await method.fn(c.input);
        const zod = BriefSchema.safeParse(parsed);
        if (!zod.success) {
          const msg = zod.error.issues.map((e) => `${e.path}: ${e.message}`).join("; ");
          allResults.push({ method: method.name, idx: i, tag: c.tag, schemaPass: false, fields: [], error: msg });
          continue;
        }
        const fields = checkContent(zod.data, c.expected);
        allResults.push({ method: method.name, idx: i, tag: c.tag, schemaPass: true, fields });
      } catch (err: any) {
        allResults.push({ method: method.name, idx: i, tag: c.tag, schemaPass: false, fields: [], error: err.message });
      }
    }
  }

  // ── Per-method summary table ──
  console.log("\n\nmethod      schema   title    budget   deadline   total");
  console.log("──────────  ───────  ───────  ───────  ─────────  ─────");

  for (const method of methods) {
    const rows = allResults.filter((r) => r.method === method.name);
    const schema = rows.filter((r) => r.schemaPass).length;
    let tP = 0, bP = 0, dP = 0, fTotal = 0;
    for (const r of rows) {
      for (const f of r.fields) {
        fTotal++;
        if (f.pass) {
          if (f.field === "title") tP++;
          if (f.field === "budget_usd") bP++;
          if (f.field === "deadline") dP++;
        }
      }
    }
    const total = tP + bP + dP;
    const n = cases.length;
    console.log(
      `${method.name.padEnd(10)}  ${schema}/${n}      ${tP}/${n}      ${bP}/${n}      ${dP}/${n}        ${total}/${n * 3}`
    );
  }

  // ── Detailed failures ──
  const failures = allResults.filter(
    (r) => !r.schemaPass || r.fields.some((f) => !f.pass)
  );
  if (failures.length > 0) {
    console.log("\n── FAILURES ──");
    for (const r of failures) {
      const fieldErrs = r.fields
        .filter((f) => !f.pass)
        .map((f) => `${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.got)}`)
        .join("; ");
      const err = r.error ?? fieldErrs;
      console.log(`  [${r.method}] #${r.idx} ${r.tag}: ${err}`);
    }
  }

  // Save
  mkdirSync("runs", { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(`runs/${ts}.json`, JSON.stringify(allResults, null, 2));
  console.log(`\nSaved to runs/${ts}.json`);
}

main().catch(console.error);
