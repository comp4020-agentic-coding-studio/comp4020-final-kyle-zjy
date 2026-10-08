# Architecture — Fate Instance (working title)

Status: PHASE 1 implemented the server, rooms, realtime lobby and client shell.
The game engine (§4 reduce/validate for `GameAction`) arrives in PHASE 4.

## 1. Constraints that decide the stack

The repo is not a blank slate. These are fixed by the course setup and are not
negotiable:

| Constraint (source) | Consequence |
| --- | --- |
| One `shared-cpu-1x` machine, **256 MB RAM** (`fly.toml`) | No Next.js server (it idles at 150–250 MB). One lean Node process. |
| One volume at `/data`, "no separate database server; a managed Postgres is outside the course setup" (`fly.toml`) | **No Supabase / hosted Postgres.** Persistence is an embedded database file on `/data`. |
| App serves plain HTTP on `0.0.0.0:$PORT` (`fly.toml`, `Dockerfile`) | One process serves the page, the API and the WebSocket on the same port. |
| `/` → 200, `/readme/` must contain README headings in **server-sent HTML** (`spec/README.md`) | The server renders `README.md` to HTML itself; it cannot be an SPA route. |
| Machine auto-stops when idle, auto-starts on request (`fly.toml`) | All game state must survive a cold restart; clients must reconnect transparently. |
| Real-time "within about a second", persists across restarts/redeploys (brief) | WebSocket push + write-through persistence on every accepted action. |

The original prompt suggested Next.js + Supabase + Supabase Realtime. Each of
those pieces maps onto something that fits the constraints:

| Suggested | Used instead | Why it is equivalent or better here |
| --- | --- | --- |
| Next.js | Vite + React SPA, built to static files | No server runtime cost; Node serves the built files. |
| Supabase Postgres | SQLite via built-in `node:sqlite` on `/data` | Same machine, no network hop, no native build step, transactions are real. |
| Supabase Realtime | WebSocket (`ws`) from the same Node process | Bidirectional (actions and pushes on one socket), single source of truth. |
| Row Level Security | Server-side **per-player projection** | Clients never touch the DB; the server only ever sends each player their own view. |

## 2. Final stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript everywhere (strict, `erasableSyntaxOnly` so Node 24 runs `.ts` directly) |
| Runtime | Node 24 (pinned in `mise.toml`) |
| Server HTTP | Hono on `@hono/node-server` (small, typed routing) |
| Realtime | `ws` WebSocket server attached to the same HTTP server, path `/ws` |
| Persistence | `node:sqlite` (`DatabaseSync`), WAL mode, file `/data/fate.db` (`DATA_DIR` env, defaults to `./data` locally) |
| Client | React 19 + Vite |
| Styling | Tailwind CSS v4 with CSS-variable design tokens (`src/client/styles/tokens.css`) |
| Animation | Motion (Framer Motion) — `motion/react` |
| Client state | One store fed by server snapshots (Zustand) — no client-side game logic beyond display |
| UI walkthrough | Playwright script (`scripts/ui-walkthrough.ts`): two isolated browsers, screenshots, clipping check |
| README page | `marked` rendered on the server at `/readme/` |
| Tests | Vitest: `spec/` (against running app, course harness) + `test/` unit project (engine, data, avatars) |
| Container | `node:24-slim`, multi-stage: build client, then run `node src/server/index.ts` |

## 3. Process layout

```
           ┌──────────────────────────── one Node process (≤ ~120 MB) ───────────────────────────┐
browser ──►│ Hono HTTP                                                                             │
  (SPA)    │   GET /            → dist/client/index.html                                           │
           │   GET /assets/*    → hashed static files, avatars                                     │
           │   GET /readme/     → README.md rendered to HTML on the server                         │
           │   POST /api/rooms  → create room (returns code + playerId + session token)            │
           │   POST /api/rooms/:code/join                                                          │
           │   GET  /api/health                                                                    │
browser ◄─►│ ws /ws  (auth with session token)                                                     │
           │   ↓ ClientMessage                    ↑ ServerMessage (per-player projected view)      │
           │ RoomHub ── one RoomActor per active room (serialised action queue)                    │
           │   └─ Engine (pure): validate(state, actor, action) → reduce(state, action, rng)       │
           │   └─ Persistence: one SQLite transaction per accepted action                          │
           └───────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                     /data/fate.db (volume)
```

