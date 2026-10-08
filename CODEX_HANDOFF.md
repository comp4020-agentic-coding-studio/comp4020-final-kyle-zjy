# Codex handoff: the state of the code (for Scenario 03)

This file is about the code as it is now. The rules every scenario must keep
are in `PROJECT_RULES.md`; the agent working rules are in `CLAUDE.md`.

## Current Scenario 03 status

PHASE 0–11 are complete. Scenario 03 is public in the lobby and supports
2–10 players, two years in one eight-room building, a 12-cycle/four-act
loop, all 192 adapted Core Skills, the round-6 and round-9 reveals, numbered
bootstrap relics and three endings. `src/server/engine/scenario03/` holds its
rules; `src/shared/game/scenario03/` holds content; `Scenario03Screens.tsx`
renders the run. The historical implementation notes below describe earlier
development boundaries; the current status is in
`docs/scenario03-technical-design.md` and `docs/build-log.md`.

Final verification: `pnpm check` (1009 tests), production build, 120
real-action balance runs across 2/3/4/6/10 players and all three routes,
and 3/4-player browser paths at 320/390/1280 px in English and Chinese.
The browser scripts select Scenario 03 through the normal lobby. Scenario
01 and 02 browser regressions also passed. For readable Chinese screenshots
in this WSL environment, point `FONTCONFIG_FILE` to a fontconfig file using
the Windows CJK fonts; this is a test-host setting, not an app dependency.

Design docs:
- `docs/architecture.md`: structure, and the scenario and skill layers (§14b, §15).
- `docs/game-state.md`: scenario 01's state machine.
- `docs/localization.md`: the i18n layers and both glossaries.
- `docs/skill-mapping-notes.md`: how each scenario re-words abilities.
- `docs/simulation-report.md`: balance.
- `docs/build-log.md`: decisions, in order.

## 1. Stack

- **Server:** Node 24 runs `.ts` directly, so only erasable syntax: no enums,
  namespaces or parameter properties, and imports end in `.ts`.
- **Web:** Hono for HTTP and `ws` for WebSockets, in one process (`src/server/index.ts`).
- **Database:** SQLite through `node:sqlite` in `DATA_DIR`; `/data` on Fly.
  Migrations are in `src/server/db/migrations/`.
- **Client:** Vite, React 19, Tailwind v4, zustand (`src/client/store.ts`),
  `motion/react`. Served as static files by the same process.
- **Tests:** Vitest with two projects. `unit` is `test/`, pure. `spec` is
  `spec/`, run against a running app at `APP_URL`, default `localhost:8080`.
- **Browser checks:** Playwright scripts in `scripts/`.
- **Deploy:** one Fly machine with 256 MB (`fly.toml`). CI runs `pnpm check`
  in a container, then deploys when `main` is pushed.

### Commands

| What | Command |
| --- | --- |
| typecheck | `pnpm typecheck` |
| unit tests | `pnpm test:unit` |
| everything | `pnpm check` (typecheck + unit + spec; start the app first) |
| build / run | `pnpm build && pnpm start` (or `NODE_ENV=production DATA_DIR=./data PORT=8080 node src/server/index.ts`) |
| simulate | `node scripts/sim.ts [--runs 40] [--players 2,6,10] [--logs dir]`; `--scenario 02` for the city; `--coverage 8` for ability use |
| scenario 03 balance | `node scripts/sim03.ts --runs 8` (five player counts × three endings) |
| browser, scenario 01 | `node scripts/ui-play.ts --until act2\|act3\|end --phone 390\|320` |
| browser, scenario 02 | `node scripts/ui-play02.ts --phone 390\|320` (lobby → results → back to the lobby) |
| browser, scenario 03 | `S03_PLAYERS=3\|4 node scripts/ui-play03-phase7.ts` (lobby → Results); `S03_PLAYERS=3\|4 node scripts/ui-play03-phase3.ts` (relic loop) |
| full walkthrough | `pnpm ui:walkthrough` |
| portraits | `pnpm avatars` |

Every Playwright script fails when it finds content clipped past the right
edge or a touch target under 48 px (`scripts/lib/layout-check.ts`).

### Local environment notes

