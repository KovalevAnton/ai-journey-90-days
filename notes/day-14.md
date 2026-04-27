# Day 14 — 2026-04-27

**One thing:** query expansion — rewrite vague follow-up questions into
self-contained queries before retrieval.

## Why

Day 13 showed that multi-turn retrieval has a gap: follow-up questions
like "What if he says it's okay?" embed poorly because they lack context.
Retrieval returns irrelevant documents (Breakup Support instead of Ex Rule).
Query expansion fixes this by rewriting the question using conversation
history before embedding.

## Tasks

- [x] Write `expand.ts`: Claude rewrites follow-ups into self-contained
      queries. Demo with 4 conversation pairs.
- [x] Write `eval.ts`: 6 follow-up questions, compare retrieval with
      raw query vs expanded query.
- [x] Run eval. Results: raw 4/6 (67%) → expanded 6/6 (100%).

## Results

```
Raw follow-up:   4/6 (67%)  █████████████░░░░░░░
With expansion:  6/6 (100%) ████████████████████
Improvement: 2 cases fixed
```

Fixed cases:
- "How do I recover from that?" → "How do I recover from being left
  hanging on a high five by my bro?" (raw retrieved Breakup Support)
- "What do I get in return?" → "What do I get in return for helping
  my bro move?" (raw retrieved Designated Driver, Food Sharing)

## Shipped

- Query expansion module: one Claude call (~50 input tokens, ~30 output)
  rewrites vague questions into self-contained queries.
- Expansion prompt: "You are a query rewriter. Rewrite the question to be
  self-contained. Return ONLY the rewritten question."
- Works as a drop-in step before retrieval: expand → embed → retrieve.

## Learned

- Vague follow-ups are invisible to embeddings. "What do I get in return?"
  has no topic signal — it could be about anything. Embedding search returns
  random results. Adding context ("for helping my bro move") gives the
  embedding model something to work with.
- The expansion prompt is dead simple — no few-shot examples needed. Claude
  understands "rewrite this to be self-contained" perfectly.
- Cost is minimal: ~50 input + ~30 output tokens per expansion. ~$0.0003.
  Adds ~300ms latency. For multi-turn applications this is a no-brainer.
- Query expansion is the standard production fix for multi-turn RAG.
  Alternatives: embed the full conversation (expensive, noisy) or use
  the last N messages as retrieval context (fragile).

## Next

Day 15 → start building the Project 1 chat-with-docs web UI. We have all
the backend pieces: ingest, retrieve, rerank, expand, generate, stream.
Time to put a frontend on it.
