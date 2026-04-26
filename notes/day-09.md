# Day 09 — 2026-04-22

**One thing:** chunk a real document, compare chunking strategies, measure
retrieval quality.

## Why

Day 06-07 used 10 hand-written fake chunks. Real RAG starts with a real
document you have to split yourself. Chunking strategy directly affects
retrieval quality — wrong chunks = wrong answers. Today: take a real
document, try three chunking strategies, embed all three, and measure which
one retrieves the right chunk most often.

## Tasks

- [x] Restructure repo: single root package.json, one .env.local, one
      tsconfig.json. Remove all per-experiment configs and node_modules.
- [x] Source document: Bro Code (50 articles, ~19K chars) as markdown.
- [x] Write `chunk.ts`: three strategies — naive (500-char fixed), section
      (split on ## headers), overlapping (section + context bleed from neighbors).
- [x] Write `embed.ts`: embed all three chunk sets via OpenAI.
- [x] Write `search.ts`: compare retrieval across strategies for a single query.
- [x] Write `eval.ts`: 12 test questions, check if correct article lands in
      top 3 for each strategy.
- [x] Run eval. Results: Naive 12/12, Section 11/12, Overlap 11/12.

## Results

```
Naive      12/12 (100%) ████████████████████
Section    11/12 (92%)  ██████████████████░░
Overlap    11/12 (92%)  ██████████████████░░
```

## Analysis

Naive "winning" is misleading. It scored 12/12 because fixed-size chunks
cross article boundaries — a chunk accidentally contains text from the
correct article's header, and the eval finds it via substring match. But
these chunks are garbage for generation: they mix content from two unrelated
articles.

Section and Overlap failed on case #12: "When is it okay to prioritize your
girlfriend over your friends?" Expected: Article 50 (Bro Before Ho Exceptions
— about "The One"). Got: Article 1 (Bros Before Hoes). The question is
semantically closer to the rule than to its exception. The word "prioritize
girlfriend" maps to "bros before hoes" not to "The One."

This is a real production RAG problem: when the answer is in an exception
or edge case, pure semantic search retrieves the general rule instead.

## Learned

- Chunking strategy matters less than I expected for clean, well-structured
  documents. Section-based and overlapping performed nearly identically.
  The structure of the source document (clear ## headers, one topic per section)
  does most of the work.
- Overlap helps on boundary questions but adds ~2x chunk size. For a 50-article
  doc, the cost difference is negligible. For 10K articles, it doubles your
  embedding spend and storage.
- Naive chunking is dangerous despite high eval scores. It breaks semantic
  boundaries, mixes unrelated content, and only "works" because substring
  matching finds accidental hits. For generation, it would produce incoherent
  context.
- Eval design matters: checking substring in content (not just title) inflated
  naive's score. A stricter eval (top-1 title match only) would have shown
  the real picture.
- The hardest retrieval cases are nuanced questions where the answer is in an
  exception, not the rule. Semantic similarity alone can't solve this —
  need hybrid search (BM25 + embeddings) or a reranker.

## Repo cleanup

Moved from per-experiment package.json/node_modules/.env.local to single root
config. All experiments now run from root: `npm run x -- experiments/day-09/chunk.ts`.

## Next

Day 10 → either hybrid search (BM25 + semantic) to fix the nuance problem,
or move on to wiring the full RAG pipeline with real chunked documents
(PDF ingestion → chunk → embed → retrieve → Claude answers from Bro Code).