- **Node:** `export PATH=$HOME/.local/share/mise/installs/node/24.21.0/bin:$PATH`.
- **Playwright:** needs `LD_LIBRARY_PATH=$HOME/.cache/fate-browser-libs/root/usr/lib/x86_64-linux-gnu`.
  The headless Chromium has no CJK font, so Chinese shows as boxes in
  screenshots. Check the DOM text instead.
- **Stopping the server:** use its PID file. Never `pkill -f` with the node
  command line: it also matches and kills the shell running it.

## 2. Directories

```
src/shared/            imported by server and client
  characters/          types.ts, roster/<zodiac>.ts (×12) + index.ts, signs.ts, validate.ts
  skills/              core/ (20 family files, 192 core skills), types.ts (adapters, SkillVfx), resolver.ts
  game/
    state.ts           GameState, PlayerView, every shared type (incl. CityState for scenario 02)
    actions.ts         GameAction / LobbyAction unions, AP_COST, TradeOffer
    effects.ts         the Effect union + EFFECT_KINDS (compile-time guard)
    scenarios.ts       SCENARIOS registry (id, number, open in lobby)
    skills.ts          characterSkill(id, scenarioId): the only way to read an ability
    events.ts          EVENT_BY_ID over all scenarios; eventsFor(scenarioId)
    scenario01/        content.ts, events.ts, statuses.ts, skill-adapters/, skills.ts
    scenario02/        map.ts, items.ts, npcs.ts, events.ts, skill-adapters.ts, skills.ts
  i18n/                types.ts (Msg), msg.ts (m, ref, list), format.ts, content.ts, content-types.ts,
                       en.ts, scenario02.ts, zh-CN/{scenario,scenario02,messages,skills02}.ts, zh-CN/characters/
  protocol.ts          ClientMessage / ServerMessage, MIN/MAX_PLAYERS
src/server/
  engine/              pure: state + input + time → state + cues
    scenario.ts        ScenarioRules interface + registry (rulesFor)
    scenario01/rules.ts, scenario02/{rules,create,city,actions,boat,events}.ts
  game/                runner.ts (serialised apply + persist + timers), store.ts (sessions)
  rooms/               service.ts (lobby actions, START_GAME), hub.ts (WebSocket fan-out)
  db/                  db.ts, migrations/
src/client/
  screens/             RoomGate (phase → screen), Lobby, Intro, Game (train), CityGame, CityScreens, Ending, Results
  game/                shared run UI (Dock, Decision, Dice, CueFeed, Sequence, drawers, PlayersStrip, EventPanel)
                       + scenario 01 (Train, CarriageInfo, TopBar, Objective) + city/ (HexCityMap, ZonePanel, CityTopBar)
  i18n/                en.ts, zh-CN.ts (shared + scenario 01 UI), s2-en.ts, s2-zh-CN.ts, index.ts (t, hooks), types.ts
test/                  unit tests, helpers.ts (scenario 01 Table), bot.ts / bot02.ts (simulated teams)
spec/                  tests against the running app (invariants.test.ts must never be deleted)
scripts/               sim.ts, ui-play*.ts, i18n/message-keys.ts, lib/layout-check.ts, avatars/
docs/simulations/      kept runs replayed by test/simulations.test.ts (scenario 01 + s02-*.json)
```

## 3. How a scenario plugs in

`src/server/engine/scenario.ts` defines `ScenarioRules`. Each scenario
registers one object with `registerScenario`, and the shared engine calls it
through `rulesFor(state)`:

