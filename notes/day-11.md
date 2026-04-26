# Day 11 — 2026-04-25

**One thing:** add LLM-based reranking to the RAG pipeline. Use Claude as a
relevance judge to reorder results before generation.

## Why

Day 09 showed that pure embedding search fails on nuanced questions — when
the answer is in an exception article, semantic similarity returns the rule
instead. Reranking is the standard production fix: retrieve a broad set
(top 10), then use a smarter model to reorder by actual relevance.

## Tasks

- [x] Write `reranker.ts`: 3-stage pipeline — embedding retrieval (top 10)
      → Claude reranks to top 5 → Claude generates answer.
- [x] Write `eval.ts`: same 12 questions from Day 09, compare embedding-only
      vs reranked retrieval. Track hit rate in top-5 for both.
- [x] Run eval. Results: both 12/12. But reranking reordered Article 50
      from position #4 to #1 for the hard case.

## Results

```
Embedding only:  12/12 (100%) ████████████████████
With reranking:  12/12 (100%) ████████████████████
Improvement: 0 cases fixed (both found the article)
```

BUT — the reranker reordered the hard case:
- Embedding: Article 50 at position #4 (36.2% similarity)
- Reranked: Article 50 at position **#1**

This matters for generation: Claude weights earlier articles more heavily.
With reranking, the answer leads with Article 50 (the exception), then
mentions Article 1 (the rule). Without reranking, it would be reversed.

## Shipped

- 3-stage RAG pipeline: embed → retrieve top 10 → Claude reranks → Claude
  generates from top 5.
- Reranker prompt: "You are a relevance judge. Return indices of most relevant
  documents as a JSON array." Simple, effective, ~200 tokens per call.
- Manual test: "When is it okay to prioritize your girlfriend?" → reranker
  puts Article 50 (The One exception) first, Article 1 (Bros Before Hoes)
  second. Answer correctly explains the exception with the rule as context.

## Learned

- Reranking doesn't always change hit/miss at top-5 — but it changes
  *ordering*, which affects generation quality. The right article at #1
  produces a better answer than the right article at #4.
- The reranker is cheap: ~200 input tokens for 10 short candidates. Adding
  one Claude call adds ~200-400ms latency and ~$0.001 cost. For quality-
  sensitive applications, it's a no-brainer.
- The reranker prompt is dead simple — just "return relevant indices as JSON."
  No fine-tuning, no special model. A general-purpose LLM understands
  relevance well enough for reranking.
- For this dataset (50 articles, clean structure), embedding retrieval alone
  is already 12/12 at top-5. Reranking shines more with larger, noisier
  datasets where there are many near-miss candidates.

## Next

Day 12 → either move to a real document (PDF ingestion), or start wiring
the full chat-with-docs UI with file upload. Getting closer to the Project 1
deliverable.
