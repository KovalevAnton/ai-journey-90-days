# Day 02 — 2026-04-15 (plan)

**One thing:** get the Anthropic SDK talking to Claude from a Node/TS script,
end to end. A real prompt, a real response, logged to disk.

## Tasks

- [ ] `npm init` a throwaway `day-02-hello-claude/` folder.
- [ ] Install `@anthropic-ai/sdk`. Latest.
- [ ] Put `ANTHROPIC_API_KEY` in `.env.local`, load with `dotenv`.
- [ ] Write `hello.ts`: one `messages.create` call to `claude-opus-4-6`,
      streaming off, a non-trivial system prompt, a real user question.
- [ ] Log request + response to `runs/` as JSON so I can diff later.
- [ ] Read the first half of Anthropic's prompt engineering guide. Take
      notes in this file under "learned" at the end of the day.
- [ ] Commit, push, bump the day counter on the site, post a one-liner on
      Twitter.

## Rules for the day

- No framework. No LangChain, no LangGraph. Just the SDK.
- No RAG. No tool use. One prompt in, one response out.
- No writing blog posts about it. Just the commit and the one-liner.

## Shipped

- `day-02-hello-claude/` sandbox with `@anthropic-ai/sdk`, `tsx`, `.env.local`
  pattern. `npm run` isn't even wired — just `npx tsx hello.ts`, on purpose.
- `hello.ts`: one `messages.create` call, system + user message, response
  logged as JSON to `runs/` with timestamp, latency, usage, stop reason.
- Ran it against `claude-sonnet-4-6` with the same user question but three
  different system prompts (neutral, "terse senior engineer", "sceptical YC
  partner"). Three files in `runs/`, diffed them side by side.
- Read three chapters of Anthropic's prompt engineering guide:
  be-clear-and-direct, use-examples (multishot), let-Claude-think (CoT).

## Learned

- **The system prompt carries more of the answer than I expected.** Same
  user message, three systems → three fundamentally different responses in
  tone, length, and even what Claude considers "the answer". The "terse
  senior engineer" system didn't just shorten the output, it changed the
  substance. This is the single biggest miscalibration a frontend dev has
  when picking up LLMs: you think you're "asking a question", you're
  actually "configuring a micro-agent".
- **Claude is not neutral about what's hard.** When asked what I'm
  underestimating, it twice gave confident, opinionated answers — once
  "embeddings", once "APIs at the HTTP level + evals". Both answers contain
  real signal, but both are slightly self-serving to the training data. The
  lesson is not that Claude is wrong — it's that *any* single LLM answer is
  one sample from a distribution, and building intuition requires looking
  at several samples to see the shape.
- **Latency for non-streaming is ~3–6s for ~100 output tokens.** Noted for
  comparison when streaming gets added on Day 5.
- **Reading the docs in English is fine.** Russian localisation stops at
  the API overview; everything useful lives in EN only. Ten minutes in,
  stopped noticing the language.

## Next

Day 03 → structured output + first mini-eval harness. Force Claude to
return JSON matching a Zod schema, and run the same prompt against 10 varied
inputs. Score: did it return valid JSON that parses? That's it. Threshold:
10/10. If it fails, iterate the prompt until it passes. This is the
embryonic version of an eval harness — the thing Claude itself told me to
build in week 1.
