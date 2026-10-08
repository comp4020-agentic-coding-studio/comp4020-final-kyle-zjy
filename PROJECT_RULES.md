# Project rules

Rules every scenario must follow, now and later. If a new scenario seems to
need one of them broken, stop and ask; don't work around it.
For the current code, see `CODEX_HANDOFF.md`. Agent working rules are in
`CLAUDE.md`.

## Product

- **Fate Instance:** a real-time, browser-based party game for **2–10 players**
  (`MIN_PLAYERS` / `MAX_PLAYERS` in `src/shared/protocol.ts`).
- **One room plays one scenario at a time.** The host picks the scenario in the lobby.
- **Every player is one of 192 characters:** 12 zodiac signs × 16 MBTI types.
  The characters belong to the whole game, not to any one scenario.
- **Scenarios differ in rules, map and goals.** The engine, characters, dice,
  abilities, decisions, log, rooms and UI shell are shared.

## Rooms and realtime

- **The server is authoritative.** Clients send intents (`GameAction`,
  `LobbyAction`), never values: no client-sent dice, Fate, phase, round,
  position or outcome.
- **One action at a time per room:** every action is validate → reduce →
  persist (one SQLite transaction) → broadcast.
- **Stale clicks are refused.** A turn action sent from an older view than
  the active turn's is refused (`STALE_VERSION`).
- **All randomness comes from the seeded generator in the game state.** Every
  run replays exactly from its seed and action log.
- **Hidden information is removed by the server's projection (`project()`)
  before anything is sent.** Never send it and hide it in the UI.
- **Reconnecting resumes the same seat.** A player who drops keeps their turn
  for a short grace period. Nothing waits on a countdown for a connected
  player; the host can move a stalled table along (host skip).
- **One Node process, SQLite on `/data`, 256 MB.** No external database or
  service (`fly.toml`, `spec/README.md`).

## Rounds and actions

- **Each round:** round start → each player's turn in seat order → the
  world's step → one round event → round end.
- **Turn actions cost action points (AP).** Free actions (abilities, items,
  some trades) cost 0.
- **AP are refilled each round**, by the scenario's `apFor` (the default is 2).
  A player in the lost state gets 1.
- **A roll:** d6 + modifiers, then the Fate window (at most 2 Fate per roll),
  then reactions. The result is judged on the final total:
  - 1 Disaster
  - 2–3 Failure
  - 4–5 Success
  - 6 Perfect
- **Core resources:**
  - **Fate:** spent to raise rolls; ability costs and rewards; tradeable.
  - **Sanity:** 0–3. At 0 a player is **lost**.
  - **Collapse:** 0 → 12. At 12 the shared failure is reached.
  - **AP:** see above.
  A scenario may re-skin these, but must not replace them.

## No early elimination

- **Nobody is knocked out.** Sanity 0 means **lost** (1 AP), not removed;
  lost players recover by regaining Sanity.
- **No player-killing or direct player-vs-player attack actions.** Friction
  comes from trades, withheld information, limited resources and choices.
- **A run may end differently for different players** (scenario 02's
  per-player escape). Every player still plays until the run ends.

## Characters and abilities

- **The roster:** 192 characters in `src/shared/characters/roster/<zodiac>.ts`,
  16 per sign in canonical MBTI order. A character is `{ id, zodiac, mbti,
  nickname, avatar, coreSkillId, visual }` and nothing about any scenario.
- **Each character's ability:**
  - **Core skill** (`src/shared/skills/core/`): the mechanics only. A trigger,
    a target rule and `Effect` primitives; no names, no scenario words.
  - **Scenario adapter** (`src/shared/game/scenarioNN/skill-adapters*`): the
    name, the description, the visual, and only rarely a `behaviour` that
    replaces part of the mechanics, when the scenario's own rules must take part.
  - **Lookup:** always through `characterSkill(id, scenarioId)`
    (`src/shared/game/skills.ts`).
- **No per-character code.** If an ability can't be expressed, extend the
  `Effect` primitives (`src/shared/game/effects.ts`).
- **Every ability is once per run** (`maxUses: 1`). Types:
  - **ACTIVE:** used on your turn.
  - **REACTION:** you are asked when it triggers.
  - **PASSIVE:** fires by itself, and only if it is a pure gain with no reason
    to save it.
