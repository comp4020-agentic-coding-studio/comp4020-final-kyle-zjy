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

## 11. Sound

Music is the 27 licensed recordings in `public/audio/music/`, chosen per
public stage by `audio/score.ts` (cue sheet: `docs/music-direction.md`).
Foley is synthesized in `audio/manager.ts` (`SFX`), so there are no sound files
to go missing. Interface clicks are near-silent; story beats (a perfect roll,
a rising danger, an ending) carry weight (`GAIN`). `game/fx/stageFx.ts` is the
one table from a server cue to its sound, played once per fresh cue by
`useStageFx` (at most three per burst). Another player's private result never
makes a sound for anyone else. The mute toggle is always visible and
remembered per device.

## 11a. World pressure and stage feedback

The run root (`ScenarioExperience`) carries `--pressure` (0–1) and
`data-pressure="calm|uneasy|critical"`, from `game/fx/pressure.ts`: Collapse
over its maximum, or the auction round in scenario 04. `styles/stage.css`
turns it into each world's atmosphere (an ember vignette everywhere; a rising
tide line in the city; a dimming hall at the auction; hooks `.train-light` and
`.era-ghost` for scenarios 01 and 03). Exact numbers stay on screen; the
atmosphere is there so the table feels the danger without reading them.
Reduced motion keeps the colour and drops the pulses.

- **Rolls** reveal as a chain: die, then each modifier in turn (a helper's
  portrait beside "Help"), then the total and tier. A tap shows it all.
- **Cards** (`game/cards/Card.tsx`): one physical card for items, clues,
  memories, relics, lots and intel; private ones carry an "Only you" stamp.
- **Only you know** (the secrets drawer) opens with that stamp, and each
  private note is an intel card.
- **Trades** are a two-sided table: your portrait and offer on the left, theirs
  on the right, the exchange mark between.
- **Round headers** carry each scenario's own line: `00:17 · Emergency brake`,
  `City broadcast · water rising`, `Cycle 07 · 1996 · stability 6/12`,
  `Lot 06 · current bid 4`.
- **The story of this run** (`game/StoryRecap.tsx`) opens every results screen.
- **Run top bar on phones**: the scenario chips (boat parts, year, loops)
  take their own full-width row under the round and gauge, instead of a
  narrow column beside them.
- **Irreversible choices** are checked by clicking them: `scripts/ui-interactions.ts`
  boards in scenario 02 (Board → confirm, "Not yet" backs out) and locks a
  sealed bid in scenario 04 (a short press is ignored; holding locks it).
- **Ending poster** (`game/EndingPoster.tsx`): every results screen opens
  with a title card on the scenario's backdrop (rails, rain lines, CRT
  scanlines, a single spotlight), the run's last round and the whole cast,
  composed to read as one screenshot. The words are each scenario's own
  ending text.

### Scenario 01 in play

- **Memory Board** (`game/MemoryBoard.tsx`, opened from the top bar, where the
  link replaces the old fragment counter and still shows `n/3`):
  six fragment cards pinned with the carriage they came from (unfound ones say
  where to look), and the outline of a person that lights one piece per core
  memory. It never says whose memory a fragment is.
- **Escape sequence** (`game/EscapeSequence.tsx`, act 3): the three locks big,
  "n / 3 this round", who carries each key. When the third holds, a beat of
  silence, then the door.
- **Train**: carriage numbers (`.carriage-no`) jitter and roof lights
  (`.train-light`) flicker as pressure rises; the acting passenger wears ACTING.
- **Scenes**: the blackout flickers before it holds and three "click."s sound
  in the dark; the fold tears with scanlines; after the brake vote a short
  scene (`game/Moments01.tsx`) shows the count and the consequences one by one
  (a shake when braking); the last choice is preceded by the six memories
  assembling into one figure. All of these are tap-to-dismiss and only show
  what the server already decided.
- **Identity verification** (`game/IdentityCheck01.tsx`): when a ticket-check
  roll starts, a cold-white passenger file heads the dice card itself (so it
  never covers the die or the Fate choice): IDENTITY
  VERIFICATION, the name (with a scan line and a brief record jitter), one
  record the whole table can already see (an anchor they restored, a key they
  carry, or the carriage they were last confirmed in), their list status, and
  a stamp that reads CHECKING until the server's roll resolves, then VERIFIED
  or WAVERING. It never reads a message, an obsession or an ordinary item, and
  the brake scene steps aside if braking sends the Inspector straight to a check.

