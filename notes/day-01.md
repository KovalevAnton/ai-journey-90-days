# Day 01 — 2026-04-14

> The whole point of build-in-public is that day 1 is uglier than day 90.
> If I wait until I feel ready, I'm not running a 90-day sprint, I'm running
> away.

## Shipped

- **`kovalevanton.xyz` is live.** Single-page personal site in Next.js 16 /
  React 19 / Tailwind 4 / TypeScript 6. Dark, monospaced accents, one yellow
  highlight and nothing else.
- **3 project slots wired up** with `lib/projects.ts` as the source of truth
  — `chat-with-docs` (day 30), `research-agent` (day 60), `ai-code-review`
  (day 90). Stack chips, status tags, target days. Empty for now, by design.
- **Day counter is a single constant** in `lib/journey.ts`. One number to
  bump each morning. Today it reads `01 / 90`.
- **`/arkanoid` easter egg works.** An old Vite game I built
  (`pretext-arcanoid`) is now served at `kovalevanton.xyz/arkanoid`. Had to
  patch the `base` path to `/arkanoid/` so the Next.js rewrite resolves the
  bundle correctly.
- **Repo pushed:** [KovalevAnton/kovalevanton-site](https://github.com/KovalevAnton/kovalevanton-site).
- **Deployed to Vercel.** Reused the existing `pretext-arcanoid` project so
  the domain `kovalevanton.xyz` stayed attached; had to flip the framework
  preset from Vite to Next.js in Project Settings.
- **Day 1 thread posted** on Twitter and Threads. Pinned the tweet.

## Learned

- Tailwind v4 is a real break from v3. The PostCSS plugin moved to
  `@tailwindcss/postcss`, `tailwind.config.ts` is optional, and theme tokens
  live in CSS via `@theme { ... }`. Five minutes of re-learning, not five
  hours. Fine.
- Vercel project settings override `vercel.json`. If a project was originally
  scaffolded for another framework, linking a new repo to it will silently
  try to build with the old settings until you fix the preset in the
  dashboard.
- The hardest part of day 1 was not the code. It was writing the hero
  paragraph. Everything I tried first sounded like an AI slop landing page.
  Rewrote it by hand maybe six times. The version that shipped is the one
  that sounds like me, not like a SaaS.

## Next

Day 02 → get the Anthropic SDK running end-to-end. One script that calls
Claude with a non-trivial prompt, logs input/output, and exits cleanly. Read
the first half of Anthropic's prompt engineering guide. No RAG yet, no
framework yet. Just the API, the docs, and a terminal.
