# Game state & state machine

Types live in `src/shared/game/*.ts` and `src/shared/characters/types.ts`;
this document explains them. The main diagram below describes Scenario 01.

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

### Scenario 03, PHASE 1 foundation

`GAME_PHASES` includes `ACT_4`, but only Scenario 03's registered round rule
enters it. Scenario 01 and 02 keep their own transitions. Scenario 03's
foundation spans rounds 1–3, 4–6, 7–9 and 10–12 across four acts; round 12
ends in failure if the team has not resolved a history route.

Act I now persists public, once-only story beat IDs in `temporal.story.revealed`.
`INTERACT_NPC` grants only the acting player an `ARCHIVIST_NOTE` under
`temporal.evidence`; the viewer projection exposes that player's own notes,
while the public story IDs, interventions and 2026 present are shared.

In Act II, `temporal.sealedProfiles` and trace actors remain server-only.
`temporal.surveillance` records validated 1996 arrivals, movements,
interventions and relic storage in order. The public projection withholds
traces until surveillance is discovered, then shows signatures without actor
IDs. It also masks the actor on public intervention records until the
round-6 `INTRUDERS_IDENTIFIED` beat. At that point the server stores the
profile matches and opens an acknowledged `S3_IDENTITY` sequence. Unreviewed
private evidence remains owner-only.

Act III adds `temporal.story.availableRoutes` and `discoveredFacts` to the
public projection, while individual investigation IDs and ZERO's transcript
remain in owner-only evidence. `PROTOTYPE_CORE: SHUT_DOWN` sets derived
`present.powerRoomExists = false` and `administrationIntegrity = FADING`;
the server rejects moves and jumps into the missing 2026 Power Room. Its
1996 counterpart remains accessible. The material rewrite increments
`causalRevision` and Collapse once. A round-8 fact/charter event grounds the
round-9 `S3_THIRD_ROUTE` acknowledged scene. Available routes have no effect
on ending state during PHASE 6.

Act IV stores `temporal.finalRoute` only after a validated 1996 Archives
resolution. Four causal nodes set the accident record, staff evacuation,
staged founder death and hidden prototype. Stable history requires both
assigned bootstrap source placements; no tomorrow erases the relic instances.
Three additive Scenario 03 outcomes drive synchronized Ending and Results.
The true route alone reveals Archivist 00's identity. Projection sends public
bootstrap progress while keeping assignments, holdings and private evidence
server-side or owner-only.

The optional `temporal.locations` maps every player to a physical room and
year. Each physical room exists once in an eight-room tree, with a 1996 and
2026 state. A shared `carriageIndex` presence key encodes room and year for
co-location, while walking uses tree adjacency. `TIME_JUMP` keeps the room
and changes year. The server persists this state and projects public
teammate locations to each viewer. Other temporal fields are planned for
later phases.

PHASE 2 adds `baselinePresent`, derived `present`, ordered `interventions`,
private per-player `evidence` and `causalRevision`. The 2026 state is
recomputed from the saved baseline for every 1996 decision. The public view
receives the current present and intervention record; only the viewer's own
evidence is included. An unchanged decision is recorded without incrementing
the material rewrite revision.