| Hook | Called from | Scenario 01 | Scenario 02 |
| --- | --- | --- | --- |
| `create(sessionId, seats, seed, now)` | `createGame` | `createScenario01` | `createScenario02` |
| `actions` (`{specs, turnActions, apCost}`) | `applyAction`, `availableActions`, runner | `S01_ACTIONS` | `s02Actions()` |
| `itemPools` | `grantItem` (GRANT_ITEM) | S01 items | S02 items |
| `roundOpens?` / `roundHeader` / `apFor` / `playerRoundStart?` / `onRoundStart` | `flow.beginRound` | escape reset, Void Hour, beats | facility crew reset |
| `afterTurns` | after the last turn | `INSPECTOR` (act ≥ 2) or `ROUND_EVENT` | `WORLD` |
| `worldStep` | `INSPECTOR` / `WORLD` step | Inspector moves | departure (boat) |
| `roundEvent` | `ROUND_EVENT` step | scripted beat or deck | deck |
| `roundCloses?` / `roundCollapse` / `afterRound` | `flow.endRound` | +1 per round, act changes by round, round 12 limit | variable rise, hold and surge |
| `collapseChanged?` | `changeCollapse` (any cause) | (none) | flood the map, act by Collapse, capacity reveal, lost part |
| `movePlayer?` | MOVE_PLAYER effect | (none: train adjacency) | one walkable hex step |
| `takesTurn?` | `flow.nextTurn` | (none: everyone plays) | not once aboard the boat |
| `checkEnd` | `advance` and `endRound` | escape locks / Collapse / all lost | Collapse 12 (the boat not gone) |
| `results?` / `announceEnding?` | `startEnding` | `computeResults` / ending text | per-player escape results |
| `runJob` | job queue | ticket checks, echo strikes | (none) |

Registration happens in `src/server/engine/create.ts`, which imports
`./scenario01/rules.ts` and `./scenario02/rules.ts`. Every run is created
there, so the rules are always registered. **Add `./scenario03/rules.ts` there.**

## 4. Scenario 01 (00:17, the last train)

- **Linear carriages** (`GameState.carriages`); `PlayerGameState.carriageIndex`
  is the player's carriage.
- **Acts by round:** 1–3, 4–7, 8–12.
- **Act 1:** find memory fragments. **Act 2:** repair three anchors, each
  giving a key item (POWER/IDENTITY/MEMORY_KEY). **Act 3:** carry the keys to
  three escape locks, all in the same round.
- **Threats:** the Faceless Inspector (ticket checks: a final 1–3 empties
  Sanity) and echoes.
- **Scripted beats** (`beats.ts`):
  - R4: the Inspector appears and seat neighbours are drawn;
  - R5: secret messages (always true);
  - R6: the brake vote;
  - R7: the Reality Fold (a derangement of the middle carriages);
  - R8: echoes.
- **Night rules and obsessions** are scenario 01 only (`nightRule` and
  `obsession` are null elsewhere).
- **Its logic lives in:** `outcomes.ts`, `inspector.ts`, `beats.ts`,
  `ending.ts`, the S01 specs in `actions.ts`, and `create.ts`
  (`createScenario01`). `scenario01/rules.ts` only points the hooks at them.

## 5. Scenario 02 (the sunken city)

- **Map** (`shared/game/scenario02/map.ts`): 31 hexes in axial coordinates;
  `ADJACENT` is derived and `FRAGILE` lists tunnels and low bridges.
  `carriageIndex` is the player's **zone index**.
- **`CityState`** (`GameState.city`):
  - `zones` and `edges`; the server-only fields are `floodAt`, `sinkAt`,
    `caches` and `breakAt`;
  - `facilities`: POWER_STATION, PUMP_STATION, HARBOUR_GATE, each with
    progress, workers this round and contributors;
  - `boat`: capacity, revealed, installed, battery power, auto start (the
    chip), ready round, aboard, engineer (who restarted the generator),
    launched;
  - `passSources` (server only), `holdings` (parts and passes per player),
    `npcs`, `contrib`, `rescues`, `shared` (shared intel), `hold`, `surge`.
- **What players see** (`scenario02/city.ts publicCity`): the schedule and
  caches are hidden. Each zone gets `warning` (it goes under at the next
  rise). A player sees only their own parts and passes; others get a part
  count. Capacity is null until revealed. `officePasses` appears from act 2.
- **Flood** (`city.ts`):
  - the seeded schedule is set by height;
  - `solvable()` checks reachability **against the schedule**: part zones
    stay up until Collapse 9 and are reachable at 6; the pier is reachable at
    8 from the start and at 10 from high ground; the power station (raised:
    it never goes under) is reachable from the pier through 8;
  - `spawnZones()` scatters players at the start: a different safe zone each,
    never the pier, not cut off;
  - `generateCity()` redraws until the check passes, with `safeCity()` as the
    fallback;
  - `applyFlood()` runs on every Collapse change: zones only get worse;
    stranded players are moved; unrescued NPCs drown.
