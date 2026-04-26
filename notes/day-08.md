# Day 08 — 2026-04-21

**One thing:** redesign the portfolio site using Claude Design — Anthropic's
new design-to-prototype tool.

## Why

The site looked generic. Same Tailwind template as everyone else. If I'm
building in public and want hiring managers to remember me, the site needs
personality. Claude Design just launched (April 17) — perfect excuse to try
it and make content about the experience.

## Tasks

- [x] Write a brief for Claude Design: Matrix terminal aesthetic, dark green
      palette, CRT effects, readable text, responsive.
- [x] Get design handoff from Claude Design: interactive HTML/CSS/JS
      prototype with full README (tokens, typography, spacing, interactions).
- [x] Port prototype to Next.js App Router:
      - Server components for data (page.tsx files)
      - Client components for interactivity (TerminalShell, HomeClient, etc.)
- [x] Build MatrixRain canvas component (katakana + digit rain).
- [x] Build kinetic text components: TypeIn, Scramble, CounterScramble.
- [x] Build TerminalShell layout: title bar, tab nav, rain toggle (on → paused → off).
- [x] Rewrite globals.css: design tokens (oklch colors), CRT overlays
      (scanlines, vignette, noise), all component styles.
- [x] Set up separate Vercel projects: pretext-arcanoid for the game,
      kovalevanton-site for the portfolio.
- [x] Post about Claude Design on Twitter/Threads.

## Shipped

- Full Matrix terminal redesign of kovalevanton.xyz:
  - Canvas-based katakana rain with pause/resume/off toggle
  - Terminal chrome: traffic light dots, centered title, live status, day counter
  - Tab navigation mapped to Next.js routes (home, projects, writing, about)
  - CRT overlays: scanlines, vignette, noise — all CSS, no images
  - Kinetic text: TypeIn (char-by-char typing), Scramble (random→resolved),
    CounterScramble (digit-only scramble for day counter)
  - Design tokens: oklch color space, JetBrains Mono + Inter, CSS custom properties
  - Reduced motion media query for accessibility
- Vercel project separation: arkanoid on arcanoid.kovalevanton.xyz,
  portfolio on kovalevanton.xyz.

## Learned

- Claude Design outputs a full design system, not just a picture. Tokens,
  typography scale, spacing, interaction specs, component breakdown — the
  README alone was more detailed than most Figma handoffs I've received.
- Porting HTML prototype to Next.js requires real engineering decisions:
  server vs client components, SSR-safe animations (no window/document in
  server components), localStorage hydration for rain toggle state.
- The "prompt → prototype → production" workflow is genuinely fast for a
  solo dev. No Figma round-trips, no "move this 2px" Slack threads.
- CRT effects (scanlines, vignette, noise) are surprisingly cheap in CSS.
  Scanlines = repeating-linear-gradient, noise = a tiny base64 PNG tiled,
  vignette = radial-gradient. All pointer-events: none overlays.
- oklch() for color tokens is better than hex/rgb — perceptually uniform,
  easy to adjust lightness/chroma independently.

## Next

Day 09 → back to RAG track. Chunk real documents (PDF or markdown), split
into overlapping chunks, embed, search. Move from toy data to production.
