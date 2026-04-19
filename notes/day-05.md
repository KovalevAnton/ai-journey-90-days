# Day 05 — 2026-04-19

**One thing:** compare three ways to get structured JSON from Claude —
XML tags (day 03), prefill trick, tool_use. Same 10 cases, same eval.
Which is most reliable?

## Why

Day 03 used `<json>` XML tags and got 10/10. But that's one approach out
of at least three. Before building anything real, I need to know the
trade-offs:
- **XML tags**: simple, no SDK magic, but depends on Claude following
  instructions. What if it adds "Here's the JSON:" before the tags?
- **Prefill**: start the assistant response with `{` — Claude continues
  as JSON. No tags to parse, but no closing delimiter either.
- **tool_use**: define a fake tool with a JSON schema, Claude "calls" it
  and returns structured args. SDK-level guarantee, but more boilerplate.

## Tasks

- [x] New sandbox: `experiments/day-05-structured-compare/`.
- [x] Copy `schema.ts` and `cases.ts` from day-04.
- [x] Implement three extraction functions: `callXmlTags()`,
      `callPrefill()`, `callToolUse()`.
- [x] Run all 10 cases × 3 methods = 30 calls. Same eval logic.
- [x] Print a comparison table: method × schema pass × field scores.
- [x] Document which method wins and why.

## Rules for the day

- Still no LangChain.
- Same system prompt core for all three methods (adapted per technique).
- Same eval assertions from day-04. No loosening to make a method pass.

## Shipped

- `experiments/day-05-structured-compare/` — comparison eval, 214 LOC.
  10 cases × 3 methods. Results:

  | method    | schema | title | budget | deadline | total |
  | --------- | ------ | ----- | ------ | -------- | ----- |
  | xml_tags  | 10/10  | 9/10  | 10/10  | 10/10    | 29/30 |
  | prefill   | 0/10   | 0/10  | 0/10   | 0/10     | 0/30  |
  | tool_use  | 10/10  | 9/10  | 10/10  | 10/10    | 29/30 |

- Prefill 0/10 — Claude Sonnet 4 does not support assistant message
  prefill. API returns 400. This was a working technique on Claude 3/3.5
  but is no longer available.
- XML tags and tool_use tied at 29/30. The one failure was the same case
  (#8, title paraphrase) for both — an eval matching issue, not a method
  difference.

## Learned

- **Prefill is dead on Claude 4.** "This model does not support assistant
  message prefill. The conversation must end with a user message." Docs
  and older blog posts still reference it, but it's gone. Lesson: always
  verify techniques against the actual model you're using.
- **XML tags and tool_use are functionally equivalent for structured
  output reliability.** Both hit 10/10 schema, 29/30 fields on the same
  cases. The difference is ergonomics, not reliability:
  - XML tags: less boilerplate, works with any text-completion flow, but
    you hand-roll parsing (regex + JSON.parse).
  - tool_use: more boilerplate (tool definition + JSON Schema), but the
    SDK guarantees parsed JSON and type safety at the protocol level.
    No regex, no manual parsing.
- **For production, tool_use wins.** The parsing guarantee is worth the
  boilerplate. You describe the schema once (or generate JSON Schema from
  Zod via `zod-to-json-schema`), and the SDK handles everything. XML tags
  are fine for scripts and experiments, but in a product you want the
  strongest contract you can get.
- **API features change between model generations.** What works on 3.5
  may 400 on 4. Pin your model version, read the changelog, and don't
  assume backwards compatibility for prompt-level tricks.

## Next

Day 06 → start building toward project 1 (chat-with-docs). First step:
embeddings. Take a set of documents, embed them, store in memory (no
pgvector yet), and retrieve the most relevant chunk for a query using
cosine similarity. This is the R in RAG — retrieval without generation
first.
