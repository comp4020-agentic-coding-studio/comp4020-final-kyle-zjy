# Build log (unattended run, PHASE 4 → 11)

Working notes for the agent: what each phase delivered, decisions taken
without asking, and what remains. Read this first when resuming.

## Phase plan (from the original brief)

| Phase | Scope | Status |
| --- | --- | --- |
| 4 | Engine core: GameState, rounds, turns, AP, 1D6 + Fate, Sanity, skill uses, turn order, 8 action frameworks, persistence, timers, projection, game UI shell | done |
| 5 | Scenario 01 act 1: train map UI, seeded carriages, rounds 1–3, investigate/search outcomes, items, memory fragments, act-1 events, round-3 blackout transition, night rules, obsessions dealt | done |
| 6 | Act 2: Faceless Inspector + ticket checks, seat neighbours, three anchors, round-5 secret messages, round-6 vote, round-7 Reality Fold | done |
| 7 | Act 3: cab, rounds 8–12, two inspector steps, echoes, escape protocol, win/fail, normal + true endings, results | done |
| 8 | All 192 skills through a Skill Resolver of shared effect handlers; resolve every item in skill-mapping-notes.md; skill tests | done |
| 9 | Visual polish of every screen; loading/empty/reconnect/error states; 320 px fixes | done |
| 10 | Testing: 2/3/4/6/8/10 players, concurrency, refresh, disconnects, host leaving, duplicate codes, round flow, skills, votes, win, loss, mobile | done |
| 11 | Simulated full games (2, 6, 10 players) with action logs; fix dead ends, idle players, unusable skills | done |

## Decisions (taken without asking; reasons)

(appended per phase)

### PHASE 4 (done)

Engine done: `src/server/engine/` (rng, create, flow, dice, windows, effects,
outcomes, actions, project, resolver, inspector, beats, round-events, ending),
persistence (`migrations/002_games.sql`, `src/server/game/{store,runner}.ts`),
hub wiring, 249 unit + 22 spec tests. Client game screen being built in
`src/client/game/`.

Decisions:
- No mirrored `secret_information` / `game_events` tables: secrets live in the
  state snapshot (stripped by `project()`), history in `action_log`. One
  source of truth; replay test proves the log is sufficient.
- Disasters on action rolls add +1 Collapse ("partial failure +1").
- Group event rolls are auto-rolls without Fate or reaction windows (10
  players × windows would stall the table); single rolls get the full pipeline.
- Event effects on players respect shields/immunities but don't open reaction
  windows; reactions answer single-target effects (PHASE 8 pipeline).
- A turn stays open at 0 AP (abilities and items are free) with a 20 s wrap-up.
- Lost players can't CONFRONT; everything else stays available.
- Items are public (cooperative game; trading needs it). Dream cards, secret
  messages, obsessions and hidden statuses are private.
- Client: `src/client/game/` (TopBar, Banner, Train, CarriageInfo, EventPanel,
  PlayersStrip, Dock, Dice, Decision, Sequence, drawers) + `screens/Game.tsx`.
- Component CSS lives in `@layer components` and base CSS in `@layer base`, so
  Tailwind utilities can override them (found when `rounded-xl` had no effect).
- Overlays are opaque (`--glass-bg` 0.9): headless Chromium doesn't render
  `backdrop-filter`, and readability shouldn't depend on blur anyway.
- Mutation checks (turn gate, Fate cap, hidden-status projection) all caught.
- Already written ahead of schedule, to be tested/finished in their phases:
  act-2/3 beats (inspector, neighbours, secrets, brake vote, fold, echoes),
  round events, escape check, endings and results.

### PHASE 5 (done)

Act 1 tested and surfaced in the UI. `test/act1.test.ts` (30) covers seeded
carriages and fragment placement, investigate/search outcomes per tier
(fragments, items, dream cards, Fate), item use, Boarding Car first-return
Sanity, act-1 event cards (vote / each-choose / group roll / instant), night
rules, obsessions dealt privately, and the round-3 BLACKOUT into act 2.
No engine bugs found. `rigNextDie()` in `test/helpers.ts` forces a die value.

Decisions:
- Risk-driven testing from here on (see CLAUDE.md "Testing policy"): no full
  suite at non-milestone phases; PHASE 5 ran typecheck, act1 + engine unit
  tests and a browser play-through to act 2.
- New `Objective` line under the banner (the act goal with progress) and
  `CueFeed` (floating notes for fragments, items, Collapse, lost passengers,
  shadows), so a roll's consequence is visible without opening the log.
- The objective wraps rather than truncates (at 390 px the counter was cut
  off); cue notes sit over the empty middle of the carriages, not the titles.
- `scripts/ui-play.ts`: two browsers play to `--until act2|act3|end` and keep
  one screenshot per screen kind; reused by PHASE 6/7.

### PHASE 6 (done)

Act 2 tested and surfaced. `test/act2.test.ts` (29) covers: the Inspector's
arrival, targeting (Fate, then items, then turn order) and target cap; ticket
checks per tier, passes and walking away; confronting and banishing; seat
neighbours for 2/3/5/8 players and the neighbour help bonus; anchor repair,
perfects, the no-two-in-a-row rule and small-table tuning; round-5 messages;
the brake vote (both outcomes, seeded tie); the Reality Fold and the round-7
transition to act 3. `Table.playUntil` moved into `test/helpers.ts`.

Bugs found and fixed:
- Hidden info leak: `project()` sent the owner their secret messages and dream
  cards with `isTrue`, so devtools showed which were lies. Now stripped until
  the run is over (`ViewerSecrets` type keeps the client from reading it).
