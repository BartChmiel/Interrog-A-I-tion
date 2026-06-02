# Brand & Visual Identity

InterrogA(I)tion is a serious, local-first investigative interviewing assistant. The
visual identity is deliberately restrained and institutional: it must read as trustworthy
forensic tooling, never as a flashy consumer app, and it must reinforce the core stance
that **AI is an assistant, not a decision-maker**.

## Symbol

The mark is a **speech bubble** (the interview / dialogue) whose internal dialogue lines
flow into a **question mark** (investigative inquiry), closed by a single **accent dot**
that stands for the embedded, advisory AI. The bubble tail keeps it unmistakably a
conversation, not a generic search lens.

Meaning in one line: *a structured conversation that asks the right questions, with AI as a
small, supporting accent rather than the subject.*

## Color palette

| Token | Name | Hex | Usage |
|------|------|-----|-------|
| Deep Navy | primary | `#0F1E33` | Mark, wordmark, dark tiles, headings |
| Slate Charcoal | secondary | `#2B3442` | Body text, secondary marks |
| Accent Blue | accent | `#4A78B7` | Accent dot, `A(I)` in the wordmark, UI accent |

Semantic UI colors are unchanged and intentionally separate from the brand accent so that
status meaning stays unambiguous: `--ok` green, `--warning` amber, `--danger` red.

The frontend UI accent (`--accent` / `--accent-strong` in `frontend/app/src/styles.css`)
is aligned to Accent Blue so the product and the mark stay cohesive.

## Wordmark

`InterrogA(I)tion`, with `A(I)` set in Accent Blue and the rest in Deep Navy. The `(I)`
is the conceptual hinge: *investigation* and *AI* sharing one set of letters. No tagline is
used in the primary lockup.

## Asset files

All assets live under `frontend/app/public/`:

| File | Purpose |
|------|---------|
| `brand/logo-mark.svg` | Color symbol on transparent (header, light backgrounds) |
| `brand/logo-mark-mono.svg` | Single-color symbol via `currentColor` (print, stamps) |
| `brand/logo-lockup.svg` | Symbol + wordmark, light background |
| `brand/logo-lockup-dark.svg` | Symbol + wordmark, dark background |
| `brand/app-icon.svg` | Maskable app icon, navy tile + white symbol (512) |
| `brand/app-icon-light.svg` | Light tile variant, navy symbol (512, rounded) |
| `favicon.svg` | Browser tab icon |
| `icons/*.svg` | Panel icons (`currentColor`, palette-agnostic) |

The symbol is authored once in a `0 0 64 64` viewBox and reused at scale; tiles wrap it in
`scale(8)` for a `512` canvas.

## Usage rules

- Keep clear space around the mark equal to the bubble's stroke height.
- Do not recolor the accent dot to a status color (it is brand, not a signal).
- Prefer the mono variant for one-color contexts (faxed reports, evidence stamps).
- Never pair the mark with wording that implies the tool determines truth, guilt, or
  deception. The identity supports advisory, auditable language only.
