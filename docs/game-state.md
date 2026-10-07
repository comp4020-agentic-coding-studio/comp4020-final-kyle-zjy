# Game state & state machine

Status: PHASE 0 design. Types live in `src/shared/game/*.ts` and
`src/shared/characters/types.ts`; this document explains them.

## 1. Two levels of state

| Level | Lives in | Changes on |
| --- | --- | --- |
| **Room** (code, members, host, seats, character picks, ready) | `rooms`, `room_members` tables | lobby actions |
| **Game session** (everything inside a run of scenario 01) | `game_sessions.state_json` snapshot + `action_log` | game actions |

A room outlives many game sessions ("play again" creates a new session, keeps
the room and the members' character picks).

## 2. GamePhase

```
                 host START (≥2, all ready)
   LOBBY ───────────────────────────────────────► INTRO
     ▲                                              │ intro sequence ends (all ack or 12 s)
     │                                              ▼
     │                                            ACT_1   (rounds 1–3)
     │                                              │ round 3 ends → blackout transition
     │                                              ▼
     │                                            ACT_2   (rounds 4–7)
     │                                              │ round 7 ends → cockpit unlocks
     │                                              ▼
     │                                            ACT_3   (rounds 8–12)
     │                                              │ escape protocol completes │ fail condition
     │                                              ▼                           ▼
     │                                            ENDING (outcome: NORMAL | TRUE_* | FAILED)
     │                                              │ sequence ends
     │       host RESTART / BACK_TO_LOBBY           ▼
     └───────────────────────────────────────── RESULTS
```

A fail condition (collapse = 12, all members lost) can fire from any act;
it jumps straight to `ENDING` with `outcome = FAILED`.

### Character selection and reveal are member stages, not room phases

Players pick at different speeds, so selection is tracked **per member**
inside `LOBBY`:

```
JOINED ──pick zodiac──► ZODIAC_CHOSEN ──pick MBTI──► REVEALED ──ready──► READY
   ▲                                                    │
   └──────────── change character (un-readies) ─────────┘
```

`CHARACTER_SELECTION` and `CHARACTER_REVEAL` from the prompt map to these
member stages. The host's START is enabled only when every member is `READY`.

## 3. Inside an act: the round loop

```
ROUND_START
  ├─ +1 round counter, refill AP (2, or 1 if LOST), apply round-start triggers
  ├─ scripted round event (R3 blackout, R5 secrets, R6 vote, R7 fold, R8 cockpit)
  ▼
PLAYER_TURNS  ── for each seat in turnOrder:
  │   TURN(player): spend AP on actions, optionally USE_SKILL / USE_ITEM, END_TURN
  │   (interrupt windows may open at any point, see §4)
  ▼
INSPECTOR      (from round 4; 1 step in act 2, 2 steps in act 3)
  ▼
ROUND_EVENT    (public event card for the round: choice / roll / vote)
  ▼
ROUND_END
  ├─ collapse +1, expire statuses, round-end triggers, check win/fail
  └─ next ROUND_START, or act transition, or ENDING
```

`state.step` holds the current step: `ROUND_START | PLAYER_TURNS | INSPECTOR |
ROUND_EVENT | ROUND_END | ACT_TRANSITION`.

## 4. Interrupt windows (the "pending stack")

Anything that pauses normal flow for someone's decision is a **window** on
`state.pending` (a stack; top window is the active one):

| Window kind | Opened when | Who answers | Timeout default |
| --- | --- | --- | --- |
| `FATE_SPEND` | a modifiable roll resolves | the roller | 15 s → spend 0 |
| `REACTION` | an event matches someone's REACTION skill trigger | that skill's owner | 12 s → decline |
| `PASSIVE_CONFIRM` | a PASSIVE skill's condition becomes true | the owner | 12 s → decline |
| `TARGET_CHOICE` | an effect needs a choice ("pick one of two rewards") | the effect owner | 20 s → first legal |
| `EVENT_CHOICE` | event card offers options | the addressed player(s) | 30 s → default option |
| `VOTE` | R6 emergency brake, "all vote" skills | all non-away members | 30 s → abstain |
| `TRADE_OFFER` | TRADE action | the trade partner | 20 s → decline |

Each window has `id`, `kind`, `addressees`, `options`, `deadlineAt`,
`resume` (what the engine does after it closes). Only addressees can answer;
every other action is rejected with `WINDOW_OPEN` while a window that blocks
the table is on top. Windows are what make REACTION skills ("someone hit me —
do I burn my one skill now?") a real decision instead of a button.

## 5. Player state (per member, per session)

| Field | Start | Notes |
| --- | --- | --- |
| `fate` | 2 (+1 on "Lucky Night") | ≥ 0. Spend 1 to +1 a die, max 2 per roll. |
| `sanity` | 3 (max 3) | 0 → `lost`. |
| `ap` | 2 per round | 1 if lost at round start. |
| `skill.usesLeft` | 1 (`maxUses`) | skills may restore/copy/delay. `skill.state`: `READY \| BURNED \| LOCKED`. |
| `items` | 1 random | from the luggage-car pool. |
| `statuses` | [] | `{ id, kind, polarity, source, expiresAtRound, hidden }`. |
| `carriageIndex` | starting car | physical node index (0 = rear). |
| `lost` | false | recovers by a successful STABILIZE / recovery event (+1 sanity). |
| `obsession` | 1 secret | personal goal, **private**. |
| `helpBonus` | 0 | pending +1/+2 on next ordinary roll, capped at +2. |
| `stats` | counters | for obsession checks and the results screen. |

"Lost" never removes a player: they act with 1 AP, cannot CONFRONT other
players' effects aggressively, and can always STABILIZE or be helped.

## 6. Shared scenario state

| Field | Meaning |
| --- | --- |
| `round`, `act`, `step` | position in the run |
| `turnOrder`, `activeSeat` | whose turn it is |
| `collapse` | 0–12, visible always (`7 / 12` text, not only colour) |
| `carriages` | ordered list of physical nodes, each with an `identity` (START, DINING, LUGGAGE, MIRROR, ARCHIVE, SLEEPER, ENGINE_ROOM, CAB); middle identities shuffled per seed, re-shuffled at round 7 (Reality Fold) |
| `anchors` | `POWER` (engine room), `IDENTITY` (archive), `MEMORY` (sleeper or mirror): `progress / required`, `lastRepairedBy` (no same player twice in a row) |
| `memoryFragments` | team-owned fragment types: ROUTE, DRIVER, MANIFEST, + core memories (6 → true ending) |
| `inspector` | `{ active, carriageIndex, distortion 0–3, banishedUntilRound }` |
| `echoes` | act-3 passenger echoes that harass key players |
| `seatNeighbours` | pairs/triple drawn at round 4 |
| `escape` | `{ round, power, route, drive }`: three locks, must all be set in the same round |
| `nightRule` | one of 8, drawn at start |
| `eventDeck` | seeded deck order + discard |
| `outcome` | set in ENDING |
| `log` | public log lines (bounded ring, full history in `game_events`) |

## 7. Dice

One pipeline for every roll:

```
raw = d6 (server RNG)
  → + helpBonus (≤ +2, consumed)
  → + skill/status modifiers
  → FATE_SPEND window: roller may spend 0–2 fate, +1 each  (and REACTION windows,
    e.g. "Premeditated Charge: raise my result one tier")
  → final = clamp(1, 6)
  → tier: 1 DISASTER · 2–3 FAIL · 4–5 SUCCESS · 6 PERFECT
```

The `Roll` record stores every step (`raw`, `modifiers[]`, `fateSpent`,
`final`, `tier`), and the UI shows **raw → fate → final** in full.

## 8. Randomness and replay

- At game start the server draws `seed` (crypto random, 32 bits ×4).
- RNG is `sfc32(seed)` with a `cursor` stored in state. Every random draw
  goes through `rng.next()` and increments the cursor.
- Seeded at start: carriage order, night rule, starting items, obsessions,
  event deck order. Drawn during play: dice, search loot, inspector
  ties, secret messages, round-7 fold.
- Replay = initial snapshot + seed + ordered `action_log`. A test replays
  every logged game and asserts the final hash matches (`test/replay.test.ts`).

## 9. Actions

All gameplay goes through the `GameAction` union (`src/shared/game/actions.ts`):

| Action | AP | Rule summary |
| --- | --- | --- |
| `MOVE` | 1 | to an adjacent carriage; CAB locked before round 8 |
| `INVESTIGATE` | 1 | roll; clues, memory fragments, main line (archive/mirror/sleeper) |
| `SEARCH` | 1 | roll; items, fate, statuses, discoveries (luggage/dining) |
| `REPAIR` | 1 | roll; anchors, devices, escape locks |
| `HELP` | 1 | same-carriage player: +1 to their next ordinary roll (cap +2); stronger for seat neighbours |
| `TRADE` | 1 | same-carriage: opens TRADE_OFFER window |
| `STABILIZE` | 2 | +1 sanity or remove one ordinary negative status |
| `CONFRONT` | 1 | vs inspector / shadow passenger / echo; success 1, perfect 2 progress |
| `USE_SKILL` | 0 | once (usesLeft); ACTIVE in own turn, REACTION/PASSIVE only in their window |
| `USE_ITEM` | 0 | consumes the item |
| `END_TURN` | — | passes to next seat |
| `RESPOND` | — | answers the top window (fate spend, reaction yes/no, vote, choice, trade) |

Unavailable actions are returned by `availableActions(state, playerId)` with a
`reason` ("No action points left", "Cab opens in round 8", "Nobody else in
this carriage") so the action wheel can grey them out and say why.

Lobby actions (`LobbyAction`): `SET_NICKNAME`, `PICK_ZODIAC`, `PICK_MBTI`,
`SET_READY`, `KICK`, `SELECT_SCENARIO`, `START_GAME`, `LEAVE`,
`RESTART`, `BACK_TO_LOBBY`.

## 10. Scripted beats of scenario 01 "00:17 — The Last Train That Doesn't Exist"

| Round | Beat |
| --- | --- |
| 1–3 | Explore. Goal: fragments ROUTE, DRIVER, MANIFEST. |
| end of 3 | Blackout. "Identity registration closed. Anomaly detected." Passenger count glitches. → ACT_2 |
| 4 | Faceless Inspector appears. Seat neighbours drawn. Anchors become repairable. |
| 5 | "Please confirm your seat neighbour is still themselves." Each player gets one secret message (some false, no traitor). |
| 6 | Vote: Emergency brake (collapse −2, inspector acts now) vs keep going (+1 fate all, collapse +1). Tie → random. |
| 7 | Reality Fold: middle carriages re-shuffle (players stay on their physical node, the identity changes). Cab access restored. → ACT_3 at round 8. |
| 8–12 | Cab open. Inspector moves twice per round. Echoes harass. Escape protocol: POWER (engine room), ROUTE (archive, team holds ≥ 3 fragment types), DRIVE (cab), all in one round. |
| end of 12 | Not escaped → FAILED. |

### Win (all must hold)
1. all three anchors repaired; 2. team holds ≥ 3 fragment types;
3. POWER + ROUTE + DRIVE locks set in the same round; 4. collapse < 12;
5. at least half the players are not lost.

**True ending:** 6 core memories found → final choice (delete it / give it a ticket).

### Fail (any)
collapse reaches 12 · round 12 ends without escape · every player lost at once.

## 11. Player-count tuning (tuned in PHASE 11)

Values live in `tuningFor()` (`scenario01/content.ts`); the evidence is in
docs/simulation-report.md.

| Players | Anchor repairs each | Start Collapse | Action points | Inspector steps (act 2 / 3), ticket targets | Echoes |
| --- | --- | --- | --- | --- | --- |
| 2 | 1 | 0 | 3 a round, 4 in act 3 | 1 / 1, 1 | 1 |
| 3 | 1 | 0 | 2 | 1 / 1, 1 | 1 |
| 4–5 | 2 | 0 | 2 | 1 / 2, 1 | 2 |
| 6 | 3 | 1 | 2 | 1 / 2, 1 | 2 |
| 7 | 3 | 1 | 2 | 1 / 2, 2 | 3 |
| 8–10 | 4 | 2 | 2 | 1 / 2, 2 | 3 |

Collapse rises by 1 every round and is the real clock; restoring an anchor
eases it by 1. Only key tasks raise it on a disaster (a botched repair or
confrontation); a disastrous investigation or search costs the explorer
Sanity, not the train Collapse, so exploring is never worse than idling.

## 12. Information visibility (projection)

`project(state, viewerId)` builds what one player may see:

| Data | Owner sees | Others see |
| --- | --- | --- |
| obsession | full | "has a secret goal" |
| round-5 secret message | text only; whether it is true only once the run is over | nothing |
| secret ally / hidden pair | full | nothing (until revealed by rule) |
| hidden statuses | full | nothing |
| dream cards | text only; whether it is true only once the run is over | count only |
| peeked future events (preview skills) | the peek | nothing |
| items | full | count + public item names |
| everything else | full | full |

Projection runs on the server; secrets are never in another player's
payload, so there is nothing to find in devtools. A spec test asserts this.
A false message or dream is always actually false at the moment it is dealt
(`test/act2.test.ts` judges each one against the table).