- **Actions** (`scenario02/actions.ts`): MOVE (wading, rafts), SEARCH,
  INVESTIGATE (private intel), REPAIR (crew bonus), OPERATE, RESCUE, SALVAGE,
  HELP, STABILIZE, TRADE (0 AP, parts and passes, the other side checked on
  accept), SHARE_INTEL, INSTALL, REGISTER, RESTART_GENERATOR. Each roll has
  its own `S2_*` RollPurpose.
- **The boat** (`scenario02/boat.ts`):
  - five conditions;
  - capacity revealed on first sight in act 2, or at Collapse 7;
  - passes always outnumber seats;
  - departure only from act 2: a BOARD vote each round from the round after
    the countdown; those aboard are locked in (`takesTurn` → no turns, 0 AP);
    then someone left in the city restarts the generator at the power station
    (a retryable roll); success launches the boat (the chip launches it at
    boarding);
  - per-player `escape` fate (ESCAPED / ENGINEER / LEFT_BEHIND / DROWNED) and
    titles ("The Last Engineer" for the restart).
- **Events** (`shared/game/scenario02/events.ts`, handler in
  `engine/scenario02/events.ts`): the `CITY_EVENT` effect kind.
- **Rules** (`scenario02/rules.ts`):
  - 3 AP a round;
  - the rise is 0 / 1 / 2 with odds by table size (`waterOdds`: expected
    0.60 at 2 players up to 0.95 at 9–10), plus surge, minus hold;
  - acts by Collapse: 1 below 5, 2 from 5 to 8, 3 from 9; a round starting at
    6 or later still in act 1 brings the water to 5 (`act2Deadline`).
- **Client:** `screens/CityGame.tsx`, `screens/CityScreens.tsx` (intro,
  ending, results), `game/city/*`. The Dock uses `GRID02` and its city
  pickers when `g.city` is set.

## 6. What both scenarios share, and how

- **Node index:** `PlayerGameState.carriageIndex` is the player's node (a
  carriage or a zone), so HELP, TRADE, SAME_CARRIAGE targets, `sameCarriage`
  and the dice's `RollContext.carriageIndex` all work unchanged.
- **Actions:** each scenario has its own Spec map. The shared specs
  (`USE_SKILL`, `END_TURN`, `STABILIZE`, the `helped` bookkeeping, `fail`,
  `Spec`) are exported from `actions.ts`.
- **Rolls:** `startRoll(ctx, p, purpose, label, rc, { extra })` opens the Fate
  window and reactions; `onRollOutcome(purpose, fn)` resolves the final tier.
- **Decisions:** `openWindow({ kind, title, prompt, addressees, options,
  defaultOptionId, resume: { kind, payload } })` and `onResume(kind, fn)`.
  Use the existing `WindowKind`s (VOTE for a group decision); the client
  renders them generically.
- **Events:** `round-events.ts` draws from `eventsFor(s.scenarioId)`. Card ids
  must be unique across scenarios (scenario 02 prefixes them with `S2_`).
- **Rewards:** wrap gains in `measureRewards(ctx, pool, label, fn)` so
  reward-triggered abilities work. Key items are excluded on purpose.
- **Abilities and cues:** the Skill Resolver and ability VFX cues come for
  free once `characterSkill(id, scenarioId)` resolves.
- **Results:** the per-player `PlayerResult`, with the optional `escape` field.

## 7. GameState (`src/shared/game/state.ts`)