### Scenario 02 in play

- **Map** (`game/city/HexCityMap.tsx`): player tokens are one top layer, so they
  glide between zones; the acting player pulses gold. Flooded zones carry a
  water tint, sunk ones a deeper one; zones that went under in the last seconds
  (SUNK cue) flash once. Broken roads show a red crack where the link was.
- **Emergency broadcast** (`city/Broadcast.tsx`): one amber line under the top
  bar, rotating through public facts only: zones that go under at the next
  rise (`warning`), people still waiting, standing tunnels and bridges, roads
  lost, flooded districts. The ROUND cue plays radio static (stageFx).
- **Evacuation triage** (`city/Triage.tsx`, once seats are known): a narrow
  column docked at the left of the map's scroll row. The map stays centred (an
  equal empty column balances it on desktop; on phones the row opens scrolled
  to the map and the triage is one swipe left). Before seats are known the map
  stands alone, unchanged. People
  ranked by public work, tagged ABOARD / AT THE PIER / IN THE CITY. Pass
  holdings are never shown.
- **Boarding**: the window opens with a horn (BOARDING_OPEN cue) and an
  EVACUATION WINDOW OPEN label; choosing Board asks once more. Aboard players
  get a calm observer panel; while the boat waits for its generator everyone
  sees FINAL STARTUP REQUIRED.
- **Endings**: the engineer's fate is "The Last Light" (marked Not evacuated
  / Key sacrifice). A BOAT_LOST ending names the part and the zone that took
  it (public flags `s2_lostPart`, `s2_lostSite`).

### Scenario 03 in play

- **Time jump**: the existing veil now flips the year itself (2026 ⇄ 1996)
  for about a second with the rewind sound.
- **Timeline shift** (`scenario03/Causal03.tsx`): after a successful
  intervention, a panel lists which 2026 rooms changed, derived from the
  rewrite cue's before/after, never what they became: the table has to go and look.
- **Causal network** (in "Only you know"): every 1996 decision open this act,
  its recorded choice and the 2026 rooms it touches; undecided ones show ???.
- **Administration directive**: the viewer's private directive as an "Only
  you" card; after the run, everyone's with ✓/✗ under the story.
- **Final archive**: the route checklist's ticks are the server's
  `routeConditions`, not a client re-derivation.
- **Time prediction**: before a major intervention (prototype core, accident
  record, staff evacuation), the other travellers with Fate secretly bet 1 on
  whether 2026 will change; the feed names who called it right.

## 12. Accessibility

- Keyboard: every action reachable with Tab/Enter/Space; visible focus ring
  in `--c-signal`; the action wheel is a roving-tabindex menu.
- Screen readers: the "now" banner is an `aria-live="polite"` region; dice
  results are announced as text.
- Colour never carries meaning alone (see §3).
- Contrast AA for all text; minimum body size 16px on mobile.

## Scenario 03 opening

The 81-second client film uses restrained blue-grey surveillance feeds,
perspective room schematics, a redacted case file and the 1996/1998 date
contradiction. The same room shell switches between digital blue-grey 2026
and warm, scanned analogue 1996. The brief rewind uses selected years and
small horizontal distortion, never a bright full-screen flash. Lockdown uses
a three-second warning pulse. Anonymous blurred silhouettes suggest missing
visitors without identifying anyone.

The film follows the existing Motion/CSS stack. A stable scene/caption clock
owns playback, and each scene crossfades. The title dissolves into the live
map/HUD with a two-second handoff; black bars recede. Skip remains available
from the start and becomes more visible after two seconds. At 320/390 px,
era panels and causal examples stack, captions wrap, controls remain at least
48 px and safe-area/dynamic viewport insets protect the edges. Reduced motion
retains the full story, replaces distortion/pulses with short opacity changes
and preserves independent Skip. Narrative information is fully subtitled in
English and Chinese. One persistent mute control serves both film and game.

Audio has one shared Web Audio owner with two streaming music decks, locally
served CC BY 4.0 recordings, short foley and crossfades. The score changes with
public stages and survives Ending/Results. The visible Music menu provides
composer, sources, license and an edit notice. See [music-direction.md](music-direction.md).

