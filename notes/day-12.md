# Day 12 — 2026-04-26

**One thing:** ingest a real PDF into the RAG pipeline. Parse → chunk →
embed → retrieve → generate. Move from markdown to production-format input.

## Why

Days 09-11 used a markdown file as the source document. In the real world,
most documents are PDFs — contracts, manuals, research papers, books. Today
bridges the gap: same RAG pipeline, but starting from a PDF binary.

## Tasks

- [x] Generate a proper PDF from the Bro Code markdown (reportlab).
- [x] Write `ingest.ts`: PDF → text extraction (pypdf via child_process) →
      two chunking strategies (page-based vs section-based) → embed both.
- [x] Write `rag.ts`: same pipeline as Day 10 but reads PDF-extracted vectors.
      Runs both strategies side-by-side for comparison.
- [x] Write `eval.ts`: 10 questions comparing page-based vs section-based
      retrieval from the PDF source.
- [x] Run eval. Results: page-based 10/10, section-based 9/10.

## Results

```
Page-based:    10/10 (100%) ████████████████████
Section-based:  9/10 (90%) ██████████████████░░
```

The hard case again: "When can I prioritize your girlfriend over bros?"
Section-based retrieval returns Article 1 (the rule) but misses Article 50
(the exception). Page-based wins here because the page is large enough to
contain both the rule and the exception.

## Shipped

- PDF ingestion pipeline: PDF → pdfjs-dist text extraction → chunk → embed.
- Two chunking strategies compared on the same PDF:
  - Page-based: one chunk per page (8 chunks, avg 2375 chars)
  - Section-based: split on "Article N:" regex (52 chunks, avg 365 chars)
- Side-by-side RAG comparison: same question, both vector sets.

## Learned

- PDF text extraction loses structure. Markdown has clean `## headers`;
  PDF extraction gives you a wall of text with inconsistent spacing. The
  chunking strategy matters even more with PDF because you can't rely on
  formatting.
- Page-based chunking produces large, noisy chunks BUT catches edge cases
  that section-based misses. A page containing both the rule and the
  exception scores well because the embedding captures both concepts.
  Trade-off: retrieval accuracy vs generation noise.
- Section-based chunking on PDF requires regex heuristics ("Article N:")
  rather than clean delimiter splitting. More fragile, but each chunk is
  one semantic unit — better for generation quality when it hits.
- pdfjs-dist (Mozilla PDF.js) works well in Node.js via the legacy build.
  Use `pdfjs-dist/legacy/build/pdf.mjs` — the main build requires DOM APIs.

## Next

Day 13 → streaming responses + multi-turn conversation. Make the RAG
pipeline interactive: user asks follow-up questions, sees answers stream
in real-time.