- **Shared:**
  - run: `sessionId`, `scenarioId`, `phase` (LOBBY / INTRO / ACT_1–3 /
    ENDING / RESULTS), `version`, `turnVersion`, `seed`, `rng`, `rngCalls`,
    `config`;
  - rounds: `round`, `act`, `step` (ROUND_START / PLAYER_TURNS / INSPECTOR /
    WORLD / ROUND_EVENT / ROUND_END), `turnOrder`, `activeIndex`,
    `turnDeadline`, `collapse`, `collapseMax`;
  - events and abilities: `eventDeck`, `currentEvent`, `delayed`, `bonds`,
    `ruleMods`;
  - players: `players`, `secrets` (owner-only: `peeks`, `messages`,
    `dreamCards`, `tasks`, `allies`, `obsession`);
  - in flight: `pending` (windows), `roll`, `rollContext`, `pendingEffect`,
    `triggerQueue`, `lastSkill`, `roundRecord`, `jobs`, `sequence`;
  - other: `flags`, `outcome`, `failReason`, `results`, `log`, `logSeq`.
- **Scenario 01 fields, inert in other scenarios:** `carriages`, `anchors`,
  `fragments`, `coreMemories`, `inspector`, `entities`, `seatNeighbours`,
  `escape`, `nightRule` (nullable), `endingChoice`.
- **Scenario 02:** `city: CityState | null`.
- **What players are sent:** `PlayerView` from `engine/project.ts`, which
  removes secrets, the seed and generator state, the deck, roll context,
  parked effects, jobs, triggers and the round record. It hides other
  players' hidden statuses, filters secret bonds, and replaces `city` with
  `publicCity(s, viewerId)`.

## 8. Actions, effects, flow

- **`applyAction` (`engine/actions.ts`):**
  - RESPOND and ACK_SEQUENCE are handled first;
  - otherwise `turnGate` (phase, scene, blocking window, active player, AP),
    then `spec.check`, then pay AP, then `spec.apply`;
  - `availableActions` builds each button's enabled state, reason, targets
    and hint from the same checks, so the client never re-implements rules.
- **Effects (`engine/effects.ts`):**
  - `applyEffects(ctx, effects, scope)` dispatches to handlers registered
    with `registerHandler(kind, fn)`;
  - handlers live in `effects.ts`, `skill-effects.ts`, `event-effects.ts`,
    `inspector.ts` and `scenario02/events.ts`;
  - a new effect kind must be added to the `Effect` union **and**
    `EFFECT_KINDS`; the compile-time guard enforces it.
- **Flow (`engine/flow.ts`):**
  - `advance()` loops until the engine has to wait: windows, then the roll,
    the parked effect, event reveal, `checkEnd`, tasks, triggers, jobs, the
    scene, the phase, then `stepOnce`;
  - `beginRound` / `endRound` call the scenario hooks in a fixed order.
    **The order matters for replay determinism** (generator calls).
- **Engine entry points (`engine/engine.ts`):** `applyGameAction`,
  `tickGame`, `setAway`, `hostSkip`, `startGame`. Each is `run(state → clone
  → body → version++)`.

## 9. Characters and abilities

- **Roster entries:** `entry(mbti, title, coreSkillId)`.
- **Core skills:** `CORE_SKILLS[id]`, each `{ id, category, type, maxUses: 1,
  copyable, tags, trigger, target, effects, requires?, count? }`. 20
  categories (`CORE_SKILL_CATEGORIES`); ids look like `RETALIATE_04`.
- **Resolver:** `resolveSkill(core, set)` merges the core skill with the
  scenario's adapter `{ name, description, vfx?, behaviour? }`; `skillTable`
  builds all 192 and throws on a missing adapter.
- **Scenario sets:**
  - scenario 01: `SCENARIO01_SKILLS` (`scenario01/skill-adapters/<zodiac>.ts`
    plus `index.ts` with `vfxByCategory`);
  - scenario 02: `SCENARIO02_SKILLS = { ...scenario 01 adapters, ...overrides }`,
    with the overrides in `scenario02/skill-adapters.ts` (`S02_SKILL_TEXT`,
    six abilities).
- **Lookup:** `src/shared/game/skills.ts` maps `ScenarioId` to a table.
  **Add scenario 03's table there.**
- **Ability text** goes through `characterText(locale, id, scenarioId)`
  (`shared/i18n/content.ts`). In engine messages, write
  `ref.skill(id, ctx.s.scenarioId)` / `ref.skillDescription(id, …)` so the
  log uses the run's wording. On the client, `useCharacterText()` reads the
  scenario from the store.

### Using a scenario skill adapter correctly

