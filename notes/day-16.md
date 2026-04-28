# Day 16 — Production deployment

## Goal
Ship the Bro Code Chat as a public demo on Vercel.

## Architecture decisions

**Pre-computed vectors** — vectors.json (52 chunks, ~1.5MB) ships with the app. No runtime ingestion, no vector DB. Cold start loads JSON into memory — simple and free.

**Next.js App Router** — single API route (`/api/chat`) handles the full RAG pipeline: rate limit → expand query → retrieve → stream response. SSE via ReadableStream.

**Dual rate limiting** — Upstash Redis in production (persistent, distributed), in-memory Map as fallback for local dev. 10 messages per IP per day via sliding window.

**No file upload** — hardcoded document eliminates an entire attack surface. The app is chat-only.

## Stack
- Next.js 15 (App Router, nodejs runtime)
- Anthropic SDK (Claude Sonnet for generation + query expansion)
- OpenAI SDK (text-embedding-3-small for retrieval)
- Upstash Redis (rate limiting)
- Vercel (hosting, serverless functions)

## Files
```
src/
  app/
    page.tsx          — React chat UI (streaming SSE, rate limit display)
    layout.tsx        — Root layout + OpenGraph metadata
    api/chat/route.ts — RAG pipeline endpoint with SSE streaming
  lib/
    rag.ts            — retrieve(), expandQuery(), streamAnswer()
    rate-limit.ts     — Upstash + in-memory fallback
  data/
    vectors.json      — Pre-computed embeddings (52 chunks)
```

## Security layers
1. Rate limit: 10 msgs/IP/day (Upstash sliding window)
2. Input validation: 500 char max question length
3. History trimming: last 6 messages only
4. No file upload / no user-provided documents
5. Hardcoded system prompt — no prompt injection via document

## Deploy checklist
1. `npm install` in `experiments/day-16-production/`
2. Create `.env.local` with API keys
3. `npm run dev` — test locally
4. Create Upstash Redis database (free tier)
5. `vercel deploy` — add env vars in Vercel dashboard
6. Verify rate limiting works across cold starts

## Result
Public demo at bro-code-chat.vercel.app (or similar). Chat-only, 10 messages/day per visitor, streaming responses in Barney Stinson's voice.
