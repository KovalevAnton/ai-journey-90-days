# Day 15 — 2026-04-27

**One thing:** web UI for the RAG pipeline. Upload a document, chat with
it in the browser. All backend pieces wired together.

## Why

Days 06-14 built every piece of the RAG pipeline in isolation: chunking,
embedding, retrieval, reranking, generation, streaming, multi-turn, query
expansion. Today puts it all behind a web interface — the first real
"product" of the journey.

## Tasks

- [x] Write `server.ts`: Express server with two endpoints:
      POST /api/ingest (upload + chunk + embed) and
      POST /api/chat (expand → retrieve → stream via SSE).
- [x] Write `public/index.html`: dark-theme chat UI with file upload,
      streaming messages, conversation history.
- [x] Test: uploaded bro-code.md (52 chunks), multi-turn chat works,
      query expansion rewrites follow-ups, hallucination refusal works.

## Shipped

- Full chat-with-docs web app: upload .txt/.md → chunk → embed → chat.
- Express + SSE for streaming (no WebSockets needed).
- Vanilla HTML/CSS/JS frontend — no React, no build step, one file.
- All RAG pieces wired: expand → retrieve → stream → multi-turn.
- Dark theme, clean UI, status indicators during retrieval.

## Learned

- SSE (Server-Sent Events) is perfect for LLM streaming. Format is dead
  simple: `data: {json}\n\n`. No WebSocket overhead, works with fetch(),
  uni-directional (server → client) which is exactly what streaming needs.
- Vanilla JS for a chat UI is ~150 lines. No framework needed for this
  complexity level. ReadableStream + TextDecoder for SSE parsing.
- multer for file upload, express.static for serving the frontend. The
  whole server is one file, ~200 lines.
- In-memory vector store with JSON persistence works fine for single-user
  demo. Production would need a proper vector DB.
- The "upload → ingest → chat" flow is the complete Project 1 MVP.

## Next

Day 16 → either add PDF upload support to the web UI, or start on
Project 2 (research agent with tool use).
