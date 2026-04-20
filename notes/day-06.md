# Day 06 — 2026-04-19

**One thing:** build the R in RAG — retrieval. Embed documents, embed a
query, find the closest chunk by cosine similarity. No generation yet,
just search.

## Why

Project 1 is chat-with-docs (day 30 deadline). RAG = Retrieval-Augmented
Generation. Today is the retrieval half: given a question, find the most
relevant piece of text from a set of documents. Tomorrow or day after —
plug that into Claude for the generation half.

Anthropic doesn't have an embedding API. Using OpenAI text-embedding-3-small
(cheapest, ~$0.02/M tokens, 1536 dimensions). This is industry standard and
the user will need OpenAI familiarity anyway.

## Tasks

- [x] New sandbox: `experiments/day-06-embeddings/`.
- [x] Install `openai` SDK for embeddings.
- [x] Create `docs.ts`: 10 text chunks (fake Acme SaaS help center).
- [x] Write `embed.ts`: embed all chunks + save vectors to disk as JSON.
- [x] Write `search.ts`: embed a query, compute cosine similarity against
      all chunk vectors, return top 3.
- [x] Test with 4 queries. All 4 returned the correct chunk #1.

## Rules for the day

- No pgvector. In-memory vectors, stored as JSON.
- No frameworks (no LangChain, no LlamaIndex).
- Cosine similarity written by hand (from day-03 evals-reference).

## Shipped

- `docs.ts` — 10 fake Acme SaaS help center chunks (pricing, refunds, API
  limits, 2FA, templates, mobile, SLA, permissions, integrations, data export).
- `embed.ts` — batch-embeds all 10 chunks via OpenAI text-embedding-3-small,
  saves `vectors.json` (288 KB, 1536 dimensions per vector).
- `search.ts` — embeds a query, scores every chunk by hand-written cosine
  similarity, returns top 3.
- 4/4 queries returned the correct chunk at position #1:
  - "how do I get a refund?" → refunds (67.3%)
  - "what are the API rate limits?" → API limits (72.0%)
  - "can I export my data?" → data export (65.9%)
  - "how to set up two-factor auth?" → 2FA (74.4%)

## Learned

- OpenAI embeddings API is dead simple: one call, array of floats back.
  Batch input (all texts in one request) is cheaper and faster than one-by-one.
- Sort response by `index` — API doesn't guarantee order.
- 1536-dimension vectors for 10 chunks = 288 KB JSON. At scale this is why
  you need pgvector / Pinecone / Qdrant, not flat files.
- Cosine similarity works well for short help-center chunks. Score spread
  between #1 and #2 was 5–10 pp on every query — clean separation.
- 2FA chunk kept appearing in top-3 for unrelated queries — likely lexical
  overlap ("account", "settings"). Longer chunks with more generic words
  attract noise. Chunk design matters.
- No frameworks needed for prototype retrieval. 50 lines of code total.

## Next

Day 07 → plug retrieval into Claude. Send the top chunk as context with the
user's question. This completes the full RAG loop: embed query → find closest
chunk → send chunk + question to Claude → get grounded answer.