PHASE 3 adds `temporal.storedItems` with one record per numbered relic.
Availability, year-specific ownership and protected storage are statuses of
that record. `temporal.bootstrap` links seeded 2026 relics to assigned 1996
source obligations; only a validated storage action marks an obligation
placed. `temporal.holdings` keeps objective artifacts outside ordinary player
items and generic item effects. Projection exposes visible world items and the
viewer's own relics and obligations, never the holdings or another player's
carried relics.

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
| `escape` | `{ round, power, identity, memory, by }`: the three escape locks (Engine Room, Archive Car, Driver's Cab), all set in the same round or they slip back; each opens only for the player carrying its key |
| `sequence.fold` | round 7 only: the carriage order before and after the Reality Fold, so a reload replays the same fold |
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

Scenario 03 action rolls use the same pipeline. Its investigation,
intervention, NPC conversation and supply search commit their effects only
after a successful final tier. Their targets remain in server-only
`rollContext` while Fate and reaction windows are pending. At Collapse 6 or
above in Acts III–IV, Time Jump also rolls for stability after arriving in the
other year. These action rolls change resources only at the endpoints:
Disaster costs 1 Sanity and Perfect gains 1 Fate. Temporal Scan follows the
same baseline and grants its chosen protocol effect on Success or Perfect.
Archive directions are owner-only secrets; Field Focus and Temporal Alignment
are persisted public statuses. The former expires after the current cycle or
one eligible roll, while the latter lasts until the next Time Jump lowers its
AP cost from 2 to 1. The Time Jump cue triggers a brief client animation.
A perfect supply search uses a persisted choice
window to award exactly one of the two existing supplies.
An unstable Time Jump Failure (final 2–3) adds `TEMPORAL_LAG`: the next
cycle starts with 1 less AP, never below 1, and the status expires at that
cycle's end. Repeated failures cannot stack the AP penalty.

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
| `REPAIR` | 1 | roll; anchors (act 2–3), escape locks (act 3, only with that lock's key) |
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
| 5 | "Please confirm your seat neighbour is still themselves." Each player gets one secret message, always true of the table when it is dealt (it may be incomplete; players may still lie about it). |
| 6 | Vote: Emergency brake (collapse −2, inspector acts now) vs keep going (+1 fate all, collapse +1). Tie → random. |
| 7 | Reality Fold: the six middle carriages re-shuffle so that every one moves (a derangement); the first carriage and the cab stay. Players, the Inspector and entities stay on their physical node, so the carriage under them changes; anchors and locks move with their carriage. Cab access restored. → ACT_3 at round 8. |
| 8–12 | Cab open. Inspector moves twice per round. Echoes harass. Escape protocol: POWER (engine room), ROUTE (archive, team holds ≥ 3 fragment types), DRIVE (cab), all in one round. |
| end of 12 | Not escaped → FAILED. |

### Win (all must hold)
1. all three anchors repaired; 2. team holds ≥ 3 fragment types;
3. POWER + IDENTITY + MEMORY escape locks set in the same round, each by the carrier of its key; 4. collapse < 12;
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
| round-5 secret message | full (always true) | nothing |
| secret ally / hidden pair | full | nothing (until revealed by rule) |
| hidden statuses | full | nothing |
| dream cards | full (always true) | count only |
| peeked future events (preview skills) | the peek | nothing |
| items | full | count + public item names |
| everything else | full | full |

Projection runs on the server; secrets are never in another player's
payload, so there is nothing to find in devtools. A spec test asserts this.
The system never lies: every message and dream is built from the live state
and is true when dealt (`test/act2.test.ts` judges each one against the table).
Players may still lie about what they received.

## Keys and escape locks

Restoring an anchor puts its key (POWER_KEY, IDENTITY_KEY, MEMORY_KEY;
tags KEY_ITEM + OBJECTIVE_ITEM) in the inventory of the player who made the
last repair, or the ability's user if an ability finished it. Each key is
made once per run. A key is never used up, is not a reward, and moves only by
a TRADE: random grants, steals, reward copies and doubling skip it, and a
lost player keeps it. In act 3 only the carrier of a lock's key can Repair
that lock; without it the button is disabled and names the missing key.

## Ticket check

The final result (after Fate, abilities and reactions) decides: 6 earns a
temporary pass, 4–5 passes, 1–3 empties Sanity (the player is lost and
stays in the run). Shields and other protections still apply.

## Scenario 04 auction state

The ten lots live in `src/shared/game/scenario04/lots.ts`. `auction` records
fixed seat order, active lot, high bid and bidder, passed seats, each round's
opening seat, settlement history, player Black Chips, Debt, won lots,
certified private intel, READ results, and Glass Eye snapshots. Black Chips and intel are private;
Debt and won lots are public. Fate, Sanity, AP, Lost, and the seeded die use
the shared player and roll structures. AP refreshes to 1 each round, or 2
for the three full rounds after activating Red Contract (1 when Lost). It never
refreshes on an additional bidding lap. Successful bids and passes remain on
the same turn until END_TURN; one bid is allowed per turn.

A winner pays only at settlement. The winner opens next round immediately
after their seat; an unsold round opens after its previous opening seat.
Round 10 still uses BID/PASS. The crown can cover two chips of its holder's
final bid after activation while its holder pays the real amount; high Debt changes a winning
ending into the debt ending. Each lot starts at one Black Chip. Exactly two
of Lots 1–9 are chosen as counterfeits by the seeded RNG at game creation;
their identities remain server secret until discovered. Lot 10 is the final
objective and does not enter inventory. Won items remain inert until the holder
uses them, then leave inventory and produce a private activation notice.
Auction wins and accepted item transfers also produce an owner-only acquisition
notice. The notice sequence increments on both acquisition and use, so a new
event replaces an older one even within the same turn. The event time bounds
the notice lifetime across client remounts and reconnects. The own HUD derives
effect chips from server state (armed die and coin, contract rounds, Sanity ward,
crown, Lost, and next-roll penalty); expiring effects need no client timer.
Prototype Chrono Key selects an instance recorded in this run's earlier
auction history (Lots 1–4). It creates a new item instance with the source's
recorded authenticity and independent consumed state, even if the source was
already used. Nameless File restores Sanity to 3/3 and
prevents every later Sanity loss. Black Die and Gambler's Coin arm their next
eligible roll or Blackjack hand, while Red Contract and Black Crown take effect
from activation.