- **The player-facing description is the truth.** It must match what the
  effects do. Re-wording for a scenario is allowed only when the original
  depends on a mechanism the scenario lacks. Record it in
  `docs/skill-mapping-notes.md`.
- **Portraits come from the generator.** The 192 files are written by
  `scripts/avatars/portrait.ts` (`pnpm avatars`). Never edit an SVG by hand.

## Shared vs scenario-specific

- **Shared** (one copy; a scenario uses it through hooks):
  - the engine flow, actions framework, dice, Fate window, reactions,
    decision windows, abilities, effects, statuses, log, projection,
    persistence, rooms and realtime;
  - the client shell: dock, decision cards, dice, cue feed, drawers, players
    strip, lobby.
- **Scenario-specific** (its own folders):
  - content: map or locations, items, events, NPCs, text;
  - rules hooks: creation, actions, world step, Collapse, act changes, end
    check, results;
  - skill adapters, its map component and its screens.
- **Scenario rules plug in by registering** a `ScenarioRules` object
  (`src/server/engine/scenario.ts`). Don't add `if (scenarioId === …)` checks
  to shared code; add or use a hook.

## Rules a single scenario must not change

- **Engine:** the server-authoritative action pipeline, seeded randomness,
  replay determinism and the projection of hidden information.
- **Players and characters:** the 2–10 player range, the character roster,
  core skills and the once-per-run rule.
- **Resources and dice:** the meaning of Fate, Sanity (0–3), the lost state,
  Collapse 0–12 and the roll tiers.
- **Endings:** no elimination and no direct PvP attacks.
- **Every existing scenario must keep playing as before.** Its kept
  simulation logs (`docs/simulations/`) must replay exactly unless a
  deliberate rule change regenerates them, recorded in `docs/build-log.md`.

## Languages

- **Locales:** English (`en`) is canonical and the default; Simplified
  Chinese (`zh-CN`) must cover everything.
- **All player-facing text goes through the localization layer.** No
  hard-coded English or Chinese in components or engine output.
  - **UI copy:** catalog keys (`src/client/i18n/`).
  - **Engine output:** a `Msg` built with `` m`…` `` / `ref.*` / `list()`.
    Never send a sentence, and never join English fragments: give each
    variant its own whole template.
  - **Content:** keyed by id. English comes from the data; Chinese lives in
    `src/shared/i18n/zh-CN/`.
- **The language is chosen per browser** and is locked while a run is in
  progress.
- **Code, comments, commit messages and docs are in English.**

## Mobile and visuals

- **Mobile first.** No horizontal page overflow at 320 px; wide content
  (maps, trains) scrolls inside its own frame.
- **Touch targets are at least 48 px.** Don't override `.btn`'s minimum.
- **State is never shown by colour alone.** Also give text (`READY`, `7 / 12`).
- **Visual direction:** the dark night palette and the tokens in
  `src/client/styles/tokens.css`. The display font needs lining numerals
  (already global).
- **Custom CSS goes in `@layer components`.** Unlayered CSS overrides Tailwind.
- **Check UI changes in a real browser** at 390 and 1280 px (two contexts),
  plus a 320 px layout check.

## What a new scenario reuses

Use these as they are; extend them only through hooks:
- **Engine:**
  - flow (`flow.ts`);
  - the action framework (`Spec`, `turnGate`, `fail`, `USE_SKILL`, `END_TURN`,
    `STABILIZE`, `helped`);
  - dice and Fate (`startRoll`, `onRollOutcome`);
  - decisions (`openWindow`, `onResume`);
  - effects (`applyEffects`, `registerHandler`);
  - player primitives (`gainFate`, `loseSanity`, …);
  - rewards (`measureRewards`), the round-event mechanism (`round-events.ts`)
    and the Skill Resolver;
  - the shared `TRADE` window pattern.
- **Server:** rooms, persistence, runner, projection.
- **Client:** dock, decision layer, dice overlay, cue feed, drawers, players
  strip, sequence overlay, lobby, the results-screen pattern.
- **i18n:** the i18n layer and its tests; the bot and simulator pattern
  (`test/bot*.ts`, `scripts/sim.ts`).
