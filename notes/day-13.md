# Day 13 — 2026-04-26

**One thing:** streaming responses + multi-turn conversation history.
Make the RAG pipeline interactive — follow-up questions work, answers
appear in real-time.

## Why

Days 10-12 were single-turn: ask one question, get one answer, done.
Real chat applications need two things:
1. **Streaming** — users see tokens as they're generated instead of
   waiting 3-5 seconds for a complete response.
2. **Multi-turn** — conversation history lets follow-up questions work.
   "What about exceptions?" should know we were just talking about the
   Ex Rule.

## Tasks

- [x] Write `chat.ts`: interactive CLI chat with streaming + history.
      Uses readline for input, Anthropic streaming API for output.
- [x] Write `eval.ts`: 4 multi-turn conversations (2 turns each).
      Tests that follow-up questions use context from turn 1.
- [x] Run eval: 4/4 turn 1, 3/4 turn 2 (follow-up).
- [x] Interactive chat demo: streaming works, Barney voice is legendary.

## Shipped

- Interactive terminal chat with The Bro Code. Full streaming output,
  conversation history, colored terminal UI.
- Multi-turn eval: 4 conversation pairs testing context carry-over.
  Turn 2 asks a vague follow-up ("What if he says it's okay?") that
  only makes sense with turn 1 context.
- Streaming via `anthropic.messages.stream()` + async iterator. Each
  `content_block_delta` event writes one token to stdout.

## Learned

- `anthropic.messages.stream()` returns an async iterable. The key
  event is `content_block_delta` with `delta.type === "text_delta"`.
  Much simpler than polling or SSE parsing.
- Multi-turn is just appending to the `messages` array. Claude handles
  context resolution automatically — "What about exceptions?" resolves
  to the topic from the previous turn. No extra engineering needed.
- For retrieval in multi-turn, you still embed the *current* question,
  not the full history. This means follow-up questions like "tell me
  more" retrieve based on vague text. A production system would
  rewrite the query using history (query expansion).
- Terminal UX matters even for demos. ANSI colors, dim retrieval info,
  bold headers — small touches make the tool feel real.

## Next

Day 14 → query expansion (rewrite vague follow-ups using conversation
history) or start building the Project 1 chat-with-docs web UI.
