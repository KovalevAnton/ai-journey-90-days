# Day 04 — 2026-04-17

**One thing:** make the eval actually fail — add content assertions that
check *what* Claude returned, not just that it returned valid JSON. Then:
streaming.

## Why

Yesterday's 10/10 proved the eval was testing shape, not substance. A model
that always returns `{"title":"x","budget_usd":1,"deadline":"y"}` would also
score 10/10. Today we add a second pass: does budget_usd match the expected
value? Is deadline null when it should be? This is the difference between
"does it parse?" and "is it right?".

Streaming is the other half: Day 02 measured 3-6s latency for non-streaming
calls. As a frontend engineer, that's unacceptable UX. Wire up `stream: true`,
print tokens as they arrive, compare perceived responsiveness.

## Tasks

- [x] Copy day-03 eval into `experiments/day-04-content-assertions/`.
- [x] Add a `checkContent()` function: compare parsed output vs expected
      for each field. Scoring: per-field pass/fail, not just per-case.
- [x] Decide matching strategy: exact match for budget_usd, contains for
      deadline, stem-fuzzy for title.
- [x] Run eval. Find cases that fail. Three iterations to reach 30/30.
- [x] Second half: `experiments/day-04-streaming/`. One script that calls
      Claude with `stream: true`, prints tokens to stdout as they arrive,
      logs total latency vs time-to-first-token.
- [x] Compare: same prompt, streaming vs non-streaming. Note the numbers.

## Rules for the day

- Still no LangChain.
- No LLM-as-judge for content. Use code assertions. If title matching
  needs fuzzy logic, write it — don't call Claude to judge Claude.
- Streaming script should be <50 LOC. Keep it minimal.

## Shipped

- `experiments/day-04-content-assertions/` — eval with per-field content
  assertions (title, budget_usd, deadline). Three matching strategies:
  stem-fuzzy for title (first 5 chars of keywords), exact for budget_usd,
  contains for deadline.
- Three eval iterations:
  - Run 1: schema 10/10, fields 23/30 (7 failures).
  - Run 2: schema 10/10, fields 26/30 (fixed 3 expected values + title stem).
  - Run 3: schema 10/10, fields 30/30 (fixed deadline to contains-match,
    loosened remaining expected values).
  - Zero system prompt changes across all three runs.
- `experiments/day-04-streaming/` — streaming vs non-streaming comparison.
  - Non-streaming: 5.55s total for ~182 tokens.
  - Streaming: 0.69s to first token, 5.92s total for ~209 tokens.
  - 8x perceived speedup. Same total time, fundamentally different UX.

## Learned

- **The first iterations fix the eval, not the prompt.** All 7 initial
  failures were either wrong expected values or too-strict matching logic.
  The model was right every time. This matches Hamel's advice: read your
  outputs before blaming the model.
- **Three levels of string matching emerged naturally:**
  budget_usd = exact (number or null, no ambiguity), deadline = contains
  (model may add context), title = stem-fuzzy (model paraphrases freely).
  Choosing the right granularity per field is an eval design decision, not
  a one-size-fits-all rule.
- **Streaming is not an optimization — it's a UX requirement.** 0.69s to
  first token vs 5.55s full response. Total time is almost identical, but
  the user sees text 8x sooner. For any frontend-facing LLM product, if
  you're not streaming, you're broken.
- **`stream.on("text", ...)` is just addEventListener for LLMs.** The
  event-driven pattern is identical to DOM events. Frontend muscle memory
  transfers directly.

## Next

Day 05 → prefill trick (start Claude's response with `{` to get raw JSON
without XML tags), tool_use for structured output (define a fake tool,
Claude returns args as JSON). Compare three approaches: XML tags (day 03),
prefill (new), tool_use (new). Same 10 cases, same eval. Which is most
reliable?
