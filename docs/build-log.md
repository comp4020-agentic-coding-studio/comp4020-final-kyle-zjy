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
