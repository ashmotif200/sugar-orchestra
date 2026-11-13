# Sugar Orchestra — DESIGN.md

Token spec for the Muséomix prototype (L'Aventure du Sucre, Maurice).
Source of truth for colours, type, spacing and motion. The app has **no external
fonts, no external images, no CDN** — it must run offline on the demo machine.

## 1. Intent

A museum sound-collection journey that ends in one surprise: a piece of music
made only from the visitor's own sounds. The interface must feel like an
instrument panel made of raw sugar, cane fibre and warm copper — never like a
generic SaaS dashboard. Calm, generous, oversized touch targets (a phone in a
museum, standing up, one hand).

Two ideas drive every screen:
1. **Collection** — sounds are objects you pick up, hold, and can put back.
2. **Withholding** — the piece is never previewed. The last screen is a reveal.

## 2. Colour tokens

Base (dark, so the phone screen does not glare in a dim museum room):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#17110D` | app background (roasted sugar) |
| `--bg-2` | `#221913` | raised surfaces, cards |
| `--bg-3` | `#2E241C` | pressed / inset |
| `--line` | `#3B2E23` | hairlines, dividers |
| `--ink` | `#F6EBDC` | primary text (raw sugar) |
| `--ink-2` | `#C9B49B` | secondary text |
| `--ink-3` | `#8E7A63` | tertiary, credits, meta |
| `--cane` | `#8FAE5B` | cane green — collection / confirm |
| `--caramel` | `#E0923F` | copper — primary action |
| `--crystal` | `#EBD3A2` | sugar crystal highlight |
| `--danger` | `#C4553F` | remove, limits |

Universe accents (only two are functional in this prototype):

| Universe | Token | Value |
|---|---|---|
| ⚡ Énergétique — Electro Sega | `--u-energetique` | `#E2703A` (ember) |
| 🌊 Rêveur — Ambient créole | `--u-reveur` | `#4E8F9B` (lagoon) |
| 💃 Dansant — Sega traditionnel | `--u-dansant` | `#B8577A` (disabled/soon) |
| 🌙 Détendu — Segazz | `--u-detendu` | `#7A6EA8` (disabled/soon) |

Contrast: `--ink` on `--bg` ≥ 13:1; `--ink-2` on `--bg-2` ≥ 7:1; never place
`--ink-3` text under 14px. Universe accent is used for *state*, never for body
text.

## 3. Type scale

System stack only (offline): display `Georgia, 'Iowan Old Style', 'Times New
Roman', serif`; UI `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.

| Token | Size / line-height | Use |
|---|---|---|
| `--t-display` | `clamp(2.1rem, 7vw, 3.4rem)` / 1.05 serif | screen titles |
| `--t-h2` | `1.35rem` / 1.2 serif | section names |
| `--t-body` | `1rem` / 1.55 sans | prose, anecdotes |
| `--t-small` | `0.85rem` / 1.45 sans | credits, helper text |
| `--t-meta` | `0.72rem` / 1.3 sans, `letter-spacing:.08em`, uppercase | labels, badges |

## 4. Space, radius, elevation

- Spacing scale: `4 8 12 16 24 32 48 64` px.
- Radius: `--r-1: 10px` (chips), `--r-2: 16px` (cards), `--r-3: 24px` (sheets).
- No drop shadows on dark; depth comes from `--bg-2`/`--line` and a 1px inner
  highlight `inset 0 1px 0 rgba(246,235,220,.05)`.
- Every interactive element ≥ 44×44 px hit area.

## 5. Motion

- `--ease: cubic-bezier(.2,.8,.2,1)`; durations `120ms` (press), `240ms`
  (state change), `420ms` (screen change).
- One idea per transition: screens cross-fade + 8px rise. No parallax, no
  bouncing, no confetti.
- The reveal of the final piece is the only "big" moment: a slow 900ms fade-in
  of the piece title and a single expanding ring behind the play button.
- `prefers-reduced-motion: reduce` → all animation durations to `1ms`, ring
  becomes static.

## 6. Components

- **UniverseCard**: 2-column grid, tall (min 132px), accent left border 3px,
  emotion glyph, style name, tempo hint. `soon` variant is 45% opacity,
  `aria-disabled`, label "bientôt".
- **StationBlock**: section title (serif h2) + count of sounds + one sentence of
  context; sounds listed as `SoundRow`.
- **SoundRow**: 44px play disc (▶/■), name, role chips, credit line, and a
  right-aligned collect toggle (+ / ✓). Collected rows get `--cane` left rule.
- **CollectionBar**: sticky bottom bar; N/M slots as filled sugar cubes, primary
  action "Créer ma pièce" disabled until `minSelected`.
- **PieceScreen**: play disc 96px, waveform-less progress bar, elapsed/total,
  list "les sons que tu as entendus" with a signature badge on each, replay,
  export WAV, "recommencer".
- **Honesty banner**: `--bg-3` strip with `--t-meta` label `DÉMO` — always used
  for placeholder content (anecdotes non validées, sons de substitution).

## 7. Accessibility

- Focus ring: 2px `--crystal` offset 2px, visible on all interactive elements.
- All audio actions have text labels (`aria-label`), state announced via
  `aria-pressed` / `aria-current`.
- Progress of generation and playback exposed with `role="progressbar"` +
  `aria-valuenow`.
- Never rely on colour alone: role chips carry text, collected state carries ✓.
