# Day 07 — 2026-04-21

**One thing:** complete the RAG loop. Take yesterday's retrieval (embed →
search → top chunks) and feed the results into Claude as context. Ask a
question, get a grounded answer.

## Why

Project 1 is chat-with-docs (day 30 deadline). Day 06 was the R — retrieval.
Today is the G — generation. Together they form a minimal RAG pipeline:
embed query → cosine search → inject top chunks into system prompt → Claude
answers from the docs, not from training data.

## Tasks

- [x] New sandbox: `experiments/day-07-rag/`.
- [x] Extract retriever into a module (`retriever.ts`) — reuses day-06 vectors.
- [x] Write `rag.ts`: retrieve top 3 chunks → build system prompt with
      `<document>` XML tags → call Claude → print answer + token usage.
- [x] Write `eval.ts`: 8 test cases (7 factual + 1 hallucination check).
      Two assertions per case: retrieval correctness + content assertions.
- [x] Run eval. 7/8 → 8/8 (one fix: "1000" vs "1,000" number formatting).

## Rules for the day

- System prompt tells Claude: "answer ONLY from the provided documents."
- If no relevant doc exists, Claude must say so — not hallucinate.
- No streaming today — focus on correctness, not UX.
- Eval checks both retrieval AND generation.

## Shipped

- `retriever.ts` — module wrapping day-06 vector search. Loads vectors.json,
  embeds query via OpenAI, returns top K chunks with content and scores.
- `rag.ts` — full RAG pipeline. Retrieves top 3 chunks, injects them into
  Claude's system prompt as `<document>` XML tags, gets grounded answer.
  334 input tokens, 53 output tokens for a typical question.
- `eval.ts` — 8 test cases. 7 factual questions checking retrieval correctness
  + content assertions, 1 hallucination test (question with no relevant doc).
  7/8 → 8/8 after fixing number format mismatch in eval ("1000" vs "1,000").

## Learned

- The system prompt pattern for RAG is simple: wrap chunks in XML tags,
  tell Claude to answer ONLY from those documents, tell it to refuse if
  info isn't there. Works out of the box.
- Hallucination resistance is real — Claude correctly refused to answer
  about blockchain payments even though it had 3 chunks of context.
  The "don't make things up" instruction is sufficient for this scale.
- Eval iteration pattern holds: first failure was eval bug (number
  formatting), not model bug. Same lesson as Day 4 — fix eval first.
- Token usage is tiny: ~330 input tokens for 3 chunks + system prompt.
  Real docs will be 10-100x larger — token cost and context window
  management will matter at scale.
- Retrieval quality directly determines answer quality. Garbage in,
  garbage out — if the wrong chunk lands in top 3, Claude will answer
  from the wrong doc confidently.

## Next

Day 08 → chunk real documents (not fake ones). PDF or markdown files,
split into overlapping chunks, embed, search. Move from toy data to
something closer to production RAG.
