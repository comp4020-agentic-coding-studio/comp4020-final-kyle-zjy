# Visual direction

Status: PHASE 0 design. Tokens are implemented in
`src/client/styles/tokens.css`; every component reads colours, type, radii
and motion from those variables, never from literals.

Scenario 03 applies those tokens to two views of one eight-room building:
warm gold for 1996, cyan signal for 2026. The same tree layout carries
both years; room labels, occupancy, NPC and containment markers communicate
state in text as well as colour. Numbered incident beats and the 1996-to-2026
decision ribbon make the causal rewrite legible. Identity, third-route and
ending scenes use separate light treatments while retaining the shared
tarot frame and typography. On phones the map becomes a compact two-column
tree, with every actionable room at least 48 px high.

## 1. One sentence

**A modern city at 00:17 where something is slightly wrong** — midnight
subway, tarot and star charts rendered as precise, quiet interface; dim gold
on deep blue, moonlight text, a single neon line of signage. Premium
tabletop game, not a dashboard; urban legend, not medieval fantasy; restraint,
not full cyberpunk.

**Acceptance test for every screen:** cover the logo — does it still read as a
commercial game? If not, it isn't done.

## 2. Mood references (ideas only — nothing copied)

- Empty late-night metro platforms, fluorescent tubes, platform-edge yellow line
- Tarot card borders: thin gold rules, corner ornaments, numbered arcana
- Astrolabes and star charts: concentric rings, tick marks, constellation lines
- Split-flap / LED destination boards: monospaced amber/cyan digits
- Old paper tickets: perforation, punch holes, serial numbers, stamps
- Liminal spaces: long corridors, repeated windows, light from one source

## 3. Colour

Dark theme only (the game is set at midnight; there is no light mode). All
foreground/background pairs meet WCAG AA (4.5:1 for body text).

| Token | Hex | Use |
| --- | --- | --- |
| `--c-void` | `#05060D` | page background, deepest layer |
| `--c-night` | `#0A0F22` | train body, panels |
| `--c-deep` | `#121A3A` | raised panels, cards |
| `--c-indigo` | `#1D2657` | borders, wells, inactive |
| `--c-violet` | `#6A4FD8` | arcane accent, skill glow |
| `--c-violet-soft` | `#9C86FF` | violet text on dark |
| `--c-gold` | `#C9A55A` | primary accent: rules, frames, primary buttons |
| `--c-gold-bright` | `#E8C97F` | hover/active gold, key numbers |
| `--c-moon` | `#E7EAF6` | primary text |
| `--c-mist` | `#A3A9C7` | secondary text |
| `--c-ash` | `#6B7194` | disabled text, hints |
| `--c-signal` | `#5CE1E6` | subway signage, "your turn", focus ring |
| `--c-ember` | `#E2563F` | danger, collapse, disaster |
| `--c-moss` | `#5BC489` | success / ready |

Zodiac accent colours (used in avatar backgrounds, sigils and card edges):

| Sign | Accent | Sign | Accent |
| --- | --- | --- | --- |
| Aries | `#E0533D` ember red | Libra | `#E9E3D2` ivory |
| Taurus | `#C9A55A` old gold | Scorpio | `#9B1B30` deep crimson |
| Gemini | `#8F7BFF` cyan-violet | Sagittarius | `#5B7CFA` galaxy blue |
| Cancer | `#B9D3F0` pearl moon | Capricorn | `#8C7A5B` black-gold stone |
| Leo | `#F2B544` solar gold | Aquarius | `#38E1D8` neon teal |
| Virgo | `#C7CEDB` silver | Pisces | `#7FA8E8` dream blue |

**State is never colour alone.** Every coloured state also has text or an
icon: skill `READY` / `BURNED`, collapse `7 / 12`, ready ✓ + "Ready",
dice tier word ("Perfect").

## 4. Typography

All fonts are open-licence, self-hosted with `@fontsource` (no third-party
font requests).

| Role | Family | Use |
| --- | --- | --- |
| Display | **Cormorant Garamond** 600/700, small caps for labels | titles, character names, event card titles, skill names |
| UI / body | **Manrope** 400/600/700 | everything readable |
| Signage / numbers | **JetBrains Mono** 500 | room codes, 00:17 clock, round, collapse, dice, log timestamps |

Type scale (mobile-first, fluid with `clamp`): `--t-xs 12px`, `--t-sm 14px`,
`--t-md 16px` (body never below 16px on mobile), `--t-lg 20px`, `--t-xl 28px`,
`--t-2xl 40px`, `--t-hero clamp(48px, 12vw, 120px)`.

## 5. Surfaces and materials

Not "white cards". The material vocabulary:

1. **Glass** — `background: rgb(18 26 58 / 0.55)`, `backdrop-filter: blur(14px)`,
   1px border `rgb(201 165 90 / 0.18)`, inner top highlight. HUD and sheets.
