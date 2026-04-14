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

_TBD end of day._

## Learned

_TBD end of day._

## Next

_TBD end of day._
