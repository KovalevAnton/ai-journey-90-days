# ai-journey-90-days

Public log of my 90-day pivot from senior frontend engineer (10y) into AI
engineering. One project a month, one commit a day. No curation, no drafts.

Site: [kovalevanton.xyz](https://kovalevanton.xyz)
Twitter: [@kovalevantondev](https://twitter.com/kovalevantondev)

## Setup

```bash
cp .env.example .env.local   # fill in your API keys
npm install                   # one install, all experiments
```

## Running experiments

Every experiment is a self-contained folder under `experiments/`. Run any
file from the repo root:

```bash
npm run x -- experiments/day-09-chunking/chunk.ts
npm run x -- experiments/day-07-rag/rag.ts "how do I get a refund?"
npm run x -- experiments/day-06-embeddings/search.ts "two-factor auth"
```

`npm run x` is a shortcut for `tsx --env-file=.env.local`.

## The run

| #  | Project        | Focus                                | Target day |
|----|----------------|--------------------------------------|------------|
| 01 | chat-with-docs | Claude API, prompts, RAG, pgvector   | day 30     |
| 02 | research-agent | LangGraph, tool use, evals, Langfuse | day 60     |
| 03 | ai-code-review | Agent on PRs, evals, GitHub Actions  | day 90     |

## Log

Daily notes live in [`notes/`](./notes). One file per day, shortest possible.
Each entry answers three questions:

1. **Shipped** — what I actually finished.
2. **Learned** — what clicked today.
3. **Next** — the single most important thing for tomorrow.

## Rules I'm holding myself to

- Every project ships on a public deadline. No sliding.
- Every day ends with a commit somewhere. Docs count.
- Writeups are short. No listicles, no threads begging for engagement.
- Outreach is text-only. No calls in the first 90 days — everyone is busy.
- Frontend experience is a moat, not a liability. I'm not pretending to be an
  ML researcher. I'm learning to build real LLM products.