- A "false" message could be true: a Fate lie of real−1 was clamped back to
  the real 0, and a core-memory lie with nothing awake named a sleeping
  carriage. Same flaw in dream cards. Lies now always differ from the truth.
- Mutation checks (isTrue leak, both lie fixes, dream lie, neighbour bonus,
  ticket target cap) were all caught. The lie tests first sampled
  hand-made generator states, which were too correlated to reach the bad
  branches; they now advance the run's own generator.

Decisions:
- Banishment lasts the rest of the round plus the whole next round (the
  Inspector returns at the following round's Inspector step).
- UI: an Inspector line under the objective (where it is, who it's heading
  for, marks), because on a phone it starts off-screen. Anchor and lock badges
  sit in flow under the carriage windows with a text label (`MEMORY 0/1`);
  they used to cover the carriage theme. Act-2 cue notes: Inspector aboard,
  your seat neighbour, distortion, banished, anchor progress and restored.
- `ui-play.ts` scrolls to the top before each screenshot and captures the
  Inspector and the secrets drawer.

### PHASE 7 (done) — milestone: scenario winnable

Act 3 and every ending tested; ending and results screens built. Full suite
(357) and `pnpm ui:walkthrough` pass; `ui-play --until end` plays two browsers
to the results and back to the lobby.

`test/act3.test.ts` (25): echoes per tier, stalking and their touch (shield
absorbs), Inspector steps per tier, each lock and its conditions, locks
slipping at round end, the normal ending, each blocked escape and its reason,
the half-lost boundary, both true endings (majority and timeout), Collapse /
all-lost / time failures, obsessions, titles and results visibility.
Mutation checks on the win logic (half-lost boundary, fragments, anchors, all
three locks, true-ending threshold, ending choice, time limit, lock reset,
lone-wolf help, act-3 AP) were all caught once a "two locks is not three"
test was added.

Winnability (`scripts/sim.ts`, a simple strategy with no abilities or help):
before tuning 0/30 wins at 2 players and 2–9/30 elsewhere, nearly all lost to
Collapse: +1 every round makes Collapse the real clock, and nothing lowered it.
Changes:
- Restoring an anchor eases Collapse by 1 (the log already said "reality
  holds a little tighter"). One `restoreAnchor` path for repairs and for the
  `REPAIR_ANCHOR` effect, which used to skip the cue (and sent no `required`).
- Two-player tables get +1 AP per round in act 3: two passengers can't
  otherwise reach three locks in one round unless the layout happens to allow
  it. Said on the cab-open scene.
- Small tables' Inspector walks 1 carriage a round in act 3, as the tuning
  table always said (the code used 2 for everyone).
After: roughly 2p 17%, 3–4p 30%, 6p 65%, 10p 80% for the naive bot. Final
tuning is PHASE 11's job.

Bugs found and fixed:
- Concurrency: two players pressing End turn on the same view both landed,
  because the first one handed the turn to the second. A turn action is now
  refused (STALE_VERSION) if it was pressed on a view older than the start of
  the current turn (`GameState.turnVersion`). The spec client now sends the
  last seen version like the real client.
- Echoes didn't move whenever the Inspector was inactive.
- Results: "1 carriages explored"; ties gave everyone the same title (a title
  held alone now wins over a shared one).

Decisions:
- Ending text lives in `scenario01/content.ts` (`endingText`), shared by the
  log and the ending screen.
- Results reveal obsessions and every round-5 message with TRUE / FALSE. The
  host's button sends RESTART (back to the lobby, characters kept); others can
  leave for the platform.

### PHASE 8 (done) — milestone: abilities complete

All 192 abilities are resolvable and wired: every effect kind has a shared
handler, every trigger is fired somewhere, every `requires` has a check.
Full suite 588 passed, `ui:walkthrough` passed, `ui-play --until end` plays to
the results and back to the lobby, and `ui-play --skills` uses abilities in
the browser (skill panel and an ability's choice window checked at 390 px).

Design: docs/skill-mapping-notes.md (glossary, pipelines, re-worded skills);
modules: docs/architecture.md §15. Before PHASE 8 only 39 of the 192 could run.

Decisions:
- 153 skills needed work. ~3/4 run exactly as written once the glossary pins
  the generic words to scenario mechanics; ~1/4 referred to things the train
  doesn't have (minigames, decoy dice in a public log, "rule conflicts") and
  were re-worded keeping the character concept; each is listed in the notes.
- PASSIVE abilities fire on their own (no question): once per run, and they
  only ever help their owner. REACTION abilities ask, listing one "Use it on X"
  option per legal target when they need one.
- Unused effect kinds were removed (MASK_RESULT, DEFER_ROLL, USE_STORED_RESULT,
  CONVERT_ACTION, GRANT_INTERRUPT); REVISE_CHOICE was added.
- Rewards are measured (fate / sanity / items gained) around a roll's whole
  outcome and around each event resolution, so every source counts the same.

Bugs found by the new tests and fixed: Access Denied could never fire (its
`others` flag excluded the very case it answers); bets and doubled rewards only
applied to outcomes that went through `reward()`; Copy the Code copied itself
(the last-used record was overwritten before its effect ran); a hit on several
players was never parked for reactions; a transfer sent back had no recipient.

Tests: `test/abilities-all.test.ts` (192, every ability fired in a busy act-2
table: no throw, legal state, every window answerable) and
`test/abilities.test.ts` (39, per mechanism). Mutation checks on parking,
weakening, redirect, conditions, one-way bonds, forbidden targets, reward
measuring, reveal reactions, handler errors, wagers and copy were all caught
(one-way bonds after adding a test).

### PHASE 9 (done)

Every screen checked at 320 px (and 1280 px) by `ui-play --phone 320`, which
now also screenshots the landing page, room dialog, lobby, character picker,
reveal, intro, log, secrets and a passenger's sheet, and fails on clipped
content or touch targets under 48 px. Full suite 589 passed; walkthrough
passed (now including the network dropping mid-run and coming back).

Fixed:
- 320 px: the dock's ability / items / end-turn row overflowed (fr columns
  sized to content; now `minmax(0,…)` + `min-w-0`); the collapsed event chip
  couldn't truncate a long title; the top bar folded "6 / 12" into three
  lines (phones now show "Act II" alone); the lobby ticket squeezed the title
  to three lines (portrait above the text below 360 px).
- Touch targets: top-bar and drawer buttons 44 → 48 px, the picker's cancel
  and the Fate +/- 36 → 48, lobby buttons (min-h-11 was overriding `.btn`'s
  48 px), the room-code button, the "About this project" link.
- Drawers were 90% opaque and let the dock's text show through; now solid.
- States: one connection banner for every in-room screen (it used to exist
  only in the game and lobby), telling "offline" from "reconnecting"; an
  error boundary replaces a blank page with a reload path.
- Bundle: the run's screens load on demand; the main chunk is 462 kB (was
  546 kB with a size warning).
- Mercury Retrograde was shown but never applied; a player's first reroll now
  has its 1 in 3 chance of costing 1 Sanity (test in act1.test.ts).
- Skills (follow-up to PHASE 8, agreed with the user): Can't Let Go is a
  REACTION, since extending a strong buff is worth saving it for; the
  re-worded skills table now has Was / Now / Why for each.

### PHASE 10 (done)

Risk-driven: existing coverage was mapped first, and only the gaps tested.
Full suite 616 passed; walkthrough passed.

| Area | Where it is tested |
| --- | --- |
| 2/3/4/6/8/10 players, round flow, loss | `test/system.test.ts`: an idle table plays to its results at each size, every step a legal state, and the inputs replay to the same end |
| win at every size | `test/system.test.ts`: the team strategy (`test/bot.ts`, shared with `scripts/sim.ts`) wins within 40 seeded runs at each size |
| disconnects | `test/system.test.ts`: everyone disconnected, the timers alone reach the results (no dead end); spec: refresh mid-run |
| host leaving | `test/rooms.test.ts`: the crown moves to the next connected seat after the grace period, stays if nobody is online or the host returns, and a new host can restart from the results; spec: host leaves the lobby |
| duplicate codes | `test/rooms.test.ts`: a taken code is drawn again; closed rooms' codes are never reused (code letters are injectable) |
| concurrency | spec: ten players boarding at the same instant are each accepted once; two End turns at once; repeated action ids; stale views |
| full table | spec: 10 real sockets, each with its own view (< 64 kB), ten turns handing over and the round moving on |
| skills, votes, win logic | PHASE 6–8 suites (abilities, act1–3) |
| mobile | `ui-play --phone 320` (PHASE 9) |

Load (`scripts/load.ts`, server run with the Dockerfile's 160 MB heap):
10 full rooms (100 sockets) through a round in 5 s, RSS 110 → 135 MB; 30 full
rooms (300 sockets) in 9 s, RSS → 190 MB, no errors. Under the 256 MB limit.

Fixed: finished runs stayed in the runner's memory forever when everyone
simply closed the page (only "back to lobby" released them). A finished run
in a room with no sockets now leaves memory (it stays in SQLite and reloads on
demand); a run still in progress stays so its timers can finish it.
`/api/health` reports `runs` held in memory.

### PHASE 11 (done) — final milestone

Full suite 632 passed; `ui:walkthrough` passed; `ui-play --until end --phone
320 --skills` played to the results and back to the lobby with no layout
problems. Details and numbers: docs/simulation-report.md.

- Simulator: the team bot (`test/bot.ts`) can use abilities, items and help;
  `scripts/sim.ts` adds `--abilities`, `--logs` and `--coverage`, and reports
  idle turns. Kept logs (2, 6, 10 players) in `docs/simulations/`, replayed
  exactly by `test/simulations.test.ts`.
- Tuning (all in `tuningFor`): 2 players 3 AP a round (4 in act 3); anchor
  repairs 1/2/3/4 by table size; start Collapse 0/1/2 (6–7 and 8–10 players).
  Win rates with abilities 53–72% at every size, 45–57% without.
- Rule change: only key tasks (repair, confront) raise Collapse on a disaster;
  exploring no longer punishes the whole table, which made idling the best play.
- Fixed: Fate spent down to 0 never counted as reaching 0 (`spendFate`); a
  used-up buff now ends like an expiring one (Can't Let Go, Something to Show).
- Left as a design choice for the user: 11 counter-abilities that answer one
  player hurting another are rare at a co-operative table (all tested).

### After PHASE 11: first deployment

Deployed to https://comp4020-final-kyle-zjy.fly.dev/ by hand (`flyctl deploy
--remote-only --ha=false`, the repo is still private). Checked live: `/`,
`/readme/`, health and avatars return 200; two browsers played to act 2 over
TLS WebSockets at 320 px.

Fixed (found while checking the live run): the active player dropping —
a refresh included — lost their turn at once; the flow skipped away players
before the shortened deadline in `setAway` could apply. Now the turn passes
only when the deadline does: a player who drops keeps it for
`awayTurnSeconds` (15 s), and one who comes back mid-turn gets at least 30 s.
Tests: engine (grace, return, timeout) and spec (the active player refreshes
and still acts).

Live note: through Fly's proxy a closing WebSocket takes about 5 s to be
reported (locally it is immediate), so the server marks a dropped player away
~5 s late. The turn grace (15 s) covers it; verified live by hard-dropping the
active player for 8 s, reconnecting, and acting. The spec's waits for a player
to show as away now allow 10 s, so `spec/game.test.ts` also passes against
the live app. Three lobby specs that wait for a server-side close code still
time out against the live app for the same reason; CI runs them against the
local container, where they pass.

## Localization: English and Simplified Chinese

A player picks EN or 中文 on the landing page or in the lobby; the choice is
stored per browser and locked from departure until the room is back in the
lobby. The server has no locale: game state carries `Msg` values (an English
template key plus parameters, content as id references), and each client
renders them in its own language. Content stays canonical; Chinese for the
scenario and the 192 characters is keyed by id; the 483 engine templates have
a zh-CN table. Fixing this turned up log lines that glued English fragments
into sentences (plurals, "rises"/"falls", trade offers, item and anchor
names); each variant is now a whole template. No rule, RNG or replay changed
(the kept simulations still replay exactly). Tests: `test/localization.test.ts`.

## Ticket check, true secrets, anchor keys, the fold, and core abilities

- Ticket check: the final result decides (after Fate, abilities and
  reactions). 1–3 empties Sanity and the player is lost (still in the run);
  4–5 passes; 6 keeps the temporary pass.
- The system never lies: round-5 messages and dream cards are built only from
  what holds in the live state. `isTrue` and the TRUE/FALSE results badge are gone.
- Anchor keys: each restored anchor puts its key (Power / Identity / Memory)
  in the last repairer's inventory, once per run. Keys are never used up, are
  not rewards, and move only by trade. Act 3's three escape locks (Engine
  Room, Archive Car, Driver's Cab) open only for the key's carrier, still all
  in the same round; the keys stay when the locks slip back. Map badges show
  who carries each key; the dock shows your keys; a cue and log line announce
  a new key.
- Reality Fold: every middle carriage now moves (derangement). The before /
  after order is stored on the FOLD sequence: the scene shows each carriage
  turning over, and the map cards flip once the scene is dismissed.
- Abilities: Character → core skill (20 families, 192 core abilities) →
  scenario-01 adapter → `characterSkill`. Generated once from the old roster
  data with no change to any mechanic; Pisces ENTP's ticket pass is the one
  scenario behaviour. The adapter's visual now drives the ability cue.
- The kept simulation logs were regenerated on purpose (the rules changed).
  `pnpm sim --runs 40`, no abilities: 2 players 30%, 6 players 50%, 10
  players 25% (was 45–57%). Most losses are Collapse; at 2 players some runs
  end with everyone lost to ticket checks. Not retuned in this change.

## Scenario 02, PHASE S2-5: events, abilities, simulation

- **Event deck:** 12 cards; most change the city through the new `CITY_EVENT` primitive:
  - aftershock (a road breaks)
  - storm (a bigger next rise; Sanity for anyone standing in water)
  - emergency broadcast (names the next zones to go)
  - distress signal (a new person to rescue)
  - low tide (a drowned zone back until the next rise)
  - supplies washing up
  - flood wall breach
  - still water (holds a rise)
  - the strange ones: a figure under the water, your name on the radio, the school's lights, a voice you know
  - Each run draws only its own scenario's deck (`src/shared/game/events.ts`).
- **Abilities:** six re-worded for the city (see docs/skill-mapping-notes.md). `ref.skill` and `ref.skillDescription` carry the scenario, so the log names abilities as the run's scenario words them. MOVE_PLAYER moves along city roads through a scenario hook. All 192 fire in a city run (test).
- **Simulation:** `test/bot02.ts` and `node scripts/sim.ts --scenario 02`. Balance changes and results are in docs/simulation-report.md. Four kept city runs replay exactly in `test/simulations.test.ts`.

## Scenario 02, PHASE S2-6: the city on screen

- **Lobby:** tiles 01 and 02 are real choices for the host. The scenario card shows the room's choice. Scenario 02 is now open.
- **Run screen** (`CityGame`):
  - top bar: act, round, a water gauge with Collapse in numbers, the boat (parts / power / gate / seats) and your passes;
  - an objective line per act;
  - the hex map (`HexCityMap`): heights, flooded and drowned zones, a red pulse one rise before a zone goes under, standing roads (tunnels and low bridges dashed), facilities, people waiting, players, move targets. It scrolls in its own frame on phones; tapping a zone selects it;
  - a zone panel;
  - the shared dock with the city's actions and pickers (move, rescue, install, share intel), and trades with parts and passes.
- **Scenes:** the flood scenes for acts 2 and 3, and the capacity reveal.
- **Ending and results:** each player's own fate first, then everyone's, with titles.
- **Hidden information:** the other player's side of a trade is checked when they accept, so a refused offer can't reveal what someone carries.
- **Browser:** `node scripts/ui-play02.ts` plays a two-browser city run to the results. Clean at 390 px and 320 px (layout check, no page errors). The departure decisions use the shared decision card; the bot-driven browser run never readies the boat, so they are covered by unit tests, not by this walkthrough.

## Scenario 02, PHASE S2-7: Chinese, and the milestone check

- **Chinese for all of scenario 02:**
  - content (`zh-CN/scenario02.ts`): 31 zones, items, parts, people, statuses, 12 events, goals, title;
  - 227 engine templates (in `zh-CN/messages.ts`);
  - the UI copy (`client/i18n/s2-zh-CN.ts`);
  - the six city-worded abilities (`zh-CN/skills02.ts`).
  The terms are in docs/localization.md, following the user's spec (撤离资格, 最后的高地, 绝望, 背叛者…).
- **No "Chinese pending" allowance is left in `test/localization.test.ts`.** Scenario 02 must have:
  - matching UI keys and placeholders;
  - every content id in Chinese;
  - the same numbers in its abilities;
  - kept city runs that render in Chinese with no English left.
- **Fixes along the way:**
  - The zone's screen-reader label ran the warning into the status, in English too. It now has its own key.
  - The city intro said "boarded the train" (已登车), and the lobby's depart button read 发车. Both now have city wording.
  - The lobby's "INVITE" button was 40 px wide in Chinese at 320 px. It now has a 48 px minimum.
- **Milestone check:**
  - `pnpm check`: 939 tests passed.
  - `node scripts/ui-play02.ts`: the city at 390 and 320 px, to the results and back to the lobby.
  - `node scripts/ui-play.ts --until end --phone 320`: the train to its end.
  - A Chinese pass over the city: lobby, intro, city at 320 and 1280 px, the move picker, the log. No English left, nothing clipped, no small targets.

## Scenario 02: the user's changes after the first playthrough

- **Shared intel:** it is kept in public state (`city.shared`) and shown in everyone's secrets drawer ("Shared with everyone"), not only in the log.
- **Action points:** 3 a round in the city (1 in despair; 2-player tables keep the shared +1).
- **Objective line:** names the boat parts still missing, and says they are fitted at the Evacuation Pier.
- **People to rescue:**
  - Every run has the harbour engineer or Ms Varga.
  - A placed pass-carrier's pass is always live.
  - The people waiting, where they are and what each gives are public from the start (secrets drawer, "People waiting for rescue").
- **Evacuation office:** its remaining passes are shown to everyone from act 2 (top bar; the pier's zone panel).
- **Slower water:**
  - The round-end rise holds half the time (average about 0.67).
  - A pump run holds back up to 2.
  - The pumps need ⌈n/4⌉ repairs.
  - A zone holding a boat part never goes under before Collapse 9, and must be reachable, along with the pier, through Collapse 6.
- **Kept replays:** the scenario 02 runs were regenerated on purpose (the rules changed).
- **Simulation** (`node scripts/sim.ts --scenario 02 --runs 40`):

  | Players | Boat leaves | Escaped when it leaves | Average rounds |
  | --- | --- | --- | --- |
  | 2 | 80% | 50% | 8.3 |
  | 4 | 98% | 60% | 7.5 |
  | 6 | 95% | 68% | 7.0 |
  | 10 | 100% | 65% | 6.6 |

  Runs now usually end before act 2 (Collapse 5): see the report to the user.

## Scenario 03, PHASE 1: movement and time foundation

- Registered Scenario 03 behind a closed lobby entry. Its engine adapter has
  an eight-room tree shared by 1996 and 2026, 3 base AP, 12 rounds across
  four acts, adjacent walking and a same-room 2-AP time jump.
- Added an additive shared `ACT_4` phase. Scenario 01/02 still use their own
  unchanged transition rules, covered by regression tests.
- Persisted authoritative room/year locations and exposed only public team
  locations through the server projection. Existing room queues, snapshots,
  reconnect handling and intents carry the new actions.
- Added localized English and Chinese development screens for the intro,
  map, ending and results. The lobby remains closed while Scenario 03 has no
  story, causality, items or true win condition.
- Phase checks: typecheck, build, `pnpm check` (952 tests), and an isolated
  three-browser walkthrough at 320, 390 and 1280 px, including live sync,
  time jump, reconnect and layout checks. The 320 px view used Chinese.

## Scenario 03, PHASE 2: first causal rewrites

- Added three 1996 causal nodes: the archive gate, a research worker and the
  official report. Validated `INTERVENE` actions are recorded in order, then
  derive the 2026 state from the stored baseline without drawing new RNG.
- The consequences affect 2026 access to the Secret Archive, the research
  worker's presence, an old-badge cache and the archive report. Choosing to
  preserve a record closes that decision without claiming a rewrite.
- A 2026 Archives investigation grants a private case-file clue. Projection
  exposes the public timeline and only the viewer's evidence; snapshots and
  reconnect retain both. The client shows a localized consequence record and
  a short ripple when a material rewrite arrives.
- The lobby remains closed. The badge cache is a room fact, not yet a
  transferable item instance; that conservation lifecycle belongs to PHASE 3.
- Checks: production build, `pnpm check` (957 tests), three-browser Scenario 03
  rewrite path at 320/390/1280 px with Chinese at 320, and complete Scenario
  01/02 browser walkthroughs back to the lobby. `git diff --check` passed.

## Scenario 03, PHASE 3: numbered relic conservation

- Added two seeded, player-linked relics visible in 2026, matching private
  obligations to place their sources in protected 1996 fixtures. A saved
  research worker creates one additional old-badge instance.
- Pickup, time jump, protected storage and accepted co-located transfer move
  one stable instance between statuses and owners. Storage records its real
  actor and round; repeat pickup and wrong-owner storage are rejected.
- Objective artifacts remain in isolated `temporal.holdings`, outside item
  pools, the generic player inventory and relic transfers. Ordinary Scenario
  03 consumables come only from a Research Wing supply search and can be used.
- The 2026 `TEMPORAL_CONTAINMENT` is a Research Wing facility state, with no
  ninth map node. English/Chinese item content and UI labels are complete for
  this phase; other players' held relics and obligations are not projected.
- Checks: production build, `pnpm check` (963 tests), three-browser Scenario 03
  pickup/storage/transfer path at 320/390/1280 px with Chinese at 320, and
  Scenario 01/02 full browser regressions. The trade revalidation and
  objective-protection assertions also passed in a focused rerun.

## Scenario 03, PHASE 4: Act I investigation

- Added once-only, persisted story beats for the lockdown, official Incident
  Zero file, Archivist 00, first actual jump and material causal rewrite,
  numbered relic provenance, the round 2 access signal, and the round 3
  transition. The file presents the founder's death and intruders as official
  claims; no later identity or ZERO revelation is exposed.
- Archivist 00 is a 2026 Archives NPC. A validated, 1-AP conversation grants a
  private note and a public story beat; reading the case file remains a
  separate action. Projection keeps the private note and case-file variant
  with their owner. The NPC's true identity remains hidden.
- The Act I story panel, intro, NPC and archive copy are present in English and
  Chinese. A preserved 1996 decision does not announce a timeline rewrite;
  round 3 never claims an archive search occurred if players skipped it.
- Checks: production build, `pnpm check` (967 tests), three-browser Act I path
  at 320/390/1280 px with Chinese at 320, screenshot/layout inspection,
  Scenario 01/02 full browser regressions through results and back to lobby,
  and `git diff --check`. The lobby stays closed while Acts II–IV and full
  endings are incomplete.

## Scenario 03, PHASE 5: unknown intruders

- Round 4 opens the Director's Office and Main Laboratory in both years.
  Players can investigate a recovered 2026 surveillance tape, the 1996 access
  ledger and prototype telemetry. Private evidence stays with its reader;
  public story beats mark discoveries without revealing the intruders early.
- Sealed profiles are created deterministically from the selected team. Real
  1996 arrivals, movements, interventions and relic storage append ordered
  surveillance traces with the action's actor and provenance. The recovered
  feed shows anonymous signatures before round 6; neither sealed profiles nor
  actor matches enter the projection before the reveal. No skipped action is
  represented as a trace.
- The end of round 6 matches all sealed profiles to the team and opens a
  synchronized identity scene. Every connected player acknowledges it before
  round 7 begins. The earlier phase-flow test now checks this waiting state.
- Added English/Chinese story, record, evidence and transition copy. The
  closed lobby remains unchanged while Act III, Act IV and final routes are
  incomplete. Checks: production build, `pnpm check` (972 tests), three
  isolated browsers at 320/390/1280 px through surveillance and the reveal,
  screenshots and layout checks. The local headless Chromium lacks CJK fonts;
  the browser path checks Chinese DOM text, while screenshot glyphs appear as
  boxes in that environment.

## Scenario 03, PHASE 6: founding paradox

- Act III opens round 7 with ZERO's directive, a one-use private ZERO
  transcript, and two visible possible histories. The 1996 prototype core
  supports a validated shutdown. It rederives the 2026 present, removes the
  Power Room from accessible 2026 targets, marks the Administration fading,
  increments the causal revision and adds one Collapse. Preserving the core
  leaves 2026 unchanged. The eight-room topology remains fixed.
- Private founder, staff, prototype, charter and Ji-note investigations
  expose narrower evidence than the official claims. The public projection
  shares only discovered fact IDs and story beats; other players' evidence
  remains private. The round-8 founding paradox and founder discrepancy
  support the round-9 third-route reveal. An acknowledged scene advances to
  Act IV without executing an ending or exposing Archivist 00's identity.
- Added English and Chinese UI and engine text, including a consistent
  Chinese name for Ji Linchuan. Typecheck, production build and `pnpm check`
  passed (976 tests). The three-client browser path passed at 320/390/1280 px
  through ZERO, shutdown and the synchronized third-route scene, with no
  clipped elements or touch targets below 48 px. Screenshots were inspected;
  the isolated Chromium still lacks CJK glyph fonts, so the Chinese browser
  path checks the rendered DOM text. The lobby remains closed pending PHASE 7.

## Scenario 03, PHASE 7: three endings

- Act IV adds validated 1996 decisions for the accident record, staff
  evacuation, Ji Linchuan's official death and the prototype's fate. The
  server recomputes 2026 after each action. Official and true histories
  require both assigned players to place the numbered relic sources.
  No tomorrow instead erases those instances and the Administration.
- The official ending preserves the Administration at a human cost; no
  tomorrow saves everyone but removes it; the true ending preserves the
  public accident while saving staff, hiding the prototype and staging Ji's
  death. Completing the controlled accident restores integrity and removes
  the extra Collapse caused by the prototype shutdown. Only the true route
  reveals Archivist 00 as Ji and his seven-minute
  line. Ending and Results are synchronized and localized.
- Typecheck, production build and `pnpm check` passed (980 tests). A
  three-client browser path at 320/390/1280 px reached the complete
  no-tomorrow ending and Results with no clipped elements or touch targets
  below 48 px. Screenshots were inspected. Isolated Chromium lacks CJK
  fonts, so the Chinese path asserts DOM text. The lobby remains closed for
  later skill and launch phases.

## Scenario 02 hotfix: departure before act 2, and the contest for seats

- **Departure waits for act 2.** `departureStep` opened the boarding vote in act 1, and in the same step forced the capacity reveal, which pushed a CAPACITY scene. The engine settles windows before scenes, so the scene sat on top of the vote: non-voters saw "Board the boat?: 0/1 answered", the scene said "waiting for the others", and the one voter's card was hidden underneath. Now a boat ready in act 1 only logs that boarding starts in Act II; the countdown starts on entering act 2 (`startCountdown`), with the capacity revealed then, a round before boarding. `CityGame` shows a scene only while no decision is open.
- **Pass safeguard** (`scenario02/passes.ts`). On entering act 2 or 3, and when the countdown starts, held passes plus realistically obtainable ones (walking distance on the current map, AP over the rounds left, sources still alive, one per player) must reach `passSupply` (more than seats, never more than players). The office is topped up by the shortfall, only with passes someone can reach in time. The public view adds `passesOut` and `knownPassSources`.
- **Bot:** stops running the pumps once the boat is ready, since pumping keeps the water below 5 and the run stalls.
- **Kept replays:** the scenario 02 runs were regenerated on purpose (the rules changed), and `s02-4p-escaped.json` was added.
- **Browser check:** `scripts/ui-play02-departure.ts`.

## Scenario 02: the generator replaces the gate, scattered start, act-2 deadline, water by table size

- **The gate is gone.** After boarding, the boat leaves when someone still in the city restarts the generator at the power station (`RESTART_GENERATOR`: 1 AP, a roll with Fate, help, abilities and the repair bonus; once per player per round). Success launches it. A failure costs 1 Sanity; a disaster costs 1 Sanity and 1 Collapse; either way the run goes on. Removed: the gate vote, the launch vote, `gatekeeper`, `betrayers` and the Betrayer title, which only the launch vote could earn. The restarter's fate is `ENGINEER`, titled "The Last Engineer". The auto-control chip now starts the boat from the deck at boarding (`autoStart`).
- **Power station:** its generator hall never goes under, and `solvable()` requires it reachable from the pier through Collapse 8. After that the pier and Viaduct are usually an island: whoever stays must get to the station first. The bot now sends players without a seat there when the countdown starts.
- **Those aboard are locked in:** new optional hook `takesTurn` (flow skips them), 0 AP, and a notice instead of the dock. Scenario 01 doesn't define the hook.
- **Scattered start:** `spawnZones()` (seeded) puts each player in a different safe zone: not the pier, dry at the start, above water until act 2, and joined to the pier and the power station at Collapse 6.
- **Act-2 deadline:** a round starting at 6 or later in act 1 brings Collapse to 5 (logged; the pumps can't hold it).
- **Water by table size** (`waterOdds`, d20): expected rise a round 0.60 / 0.80 / 0.85 / 0.90 / 0.95 for 2 / 3–4 / 5–6 / 7–8 / 9–10 players.
- **English plurals** fixed for seats, passes and the office count.
- **Kept replays:** the scenario 02 runs were regenerated on purpose (the rules changed), and an 8-player run was added. Browser check: `scripts/ui-play02-departure.ts` (scattered start → results, with a forced failed restart).

## Scenario 03, PHASE 8: all 192 abilities and ordinary protocols

- Added the Scenario 03 adapter catalog for all 192 existing core skills, with eight setting-dependent descriptions changed into real Administration behavior and matching Chinese names and descriptions. The ordinary scan protocols use the server die and Fate/Sanity outcomes. Seeded public anomalies provide real event targets, and the Scenario 03 UI exposes skill, help and scan actions.
- Resolver tests fire all 192 abilities. Typecheck, build and `pnpm check` passed (984 tests at this phase). A three-client 320/390/1280 px browser path covered abilities, scans and the complete no-tomorrow route; Scenario 01's shared walkthrough also passed.

## Scenario 03, PHASE 9: two-year presentation

- Reworked the eight-room map as a branching building plan: Archives and its rooms to the left of Central Hall, Research Wing and its rooms to the right. Both years use the same room positions. State labels show occupancy, NPCs, access, erasure and Temporal Containment within the Research Wing. A two-column phone layout preserves all eight rooms at 320 px.
- Added a timeline switch, numbered story record, recent 1996 decisions beside the derived 2026 status, a causal revision flash, stronger round-6 and round-9 reveal scenes, and distinct ending treatments. English and Chinese keys cover all new UI text.
- Typecheck, production build, `pnpm check` (1009 tests) and the three-client full no-tomorrow browser path passed at 320/390/1280 px. Screenshots were inspected, including a Chinese 320 px ending; the browser checks found no clipped elements or touch targets under 48 px.

## Scenario 03, PHASE 10: balance probe

- Added `scripts/sim03.ts`, which drives the real engine through validated movement, time jumps, item pickup/source placement, interventions, event responses and ending resolution. It never teleports players or edits game state. Eight distinct deterministic hexadecimal seeds for each of 2, 3, 4, 6 and 10 players and all three routes produced 120/120 intended endings. The official and no-tomorrow routes finished in round 10; the true route finished in round 11, leaving one cycle of slack. True-route actions used roughly 23–27 team AP on average, including 2–5 time jumps, across sizes. This demonstrates the 2-AP jump and 3-AP turns are viable even with two players.
- The scripted team minimizes optional play, so objective idle turns rise with table size (especially 6/10 players). These counts are a warning about how many players the fixed critical path engages, not proof that turns lack actions: anomaly votes, skills, scans, optional investigations and early causal decisions are available. No Shared rule was changed for balance.
- Scenario 01's two-context `pnpm ui:walkthrough` passed. Scenario 02's independent departure walkthrough passed through generator restart and Results. The full `pnpm check` suite includes the Scenario 01/02 regression tests and the ACT_4 boundary test, which verifies neither existing scenario enters a fourth act.

## Scenario 03, PHASE 11: browser walkthrough and public selection

- Extended the browser scripts to run both three and four isolated players at 320, 390 and 1280 px, with Chinese on the 320 px client and English on the others. The full path covers the first jump, a 1996 decision rewriting 2026, the eight-room tree, the round-6 identity scene, the Act III prototype shutdown, the round-9 third-route scene, an ending and Results. The relic path covers 2026 pickup, 1996 source placement, later pickup, consensual transfer and reload. All four paths passed with layout checks for clipping and sub-48 px targets, and screenshots were inspected.
- After the complete paths passed, opened Scenario 03 in the shared lobby registry and added its localized lobby card and start label. Browser scripts now select the 03 tile through the real lobby rather than modifying the test database. The public three/four-player full and relic paths passed again. Scenario 01 and 02 phase transitions remain on their existing three-act rules.
- Character cards and the reveal now request skill type and use count from the selected scenario's adapter, matching their already localized skill name and description. The public lobby's Pisces ENTP reveal, in-game ability and scan path passed. Final `pnpm check` passed (1009 tests); the Scenario 01 walkthrough and Scenario 02 departure/results walkthrough passed after this shared UI adjustment.

## Scenario 03: UI aligned with scenario 02 (no rule changes)

- **Layout:** scenario 03's run now uses scenario 02's layout: top bar, turn banner, objective, map, room panel, players strip and the shared dock, with the log and "Only you know" drawers.
- **Shared extractions from scenario 02:** `RunTopBar`, `ObjectiveLine` and `PlacePanel` (`src/client/game/RunTopBar.tsx`). Optional props: `Dock.extension`, `PlayersStrip.tag`, `SecretsDrawer.sections`, `LogDrawer.title`. Scenario 01 and 02 markup was checked byte-identical before and after (static render of the shared components from fixed states).
- **Scenario 03's own pieces:** `src/client/game/scenario03/`:
  - `Map03`: the tree map; tapping selects a room, Move mode lights the targets;
  - `Panels03`: the top bar, objective and room panel;
  - `dock03`: its action grid and pickers;
  - `Private03`: the drawer's private and public sections.
- **Kept scenario-03 visuals:** the 1996 / 2026 switch, the tree map, the causal ripple, the incident record and causal history styles, and the identity and third-route scenes.
- **Browser check:** `scripts/ui-play03.ts`. The old `scripts/ui-play03-phase*.ts` assert the previous screen's buttons and no longer match it.

## Scenario 03: action dice resolution pass

- Investigate, Intervene, Speak and Search now enter the existing server d6,
  Fate-spend and reaction pipeline after their original AP cost is paid.
  Time Jump rolls for stability only in Acts III–IV at Collapse 6 or above;
  it always reaches the other year in the same room. Temporal Scan keeps its
  separate four-tier Fate economy. Failed action rolls leave evidence, NPC
  opportunities, causal decisions and the once-successful search allowance
  available for another attempt. Only successful interventions run the
  existing causal rewrite, trace and story logic. Perfect Search offers one
  choice between the two existing supplies.
- The selected action target lives in server-only `rollContext` until the
  shared pipeline completes. The shared roll's `done` flag and persisted
  decision windows prevent reconnects and duplicate answers from repeating
  the outcome. Scenario 03 action-roll Fate and reaction windows wait through
  a disconnect; the host can still skip one explicitly. Existing Dice and
  Decision components are reused. The new
  outcome cue and log lines have English and Chinese text; the Scenario 03
  run layout and Scenario 01/02 rules were not changed.
- Checks: `pnpm typecheck`, production build, `pnpm check` (1042 tests), the
  Scenario 03 two-browser walkthrough at 320/1280 and 390/1280 px (including
  a desktop refresh with a pending Fate window), Scenario
  01's two-context walkthrough, and Scenario 02's departure-through-results
  browser walkthrough passed. Scenario 03 screenshots of the new Dice/Fate
  presentation were inspected. The temporary Chromium runtime libraries for
  this WSL host were extracted under `/tmp`, not installed into the system.
- Seeded Scenario 03 simulation: a scripted team that spends Fate to turn
  required rolls into successes reached its intended route in 118/120 runs
  across 2, 3, 4, 6 and 10 players. The two misses were both at two players
  (one no-tomorrow, one true route). The previous 120/120 result preceded
  these action rolls and is no longer the current balance result. No AP,
  Collapse, route or story rule was adjusted to erase this variance.

## Scenario 03: unstable Time Jump temporal lag

- A Time Jump Failure (final 2–3) still arrives and now gives one public,
  persisted `TEMPORAL_LAG` status. It reduces AP by 1 in the next cycle, with
  a floor of 1, and expires at that cycle's end. Repeated failures in one
  cycle do not stack; a new failure during the affected cycle schedules the
  following cycle. Disaster, Success and Perfect keep their existing effects.
- The player sheet distinguishes pending and active lag in English and
  Chinese. The Time Jump outcome cue distinguishes Disaster from Failure.
- Checks: `pnpm check` (1045 tests), production build, Scenario 03's
  two-browser five-cycle walkthrough at 320/1280 px, and a focused browser
  save/reconnect check showing lag in the player sheet at 320/1280 px.

## Scenario 03: Temporal Scan protocols and Time Jump cue

- Standardized Scan's base die outcome with the other Scenario 03 actions:
  Disaster loses 1 Sanity, Failure and Success have no base resource change,
  and Perfect gains 1 Fate. The three protocols add an effect on Success or
  Perfect without altering any other action dice.
- Archive now stores an owner-only unresolved investigation direction: room
  and year on Success, plus the investigation name on Perfect. It awards no
  evidence and explicitly reports when no direction remains. Field Focus
  adds +2 through the shared modifier pipeline to the next eligible rolled
  non-Scan action in this cycle. Temporal Alignment reduces the next safe or
  unstable Time Jump to 1 AP. Both statuses are non-stacking and persist or
  expire according to their rules; Alignment survives save/reconnect.
- Added a brief, localized Time Jump overlay with a reduced-motion path.
  The existing map, story, four-act flow, endings and Scenario 02 layout
  remain unchanged.
- Checks: production build, `pnpm check` (1066 tests before the final
  non-stacking regression), targeted protocol tests (58), Scenario 03
  two-context walkthroughs at 320/1280 and 390/1280 px, and a focused
  two-player browser capture of the Time Jump animation at 320 px.
- The existing scripted route probe (`scripts/sim03.ts --runs 4`) won 59/60
  seeded runs; the one miss was the two-player Deceive History route. This
  script does not choose Temporal Scan, so it verifies route regressions but
  does not measure how the new protocol choices change player strategy.