## 4. Authority model ("never trust the client")

- The client sends **intents** (`GameAction`), never state. It cannot send a
  dice value, a fate total, a character, a round number or a phase.
- The server is the only place randomness happens (seeded RNG, see
  `game-state.md` §8).
- Every action goes through one pipeline:
  1. **Authenticate** — the socket is bound to `(roomCode, playerId)` by a session token.
  2. **Deduplicate** — each action carries a client-generated `actionId`; a
     repeated id is acknowledged but not re-applied (double taps, retries after
     reconnect).
  3. **Version check** — the action carries the `stateVersion` the client saw.
     Stale versions are rejected for actions where ordering matters (votes,
     reactions, skill use) and the client re-renders from the fresh snapshot.
  4. **Validate** — pure `validate()` checks: actor is in the room, it is the
     actor's turn or an open reaction window addresses them, enough action
     points, target legal (same carriage, alive, not immune…), skill uses left,
     phase allows it.
  5. **Reduce** — pure `reduce()` produces the next state + a list of
     `GameEvent`s (log lines, animations cues).
  6. **Persist** — snapshot + action log row + events in one SQLite transaction.
  7. **Broadcast** — each connected member gets `project(state, theirPlayerId)`.

### Race conditions

Node runs the reducer on one thread, and each room has a `RoomActor` with a
FIFO queue: actions for one room are applied strictly one at a time. Two
players pressing a skill in the same millisecond produce two queued actions;
the second fails validation (`SKILL_ALREADY_USED` / `NOT_YOUR_WINDOW`). The
monotonic `version` column is a second guard and lets clients detect gaps.
SQLite writes are synchronous (`DatabaseSync`) inside the actor, so the in-memory
state and the DB can never diverge mid-action.

## 5. Identity, sessions, reconnect

- No accounts. On create/join the server issues `playerId` (public, random) and
  `sessionToken` (secret, 32 random bytes; only its SHA-256 is stored).
- The client stores `{ roomCode, playerId, sessionToken }` in `localStorage`
  (key `fate:session:<roomCode>`). Only identity lives there — never game state.
- Refresh → client finds the stored session → opens `/ws` → sends
  `HELLO { roomCode, sessionToken }` → server rebinds the socket to the
  existing seat. No second player is created.
- Opening the same session in a second tab takes over the seat; the older
  socket receives `SESSION_REPLACED` and shows a notice.
- Disconnect ≠ leave. A member is marked `connected: false`; their seat,
  character and resources stay. In-game, a disconnected player's turn
  auto-passes after a grace timer (configurable, default 45 s) so the table
  is never blocked. They resume on reconnect with full state.
- Explicit **Leave** in the lobby frees the seat. In-game, leave converts the
  seat to "away" (auto-pass) so the scenario's player-count tuning stays valid.

## 6. Host rules

- Creator is host. Host may: start (≥ 2 players, all ready, all have a
  character), kick in lobby only, pick scenario, restart after results.
- Host has no extra visibility: projection treats the host like any player.
- Host leaves or is disconnected beyond the grace timer → host passes to the
  next seat in seat order that is connected.

## 7. Realtime protocol (summary — types in `src/shared/protocol.ts`)

Client → server: `HELLO`, `LOBBY_ACTION`, `GAME_ACTION`, `PING`.
Server → client: `WELCOME` (your identity + full projected snapshot),
`STATE` (full projected snapshot + `version`), `EVENTS` (log/animation cues
since version N), `REJECTED` (actionId + reason code + human message),
`SESSION_REPLACED`, `ROOM_CLOSED`, `PONG`.

Full snapshots are small (≤ 10 players, a few KB), so the server sends the
whole projected view after each accepted action rather than diffs. This keeps
reconnect and "missed a message" recovery trivial: the latest snapshot is
always the truth. Heartbeat: server pings every 20 s; client reconnects with
exponential backoff (0.5 s → 8 s) and re-sends `HELLO`.

## 8. Timers (reaction windows, vote deadlines, auto-pass)

Timers are **data, not closures**: a pending window stores `deadlineAt`
(epoch ms). The RoomActor keeps one `setTimeout` for the earliest deadline;
when it fires it enqueues a system action `TIMEOUT { windowId }`. On cold
start, the server loads active rooms and re-arms timers from stored deadlines
(an expired deadline resolves immediately with the default choice).

## 9. Directory structure