1. **Reuse first:** start from scenario 01's adapters (`{ ...SCENARIO01_SKILLS.adapters }`).
2. **Find what needs work** with a regex over the resolved names and
   descriptions; the test in `test/scenario02-events-skills.test.ts` does
   this. Re-word only abilities that name another scenario's things.
3. **Mechanics that read scenario state** need a scenario hook or a
   `behaviour` override:
   - MOVE_PLAYER → the `movePlayer` hook;
   - SAME_CARRIAGE → automatic through `carriageIndex`;
   - event-deck effects → automatic once the scenario has a deck;
   - SET_TASK goals → `taskProgress` in `event-effects.ts`;
   - GRANT_ITEM → `itemPools`;
   - the three-kinds-of-roll passive → `KIND_BIT` in `dice.ts`.
4. **Record** every re-wording in `docs/skill-mapping-notes.md`, and add the
   Chinese wording (as scenario 02 did in `zh-CN/skills02.ts`).
5. **Test:** all 192 resolve, no foreign words, unique names, and all 192
   fire cleanly in a run of the new scenario (copy the `it.each(ROSTER)`
   block).

## 10. Realtime

- **Client → server:** `HELLO` / `LOBBY_ACTION` / `GAME_ACTION` (with
  `actionId` and `stateVersion`) / `PING`.
- **Server → client:** `WELCOME` / `STATE` (a snapshot plus cues) / `ACK` /
  `REJECTED` (`code` plus a `msg` Msg) / `SESSION_REPLACED` / `KICKED` /
  `ROOM_CLOSED`.
- **`rooms/hub.ts`** holds the sockets and sends each player their own
  `project()` view.
- **`game/runner.ts`** applies inputs synchronously, one at a time (single
  thread), and persists each in one transaction (`GameStore.save` writes the
  action log and the snapshot). It keeps one timer per room for the next
  deadline and refuses `STALE_VERSION` for turn actions sent from before the
  current turn.
- **Presence:** `setAway` gives a dropped active player a 15 s grace
  (`awayTurnSeconds`). There is no countdown for connected players; the host
  can skip (`SKIP_WAITING` → `hostSkip`).
- **Lobby:** `SELECT_SCENARIO` (host only, `SCENARIOS[id].open`) sets
  `rooms.scenario_id`. `START_GAME` creates the run with the room's scenario.

## 11. i18n

- **Engine text:** a `Msg` built with `` m`template ${p}` `` (the English
  template is the key), `ref.kind(id…)` for content, and `list([...])`. The
  server keeps an English copy on log lines. `format(locale, msg)` renders
  on the client.
- **Chinese engine text:** `zh-CN/messages.ts`, one flat table.
  `scripts/i18n/message-keys.ts` finds every `` m`…` `` in `src/` by AST, so
  **templates must be literal** (not built from variables).
- **Content:** English comes from the data (`en.ts` for scenario 01,
  `scenario02.ts` for scenario 02); Chinese is in `zh-CN/scenario.ts` and
  `zh-CN/scenario02.ts`.
- **Reference kinds:** `format.ts` `content()` resolves each `ref` kind.
  Add new kinds there: scenario 02 added `zone`, `part`, `npc` and `goal02`,
  and falls back to its table for `item`, `status` and `event*`.
- **UI copy:** `client/i18n/en.ts` and `zh-CN.ts` (typed `Catalog`), plus
  scenario 02's `s2-en.ts` and `s2-zh-CN.ts` (typed `Record<S2Key, string>`),
  merged in `index.ts` `CATALOGS`. Hooks: `useT`, `useFormat`,
  `useScenarioText`, `useScenario02Text`, `useItemText`, `useCharacterText`.
- **`test/localization.test.ts` fails on:**
  - a zh key missing for any `m` template;
  - catalog key or placeholder mismatches (both scenario catalogs);
  - missing scenario 01 or 02 content ids;
  - ability numbers that differ between languages;
  - English left in a Chinese render of any kept simulation;
  - an obsession reference leaking into another player's view.

## 12. UI and visuals