2. **Ticket** — warm-dark paper gradient, perforated edge (CSS mask radial
   dots), serial number in mono. Room code, character ticket, results.
3. **Tarot frame** — double gold hairline with corner ornaments (inline SVG),
   used on character cards and event cards.
4. **Holographic foil** — conic gradient (violet → teal → gold) under a
   pointer/tilt-driven mask at low opacity; character card on reveal, skill
   READY.
5. **Grain** — fixed full-screen SVG noise at 4–6 % opacity over everything.
6. **Light** — one source per scene (platform light, carriage lamp); vignette
   at the screen edges.

Radii: `--r-sm 6px`, `--r-md 12px`, `--r-lg 20px`, `--r-pill 999px`. Cards
use `--r-md`; tickets use 4px with perforations.

## 6. Layout and hierarchy

The game screen follows four layers of priority:

1. **What is happening now** — top banner: "Your turn", "Inspector is moving",
   "Vote: Emergency brake?" — largest type, signal colour, animated in.
2. **What can I do** — action wheel / bottom sheet: Move, Investigate,
   Search, Repair, Help, Trade, Stabilize, Confront, Skill. Disabled actions
   stay visible, greyed, with the reason on tap/hover.
3. **What others are doing** — avatars in carriages on the train, a small
   ring on whoever is acting, compact player strip.
4. **Rules and history** — log drawer (side panel on desktop, pull-up on
   mobile), rules sheet. Never in the centre.

Persistent top bar: `ROUND 6 / 12`, `COLLAPSE 7 / 12` (meter + number),
anchors `◆◆◇`.

### Breakpoints (mobile first)

| Name | Min width | Layout |
| --- | --- | --- |
| base | 320px | single column; train scrolls horizontally *inside its own container*, page never scrolls sideways; bottom action sheet |
| `sm` | 640px | wider train, HUD beside sheet |
| `md` | 900px | train full width, side log drawer |
| `lg` | 1280px | three columns: players / train+action / log |

Touch targets ≥ 48×48px. Primary actions sit in the bottom third on mobile
(thumb zone). Safe-area insets respected (`env(safe-area-inset-*)`).

## 7. Key screens

| Screen | Visual idea |
| --- | --- |
| **Landing** | Empty platform at night, perspective rails, train headlight growing in the distance, LED board `00:17  N13  ██████`. Buttons: **Create room** (gold) / **Join room** (outline). |
| **Create / Join** | Big ticket with 6 split-flap code cells; copy-code button; nickname field styled as handwritten ticket line. |
| **Lobby** | Seats arranged around a star-chart dial (10 positions, astrolabe ring); each seat shows avatar, nickname, sign glyph, MBTI, Ready state. Host crown marker. Empty seats are faint outlines. |
| **Zodiac pick** | Rotating zodiac wheel; selecting a sign rotates it to 12 o'clock and lights its constellation. |
| **MBTI pick** | 4×4 grid of tarot-like tiles grouped by temperament (NT/NF/SJ/SP), each a small glyph, not text walls. |
| **Character reveal** | Darkness → sigil draws itself → portrait fades up from black → title in display type → skill name → description. ~3.5 s, skippable. |
| **Game** | Side-on train across the screen, 8 carriages, avatars inside their carriage; inspector as a faceless silhouette; anchors as glowing nodes; collapse as cracks spreading over the window glass. |
| **Event card** | Large tarot-frame card slides up, title, illustration (SVG composition), description, choices with risk tags, countdown ring. |
| **Ending** | Three terminals light up in sequence; city lights return outside the window; passenger counter ticks +1 then goes dark. |

## 8. Motion

Library: Motion (`motion/react`). Motion explains state changes; it never
blocks input (all animations interruptible; the server state is already
applied before the animation plays).

| Token | Value | Use |
| --- | --- | --- |
| `--m-fast` | 120ms | hover, press |
| `--m-base` | 220ms | panels, toggles |
| `--m-slow` | 480ms | cards entering, carriage moves |
| `--m-cinematic` | 1200ms | reveal steps, act transitions |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | entering |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | moving |

Required moments (from the brief): join, player card enter, character
generation, portrait reveal, card flip, skill use, skill burn (crack → ash →
ember out), dice roll, fate spend (coin flies into die), player move,
carriage swap, inspector move, collapse increase, vote, anchor repair, final
three terminals, victory, defeat.

`prefers-reduced-motion: reduce` → replace movement with opacity fades,
no camera shakes, durations ≤ 150ms.

## 9. Character cards

Contents: portrait, zodiac glyph, MBTI, title, skill name, skill type tag
(ACTIVE / REACTION / PASSIVE), skill state.

- `READY` — gold frame, foil shimmer, label "READY".
- `BURNED` — portrait desaturates, crack overlay draws across the skill
  emblem, ash particles, label "BURNED".