```
.
├── docs/                      design docs (this file, game-state, schema, visual)
├── public/
│   └── avatars/               192 generated SVG portraits  (PHASE 3 ✓)
├── scripts/
│   ├── check-evidence.ts      course harness (keep)
│   ├── avatars/portrait.ts    portrait layers (zodiac × MBTI × hash) (PHASE 3 ✓)
│   ├── gen-avatars.ts         writes public/avatars/, optional contact sheet (PHASE 3 ✓)
│   └── ui-walkthrough.ts      two-browser UI walkthrough (PHASE 1 ✓)
├── spec/                      tests against the running app (course harness + ours)
├── test/                      unit tests: engine, characters, avatars (no server needed)
├── src/
│   ├── shared/                pure TS, imported by both server and client
│   │   ├── characters/
│   │   │   ├── types.ts       Zodiac, MBTI, Character (coreSkillId)  (PHASE 0 ✓)
│   │   │   ├── signs.ts       sign/type display data, constellations (PHASE 1 ✓)
│   │   │   ├── validate.ts    static checks on a character's data    (PHASE 2 ✓)
│   │   │   └── roster/        12 files × 16 characters + index.ts    (PHASE 2 ✓)
│   │   ├── skills/
│   │   │   ├── core/          core abilities by family (mechanics, no names)
│   │   │   ├── types.ts       scenario adapter types, visuals
│   │   │   └── resolver.ts    core + adapter → the ability a scenario runs
│   │   ├── game/
│   │   │   ├── state.ts       GamePhase, GameState, player state    (PHASE 0 ✓)
│   │   │   ├── actions.ts     GameAction / LobbyAction unions       (PHASE 0 ✓)
│   │   │   ├── effects.ts     Effect primitives for the Skill Resolver (PHASE 0 ✓)
│   │   │   └── scenario01/    "00:17" content, tuning, skill-adapters/, skills.ts
│   │   └── protocol.ts        WebSocket message types               (PHASE 0 ✓)
│   ├── server/
│   │   ├── index.ts           HTTP + WS bootstrap
│   │   ├── db/                schema.sql, migrations, repositories
│   │   ├── rooms/             RoomHub, RoomActor, sessions
│   │   ├── engine/            pure rules (see §15 for the Skill Resolver's modules)
│   │   └── readme.ts          /readme/ renderer
│   └── client/
│       ├── main.tsx
│       ├── net/               socket client, reconnect, session storage
│       ├── store/             snapshot store
│       ├── screens/           one component per phase (Landing, Lobby, Reveal, Game, Ending, Results)
│       ├── components/        Train, PlayerHUD, ActionWheel, EventCard, DiceRoll, CharacterCard…
│       ├── audio/             sound interface + mute (no assets until licensed)
│       └── styles/tokens.css  design tokens                          (PHASE 0 ✓)
├── Dockerfile                 multi-stage: build client, run src/server/index.ts (PHASE 1 ✓)
└── fly.toml                   course-fixed, unchanged
```

Screens are chosen by a lookup table keyed on `GamePhase` (plus the
client-only pre-room routes `/` and `/join`), not by scattered `if (page === …)`.

## 10. Memory budget (256 MB)

Node 24 baseline ≈ 45–60 MB. Per room in memory: state ≈ 10–30 KB. Static
files are streamed from disk. Rooms with no connected sockets for 10 minutes
are evicted from memory (they stay in SQLite and rehydrate on the next
`HELLO`). Rooms untouched for 7 days are deleted by a startup sweep.

## 11. Testing strategy

- `spec/` (runs against the live app — course harness): invariants, room
  create/join over HTTP + WS, room cap of 10, reconnect keeps the seat,
  hidden info never appears in another player's snapshot.
- `test/` (pure unit, added as a second Vitest project): roster is exactly
  12 × 16 with unique ids, every character has an avatar file, engine
  reducer properties (no negative resources, AP accounting, skill uses),
  seeded replays reproduce identical states, full simulated playthroughs at
  2/6/10 players reach a terminal state.

## 12. Deviations from the original prompt (and why)

| Prompt | Decision |
| --- | --- |
| Next.js + Supabase | Vite/React + Node + SQLite (§1: 256 MB, no external DB allowed). |
| Avatars as `.webp` | SVG (§14 of the prompt allows SVG; vector, tiny, deterministic, generated by script). |
| All UI text | English only (project rule in `CLAUDE.md`), Chinese prompt text is translated. |