- **Routing:** `RoomGate` picks the screen by phase, and the `Run` component
  picks `Game` or `CityGame` by `scenarioId`. Intro, Ending and Results branch
  on `g.city` (scenario 02 screens are in `CityScreens.tsx`).
- **Shared components:**
  - `Dock` (action grid + pickers; chooses its grid by scenario);
  - `DecisionLayer` (all windows);
  - `DiceOverlay`, `CueFeed` (cue kind → icon, text, tone);
  - `SequenceOverlay` (scenes keyed by `sequence.kind`, with scenario 02
    keys under `s2.scene.*`);
  - `LogDrawer`, `SecretsDrawer` (branches on `g.city`), `PlayersStrip`,
    `EventPanel` (art from `EventArt.tsx` `SCENES`), `HostSkip`, `Icon`
    (`PATHS` keyed by action type).
- **Tokens:** `styles/tokens.css`; Tailwind classes such as `btn`,
  `btn-gold`, `btn-ghost`, `tarot`, `glass`, `label`, `night-sky`.
- **Rules:** 48 px touch targets; maps scroll in their own frame
  (`min-w-[360px]`); text never by colour alone; no emoji glyphs (missing
  fonts render boxes; use plain Unicode marks or SVG).

## 13. Known technical debt

- **State:** scenario 01's fields stay on `GameState` as inert values for
  other scenarios. A real split would touch hundreds of lines.
- **Closed unions:** `RollPurpose`, `WindowKind`, `Sequence.kind`,
  `ItemId` (= `S01ItemId | S02ItemId`), `Outcome` and `FailReason` must be
  extended for every scenario.
- **Global registries:** `onRollOutcome` and `registerHandler` are keyed per
  purpose and effect kind, so a scenario uses its own purposes (`S2_*`) and
  kinds (`CITY_EVENT`).
- **Scenario-02 checks in shared code:** `taskProgress`, `SecretsDrawer`,
  `Dock` and `format.ts` branch on `ctx.s.city` / `g.city` in a few places.
  Keep these small, and prefer hooks for scenario 03.
- **Test fixtures:** `test/helpers.ts` (`Table`, `newRun`) is scenario 01
  only; scenario 02 tests build their own fixtures.
- **Scenario 02 balance:**
  - with 3 AP and the slower water, runs usually end before act 2 (the boat
    is ready at Collapse 3–4);
  - 2-player tables are capped at 50% escapes;
  - see `docs/simulation-report.md` and the end of `docs/build-log.md`.
- **The main client bundle is about 560 kB.** Content for all scenarios and
  locales is bundled.

## 14. High-risk shared files: change only through a hook

`src/server/engine/{flow,actions,dice,effects,resolver,skills,windows,round-events,project,engine,create,intercept,rewards}.ts`,
`src/server/game/runner.ts`, `src/server/rooms/{service,hub}.ts`, `src/shared/game/{state,actions,effects}.ts`,
`src/shared/skills/**`, `src/shared/characters/**`, `src/shared/i18n/{format,msg,content}.ts`,
`src/client/game/{Dock,Decision,Dice,Sequence,CueFeed}.tsx`, `src/client/store.ts`.

- **Engine order:** a change to the order of engine calls breaks scenario 01
  and 02 replays (`test/simulations.test.ts`).
- **Checking after a shared change:** run `pnpm test:unit`, then both
  browser scripts.

## 15. Adding Scenario 03: suggested files

```
src/shared/game/scenario03/
  content.ts            ids, names, tuning
  items.ts              S03 items (add S03ItemId to ItemId in state.ts)
  events.ts             EVENTS03 (ids prefixed S3_), add to shared/game/events.ts
  skill-adapters.ts     overrides on top of scenario 01's adapters
  skills.ts             SKILLS03 = skillTable(ROSTER, SCENARIO03_SKILLS); add to shared/game/skills.ts
src/server/engine/scenario03/
  create.ts             createScenario03 (copy createScenario02's shape: nightRule null, obsession null, own state)
  rules.ts              registerScenario({...}); import it from engine/create.ts
  actions.ts            s03Actions() built lazily (see pitfalls)
  ...                   world.ts / ending.ts as needed
src/shared/i18n/scenario03.ts       EN text derived from content; zh-CN/scenario03.ts
src/client/i18n/s3-en.ts, s3-zh-CN.ts   (follow the s2 pattern, add to types.ts and index.ts)
src/client/screens/Scenario03Game.tsx (+ intro, ending, results), src/client/game/scenario03/*
test/scenario03-*.test.ts, test/bot03.ts, scripts/ui-play03.ts
docs/simulations/s03-*.json         kept runs (add a "scenario" field)
```