- `LOCKED` (e.g. "Void Night" rule) — chain hairline, label "LOCKED".

## 10. Avatar system (192 portraits, PHASE 3 ✓)

Generated by `scripts/gen-avatars.ts` into `public/avatars/<zodiac>-<mbti>.svg`
(e.g. `scorpio-entp.svg`). Deterministic: same input → same file. Each
portrait is a bust in a circular/arched frame composed of layers:

| Layer | Driven by | Variants |
| --- | --- | --- |
| Background field + sigil | zodiac motif (flames, gold leaf, mirror split, waves, sun rays, grid, scales, obsidian shards, star map, mountain ridge, circuit lines, water rings) | 12 |
| Palette | zodiac accent + MBTI temperament shift | 12 × 4 |
| Head shape / jaw | MBTI | 4–6 |
| Hair silhouette | MBTI × zodiac element | ≥ 16 |
| Eyes / gaze | MBTI temperament (cold, sly, dreamy, kind, sharp…) | ≥ 8 |
| Headpiece | zodiac (horns, crown, laurel, veil, halo, antenna…) | 12 |
| Collar / garment | MBTI role (commander coat, lab coat, hoodie, armour, stage jacket…) | 16 |
| Held object / accessory | MBTI (chess piece, flask, baton, mask, quill, lantern, wrench, microphone…) | 16 |
| Ear / face detail | combination hash (earrings, scar, monocle, tattoo line, freckles) | 6 |

Every pair of characters differs in at least 3 visible features (background
motif, headpiece, garment and held object already guarantee 3+). A test checks
192 characters ↔ 192 files and that no two files are byte-identical.

As built: the head is one of 4 shapes and the hair one of 16 styles (with a
light-to-dark gradient and a shadow cast on the forehead). Eyes and mouth come
from the MBTI type, and skin tone (6) and a small face detail (6) are hashed
from the character id. Each file carries its feature list in `<metadata>`,
which is what the distinctness test reads. Average file size is about 7 KB.

In the UI: lobby seats show the portrait once a character is chosen (before
that, the sign sigil or an empty seat). The ticket card pairs the portrait
with a sigil badge. In the reveal, the sigil draws itself and then the
portrait rises out of the dark inside it.

## 11. Sound (interface only)

`audio/` exposes `play(cue)` for `ambient | train | door | dice | skill |
alarm | ending`. No assets until we have licensed or self-made ones; the mute
toggle is always visible in the top bar and remembered per device.

## 12. Accessibility

- Keyboard: every action reachable with Tab/Enter/Space; visible focus ring
  in `--c-signal`; the action wheel is a roving-tabindex menu.
- Screen readers: the "now" banner is an `aria-live="polite"` region; dice
  results are announced as text.
- Colour never carries meaning alone (see §3).
- Contrast AA for all text; minimum body size 16px on mobile.

## Scenario 04 table

The auction retains the Scenario 03 screen structure and shared HUD. The
central panel is a dark, gold-edged table: lot and price in the middle, fixed
clockwise seats nearby on wide screens (opposed for two players), and a simple
grid on phones. The own player HUD is centered within the Scenario 04 dock.
The original auction progress bar remains in the shared top bar. A separate
Scenario 04 meter under the objective gauges irreversible hall Collapse from
0 to 10, with its number and a short explanation. The auction header uses two
compact rows on phones so the original auction progress and
round remain legible beside the separate Collapse meter. The table
adds an auctioneer line for each lot and a short response to the previous
sale or withdrawal. The introductory card keeps its original title and entry
button while adding a compact auctioneer proclamation. Final Settlement opens
with a distinct Exit Rights warning at 9 / 10; Ending and Results keep their
original controls and statistics while adding collapse, personal fate, and the
winning Final Bid to the results recap.
Core BID/PASS actions, tactical actions, and the shared ability/item/end-turn
row have distinct levels. Turn,
leading, and passed states have text labels as well as color. On narrow
screens the lot, table status, PlayersStrip, and Dock stack in that order.
The item picker shows held lots and an explicit use control; Chrono Key opens
the four earlier source choices. Acquiring a lot at auction or in a deal raises
an owner-only inventory notice for one second. A used item leaves the picker and raises a
short owner-only result notice for activation, copying, or counterfeit
discovery. These notices use text as well as colour. Active auction effects and
temporary penalties use the same chips as the own ability, immediately after
it; chips disappear when the server state says the effect ended.

Round 10 replaces the round table and turn dock with a mobile-first Final
Settlement board. The owner's Debt tier and starting negative Final Chips are
shown above individually clickable resource rows and per-item USE/CONVERT
choices. The Final Chips number remains visible while scrolling and animates
after every investment. Public player cards show only settlement or bid
submission status; amounts and choices stay private. Once everyone is READY,
the board takes sealed Final Bids and then displays every bid, modifier,
effective bid, and winner in one reveal.
