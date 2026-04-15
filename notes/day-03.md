# Day 03 — 2026-04-16 (plan)

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

- [ ] New sandbox: `experiments/day-03-structured-output/`.
- [ ] Install `zod`.
- [ ] Design one small task: extract `{ title, budget_usd, deadline }` from
      a messy freelance-brief-style paragraph.
- [ ] Write a Zod schema for the expected shape.
- [ ] System prompt: tell Claude to return ONLY JSON matching the schema,
      wrapped in `<json>` XML tags (using yesterday's lesson on XML tags).
- [ ] Write `cases.ts` with 10 varied inputs (short/long, clean/messy,
      USD/EUR, explicit/implicit deadlines, one with missing fields on
      purpose).
- [ ] Write `eval.ts`: for each case, call Claude, extract JSON from the
      `<json>...</json>` block, parse with the Zod schema, record
      pass/fail + reason.
- [ ] Print a table at the end: case index, pass/fail, parse error if any.
- [ ] If score < 10/10 → iterate the system prompt (not the schema) until
      it passes. Document each iteration in `runs/` with the diff.

## Rules for the day

- No LangChain. Still goes.
- No retries or self-healing. If Claude returns bad JSON, the case fails.
  That's the whole point of an eval.
- No "LLM-as-judge" yet. The judge is `schema.safeParse()`. Binary.
- Keep the harness under 100 LOC. Forcing brevity forces understanding.

## Shipped

_TBD end of day._

## Learned

_TBD end of day._

## Next

_TBD end of day._
