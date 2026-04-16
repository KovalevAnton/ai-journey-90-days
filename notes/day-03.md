# Day 03 — 2026-04-16

**One thing:** force Claude to return valid structured JSON, and build the
tiniest possible eval harness that scores it on 10 inputs.

## Why

Yesterday's Claude answer literally said: *"learn the APIs at the HTTP level,
then immediately build evals."* Day 3 is the "immediately build evals" half.
Not LangSmith, not Langfuse, not a framework — just an array of inputs, a
function that calls Claude, a function that checks the result, a printed
pass/fail table. If I can't write this in 50 lines, I don't understand what
evals actually are yet.

## Tasks

- [x] New sandbox: `experiments/day-03-structured-output/`.
- [x] Install `zod`.
- [x] Design one small task: extract `{ title, budget_usd, deadline }` from
      a messy freelance-brief-style paragraph.
- [x] Write a Zod schema for the expected shape.
- [x] System prompt: tell Claude to return ONLY JSON matching the schema,
      wrapped in `<json>` XML tags (using yesterday's lesson on XML tags).
- [x] Write `cases.ts` with 10 varied inputs (short/long, clean/messy,
      USD/EUR, explicit/implicit deadlines, one with missing fields on
      purpose).
- [x] Write `eval.ts`: for each case, call Claude, extract JSON from the
      `<json>...</json>` block, parse with the Zod schema, record
      pass/fail + reason.
- [x] Print a table at the end: case index, pass/fail, parse error if any.
- [x] If score < 10/10 → iterate the system prompt. Score was 10/10 on
      first run — no iterations needed.

## Rules for the day

- No LangChain. Still goes.
- No retries or self-healing. If Claude returns bad JSON, the case fails.
  That's the whole point of an eval.
- No "LLM-as-judge" yet. The judge is `schema.safeParse()`. Binary.
- Keep the harness under 100 LOC. Forcing brevity forces understanding.

## Shipped

- `experiments/day-03-structured-output/` — 4 files, eval harness under
  100 LOC (88 lines in `eval.ts`).
- Zod schema: `{ title: string, budget_usd: number | null, deadline: string | null }`.
- System prompt uses `<json></json>` XML tags to force structured output.
- 10 test cases covering: clean input, typos, EUR-not-USD, missing budget,
  missing deadline, both missing, long rambling text, budget range,
  hourly rate (not fixed), and multi-project input.
- Score: **10/10 on first run**, zero prompt iterations needed.
- Run saved to `runs/2026-04-16T21-31-56-692Z.json`.
- Also: translated Anthropic's 6 Python eval examples (sentiment exact-match,
  FAQ cosine-similarity, ROUGE-L summarization, Likert tone, binary PHI,
  ordinal context) to TypeScript as a reference file in
  `experiments/day-03-evals-reference/evals-reference.ts`.
- Watched Hamel Husain's 50-min evals crash course before building the
  harness. Key framing: read 50 outputs in a spreadsheet before writing
  assertions, binary labels > likert, evals are the moat.

## Learned

- **XML tags are the cheapest structured-output trick.** Wrapping the
  expected output in `<json></json>` tags in the system prompt made Claude
  return parseable JSON on all 10 cases with zero retries. No tool_use,
  no function calling, no JSON mode — just a clear instruction and XML
  delimiters. This is the Day 2 "system prompt carries more of the answer
  than you expect" lesson applied in practice.
- **Schema validation is a surprisingly powerful eval.** `safeParse()` is
  binary, fast, deterministic, and catches more than you'd expect: wrong
  types, missing fields, extra fields (with `.strict()`), empty strings.
  Before reaching for LLM-as-judge, exhaust what code-based assertions
  can do.
- **10/10 doesn't mean the prompt is good.** It means the *eval* might not
  be hard enough. Next step: add cases that test *correctness* (does
  `budget_usd` match the expected value?), not just *validity* (is it a
  number or null?). Right now the eval is level 1 (code assertions on
  shape). Level 2 would be asserting on content.
- **`--env-file` > `dotenv`.** Node 22 has built-in `--env-file` flag.
  One fewer dependency, one fewer thing to break. `tsx --env-file=.env.local`
  is the new pattern.

## Next

Day 04 → add content assertions to the eval (does extracted title match?
does budget_usd equal the expected number?) and run against edge cases
that actually fail. If everything still passes, the eval is too easy.
Also: streaming. Day 2 noted ~3-6s latency for non-streaming — Day 4 or 5
should wire up `stream: true` and compare perceived responsiveness.