## Four opening languages

| Scenario | Materials and motion | Sound and handoff |
| --- | --- | --- |
| 01 · N13 | Station clock, staggered phones, a quiet black train, perforated tickets turning over, an anonymous manifest, incomplete memory objects. Pale fluorescent green and aged paper. | Broadcast/rail hum first, no music until the tickets; door silence, soft record errors and a ticket punch. Fluorescent rail title dissolves into the actual current carriage. |
| 02 · Sunken City | Rain, emergency radio, the existing 31-zone hex topology, interrupted roads, boat diagnostics, rescue signals, a rising gauge and blurred cabin. Blue-grey with muted amber warnings. | Submerged atmosphere grows into an industrial score; interrupted siren, radio static and distant horn. Water-reflection title fades to the authoritative city map. Capacity remains PENDING. |
| 03 · Incident Zero | Existing CRT/archive/dual-year film and chronology contradiction. | Layered bells, a mission motif and era-specific scores; 81-second story retained. |
| 04 · Auction | Black envelope, unmarked door, velvet elliptical table, eight black chips, covered lot silhouettes, public seats and a white-gloved hammer. Black, wine red and gold. | Paper first, recorded noir piano and a bass/piano/brush/trumpet ensemble, chips/cards/hammer. Spotlight title recedes into the real Lot 01 table. |

The controller and accessible controls are common; world art and title motion
are separate. All new scenes stack their own content at 320/390 px rather than
shrinking a desktop composition. The flood forecast is explicitly illustrative;
the manifest error is anonymous and illustrative. Reduced motion removes travel,
flips, pulses and scale changes while preserving the story and short fades.
After entry there is one brief contextual hint, with no extra tutorial wall.

## Scenario 04 table

The auction retains the Scenario 03 screen structure and shared HUD. The
central panel is a dark, gold-edged table: lot and price in the middle, fixed
clockwise seats nearby on wide screens (opposed for two players), and a simple
grid on phones. The own player HUD is centered within the Scenario 04 dock.
The current public lot card shows its name, distinct symbol, atmospheric
description, and bidding status, but never prints its item effect or unrevealed
authenticity. Every ordinary item has a compact line icon; a holder's private
inventory shows the exact effect and any legal target or timing choices. Certified
intel stays in its separate, explicitly exposed section.
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
The existing `data-s4-transition` region now has an auctioneer icon and a
persistent House Rule card side by side at desktop widths. At phone widths they
stack in reading order. The card stays compact by default: rule number, icon,
name, and one sentence. The auctioneer's rule-specific line, flavor, and full
explanation appear when the card is expanded. The same card offers an explicit
collapse label while open; a short reduced-motion-aware
reveal marks each new round. Round 9
also places a private server-calculated preliminary settlement below the
proclamation. The developer controls expose
the current seeded order, generated preview, and targeted rule activation.
Core BID/PASS actions, tactical actions, and the shared ability/item/end-turn
row have distinct levels. Turn,
leading, and passed states have text labels as well as color. On narrow
screens the lot, table status, PlayersStrip, and Dock stack in that order.
The item picker shows held lots and an explicit use control; Chrono Key opens
the four earlier source choices. Acquiring a lot at auction or in a deal raises
an owner-only inventory notice for one second. A used item leaves the picker and raises a
short owner-only result notice for activation, copying, or counterfeit
discovery. Counterfeit discovery uses an assertive, prominent alert above the
auction interface, while other players receive no such notice. Blackjack HIT
busts leave the drawn card and updated total in a two-player result decision;
both players confirm before the table resumes. These notices use text as well
as colour. Active auction effects and
temporary penalties use the same chips as the own ability, immediately after
it; chips disappear when the server state says the effect ended.
New item use notices share one brief motion shell. A counterfeit receives the
same owner-only alert regardless of item; passive fakes confirm on their first
trigger. Red Thread Scissors adds a cancel control to a pending deal, and the
trade preview states the Debt consequence of Stranger's IOU. Blackjack shows
the burnt card and replacement in order before returning to the hand.