Then:
- add `S03_…` to `ScenarioId` and to `SCENARIOS` (keep `open: false` until
  it is playable end to end);
- add its state under its own field (as `city` is), plus its projection in
  `project.ts`;
- route its screens in `RoomGate` and the branching screens;
- add a lobby card for it in `ScenarioStrip`.

## 16. Pitfalls already hit

- **Import cycles:**
  - `create.ts` → `scenarioNN/rules.ts` → `actions.ts` → `flow.ts` →
    `create.ts`. A `const` read at module load can be undefined (TDZ).
    Register `actions` as a getter and build action sets lazily
    (`s02Actions()`).
  - The unit tests and the real server import in different orders, so only
    `pnpm build && pnpm start` plus the spec tests catch this.
- **Seeds must be hex.** `seedState` parses hex, and `"seed-1"` reads as all
  zeros. Tests use `((i + 1) * 2654435761 >>> 0).toString(16).repeat(4)`.
- **Extra generator draws change everything after them.** A new draw in a
  scenario's `create` changes the first player, which can surface an ability
  window a test didn't answer. Test helpers that play turns must answer
  windows, and pin `eventDeck` when they need a quiet round.
- **Whole-round test loops** that only send END_TURN get stuck on event
  decisions. Answer `pending` windows with their default.
- **Vitest has a 5 s default timeout.** Give whole-run tests an explicit
  budget.
- **Engine messages:**
  - never interpolate an English fragment, ternary word or `.name` into
    `` m`…` ``; write whole templates per variant;
  - a quick check: every substitution in an `` m`…` `` whose type is
    `string` should be a nickname;
  - every new template needs its zh entry, or `localization.test.ts` fails.
- **Decision card:** it shows the current event only while
  `!currentEvent.resolved`. Other votes (like scenario 02's departure) reuse
  VOTE windows.
- **Hidden-information leaks through rejections:** a check that validates
  someone else's hidden holdings at offer time reveals them in the error
  message. Check on accept instead.
- **Card art:** a new event `art` key must be added to the `EventCard["art"]`
  union and drawn in `EventArt.tsx` (`SCENES` is a full `Record`).
- **Layout:** long labels break 320 px layouts (top bars need
  `min-w-0`/`max-w-[30%]` + `truncate`); short Chinese labels can make
  buttons narrower than 48 px (add `min-w-12`).
- **Cues for new events:** `CueFeed` returns null for unknown kinds, so add
  cases for the new scenario's important cues.

## 17. Patterns proven in the first two scenarios

- **Schedule-aware solvability:** draw the world from the seed, check it
  against its own future (not just its start), redraw until it passes, and
  keep a known-safe fallback with a test that it is solvable. Test 1000+
  seeds.
- **Scenario state in one field** (`city`), projected per viewer by one
  function (`publicCity`), with the server-only parts stripped there.
- **Key items kept out of the item list** (`holdings`), so random grants,
  steals, copies and reward doubling never touch them. In scenario 01, key
  items are tagged and filtered (`isKeyItem`).
- **Free trades that only move goods:** no rewards, triggers or
  contribution, and capped per round.
- **One roll purpose per action** (`S2_SEARCH`, …) with an `onRollOutcome`
  handler reading the final tier, so Fate, help and reactions apply for free.
- **Explicit multi-step endings**: a decision window to board, then a
  retryable roll by someone left behind (the generator), with nothing ending
  on a single failure.
- **A bot plus the simulator for balance**, with kept logs replayed in
  tests: rule changes show up as replay failures and must be regenerated on
  purpose.
- **English first, then zh, with a temporary allowance in the localization
  test** that is removed at the end (as done for scenario 02).
- **A browser script per scenario** that plays to the results and fails on
  layout problems.