## 13. PHASE 1 notes

- Lobby actions are idempotent by nature (set ready, pick sign), so they are
  not deduplicated by `actionId`; game actions will be (§4 step 2).
- Joins over HTTP and lobby actions over the socket share one rule: each runs
  synchronously inside `BEGIN IMMEDIATE … COMMIT`, so the 10-seat cap and
  unique nicknames hold under simultaneous joins.
- Identity is one anonymous token per browser (`localStorage["fate:token"]`).
  Two people testing on one machine need two browser profiles or a private
  window, exactly like two real devices.
- `START_GAME` moves the room to `INTRO`; until PHASE 4 the intro ends with a
  host-only "Back to lobby" and says plainly that the run isn't built yet.
- The placeholder site (`placeholder/`) was removed; `/readme/` is now rendered
  by the server with `marked`.

## 14. PHASE 2 notes

- The roster is code (`src/shared/characters/roster/`), shared by server and
  client; the client reveals a character by looking up `(zodiac, mbti)`, the
  server will look up the same id when a run starts.
- `src/server/engine/skills.ts` holds the generic skill rules every character
  shares: `canUseSkill` (phase, turn or reaction window, uses left, lock,
  target legality per `TargetRule`) and `playersWokenBy` (which REACTION /
  PASSIVE skills an event wakes). Effect handlers come in PHASE 8, one per
  `Effect` kind.
- Vitest has two projects: `spec` (against the running app) and `unit`
  (`test/`, pure code). `pnpm check` runs both; `pnpm test:unit` runs only unit.

## 14b. Scenarios

A room plays one scenario (`rooms.scenario_id`, chosen by the host). Each
scenario registers its rules with the engine (`src/server/engine/scenario.ts`):
creation, actions, round steps, Collapse, act changes, the end check and
results. Scenario 01 (the train) and scenario 02 (the sinking city) share the
engine, dice, abilities, windows and log. The client picks each phase's screen
by the run's scenario (`RoomGate` → `Game` or `CityGame`; Intro, Ending and
Results branch the same way).

## 15. PHASE 8: the Skill Resolver

Abilities are layered so a new scenario never copies 192 skills:

```
Character (id, zodiac, mbti, nickname, avatar, coreSkillId)
  → Core Skill      src/shared/skills/core/   family, trigger, target, Effect primitives
  → Scenario Adapter src/shared/game/scenario01/skill-adapters/  name, description, visual,
                                              rarely a behaviour that replaces part of the mechanics
  → resolveSkill     src/shared/skills/resolver.ts  → characterSkill(id) in scenario01/skills.ts
  → Runtime resolver src/server/engine/resolver.ts  (below)
```

Only one ability needs a scenario behaviour today: Pisces ENTP's core is a
one-hit protection; in scenario 01 it is a pass for the next ticket check.
`test/skills-architecture.test.ts` checks 192/192 at each layer.

All 192 abilities run through shared code; docs/skill-mapping-notes.md has
the glossary and the pipelines. Engine modules involved:

| Module | Role |
| --- | --- |
| `resolver.ts` | using an ability (burn, random targets, declared-ability parking, fizzle detection), preconditions (`requires`), waking holders in turn (`askNext`), the after-the-fact trigger queue, tracked conditions, round-end and expiring-status passives, "change your answer" |
| `trigger-queue.ts` | `queueTrigger`, so low-level code (players, rewards, actions) can report events without importing the resolver |
| `intercept.ts` | the parked negative effect / declared ability: ask, then land (cancelled, weakened, redirected, retargeted, copied back) |
| `rewards.ts` | `measureRewards`: what a roll outcome or event gave each player counts as a reward (bonuses, reward triggers, reward bonds) |
| `round-events.ts` | reveal → reactions → resolve; extra events for abilities (`runCard` with a participant pool) |
| `skill-effects.ts` | handlers: cancel, weaken, redirect, retarget, copy, swap, bond, borrowed abilities, restore, statuses, stored/previewed rolls, delays, rules, turn order |
| `event-effects.ts` | handlers: extra events, previews, redraws, event changes, votes, choices, forced/contest/group rolls, wagers, doubled rewards, safety rope, tasks |

Low-level modules hand hooks upward by registration (`setInterceptor`,
`setExtraConditions`, `setGroupReroll`, `setBeforeClose`,
`setRollReactions`) so no import cycle runs code at load time.