Round 10 replaces the round table and turn dock with a mobile-first Final
Settlement board. The owner's Debt tier and starting negative Final Chips are
shown above individually clickable resource rows and per-item USE/CONVERT
choices. The Final Chips number remains visible while scrolling and animates
after every investment. Public player cards show only settlement or bid
submission status; amounts and choices stay private. Once everyone is READY,
the board takes sealed Final Bids and then displays every bid, modifier, and
effective bid in one reveal. A tied high bid shows a central TIE state before
the same board shifts to Final Showdown. Participants see five large card backs;
spectators see only selection progress. A locked choice stays face down until
all tied bidders choose, then the selected ranks flip together. Further ties
repeat within this board; a unique winner receives the Exit Rights announcement
and only then the outcome control appears.

### Scenario 04 in play

- **Table and lot card.** The current lot is a compact Lot Card at the centre
  (icon beside the name, so it stays short): `LOT nn`, icon, name, one vague line, price, high bidder, turn and "n of N still in". It never
  prints the use effect or authenticity (effect text appears only in the holder's
  own inventory and final settlement). Each new bid drops a chip toward the card
  (`S4_BID` cue, `chip_drop`). Seats show a chip stack: chip counts are private, so
  only the viewer's own stack is true (with its number); every other seat shows a
  dashed, covered stack labelled "Chips hidden".
- **Counterfeit use.** Other players get the floating cue "X used <lot>" (cue
  carries only who and which lot). The user, after about a second, gets a private
  intel Card (`only you` stamp): "Counterfeit - nothing happens. You now know this
  lot is fake."
- **Pressure.** At round 10 (`data-pressure="critical"`) the vignette closes to a
  small centre and the lot card glows; everything else falls into the dark.
- **Blackjack.** `Blackjack04` deals cards one at a time (only newly drawn cards
  animate), counts each total up, pauses, then shows BUST/settlement. The decision
  buttons stay disabled until that finishes; tapping the table skips. Totals are the
  server's hands; nothing is recomputed for the outcome.
- **Round 10.** The host says "Ladies and gentlemen. The last lot." and then
  `LOT 10 - Exit Rights` lands. The private breakdown lists black chips, Sanity,
  Fate, AP, genuine items, counterfeits, debt penalty and bonuses from server data
  (own view only). LOCK BID is press-and-hold (700 ms, progress fill, release
  cancels; Space/Enter also work), then a locked state that has no undo. The reveal
  shows bidders one at a time, waits, then names a TIE. The five-card showdown keeps
  face-down patterned cards; revealed cards flip in together.
- **Debt ending.** The ending screen dims around a suited figure: "Congratulations
  on leaving. Now let's discuss what you owe." with "Debt follows you".
- **Secret commission.** One private Card in the secrets drawer; the Results screen
  reveals every player's commission with a met/missed mark.
- Reduced motion removes the chip travel, card flips, staged deals and fades; the
  information is the same.

## Developer / Assignment Check

The home entry is a muted two-line secondary action below Create/Join, with a
thin divider, smaller type and no gold fill. `/developer` uses the same night
sky, tarot surfaces, typography and signal/gold tokens. Four independent cards
use grouped checkpoint selectors and one launch button each; opening replays
and UI checks occupy a separate section. A prominent developer label and usage
notice identify the page. Test rooms have a compact persistent return/seat bar
and a collapsible tool panel. The existing game and opening remain visible;
the film is inset below the measured bar only in developer rooms. Cards stack
at phone widths, use zero-minimum grid tracks, and keep 48px controls.

## First-view bubble guide

Each scenario's first in-play screen gets a short screen tour (4–6 notes, in
`src/client/components/guide/steps.ts`). Each note outlines one region tagged
`data-guide="…"` and puts a small bubble beside it. The tour dims the page only
slightly and never blocks input. A note advances by itself after 2.6 s or on
Next, and Skip or Escape ends the tour. A note whose region isn't on screen is
passed over.
`ScenarioExperience` starts the tour only once the screen is clear: no scene
card, no unresolved roll, and no decision waiting on this player. It plays once
per scenario per browser (`localStorage` `fate:guide:<scenario>`), and the "?"
button beside the sound controls replays it. The tour is presentation only: it
reads no game state beyond what is already rendered. It is checked by
`test/bubble-guide.test.ts` and in the browser by `scripts/ui-guide.ts`.

### Movement confirmation

The Move action always opens the destination picker, even with only one legal
destination. Choosing a destination in the picker or highlighted map confirms
the move; pressing Move alone never sends a movement intent.
