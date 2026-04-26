# Day 10 — 2026-04-25

**One thing:** full RAG pipeline over The Bro Code — ask a question, get a
grounded answer citing specific articles, in Barney Stinson's voice.

## Why

Day 09 was retrieval-only. Today closes the loop: retrieve relevant articles
from Bro Code → inject into Claude's system prompt → generate a grounded,
cited answer. This is the complete RAG pipeline from real document to real
answer.

## Tasks

- [x] Write `rag.ts`: retrieve top 5 → build system prompt with `<article>`
      XML tags → Claude answers in Barney's voice citing articles.
- [x] Write `eval.ts`: 9 test cases (8 factual + 1 hallucination).
      Checks both retrieval correctness and content assertions.
- [x] Run manual tests: "Can I date my bro's ex?" and "My bro left me
      hanging on a high five" — both returned correct articles, cited
      properly, great Barney voice.

## Shipped

- Full RAG pipeline: Bro Code → section chunks → embeddings → retrieve →
  Claude answers with citations. ~700 input tokens, ~200 output per query.
- Barney Stinson persona in system prompt: confident, dramatic, legendary.
  Claude nails the voice — "Denied high fives are a war crime", "the Geneva
  Convention of Brodom."

## Learned

- The system prompt persona ("You are Barney Stinson's AI assistant")
  dramatically changes output quality. Same RAG pipeline, but answers are
  fun to read and still technically accurate with proper citations.
- 5 retrieved chunks is better than 3 for this document size. Article 50
  (the exception to Bros Before Hoes) lands at position 4 by embedding
  similarity — with top-3 it would be missed.
- Bug: when eval.ts imports rag.ts as a module, rag.ts's main() runs and
  exits. Fix: guard main() with `process.argv[1]?.endsWith("rag.ts")`.
  In production, use separate entry points or a proper CLI framework.

## Next

Day 11 → reranking. Use Claude as a judge to reorder top-10 embedding
results before generation.
