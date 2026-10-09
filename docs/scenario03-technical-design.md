# Scenario 03 technical design: Temporal Administration: Incident Zero

Status: PHASE 0–11 implemented and browser-verified. Scenario 03 is selectable
in the public lobby.
The Chinese title is
**时间管理局：第零号事故**. The Chinese subtitle is **有些灾难不是因为没人阻止，而是因为有人已经阻止过。**
The proposed natural English subtitle is **Some disasters happen because someone already tried to stop them.**
The current code and `PROJECT_RULES.md` remain the source of truth.

## Constraints and scope

- Scenario ID: `S03_INCIDENT_ZERO`. Its lobby entry opened after the
  3/4-player browser paths reached Results. S01/S02 rules, maps, balance, events, adapters, text and
  replay logs must retain their behavior.
- Two years only: `Y1996` and `Y2026`. Twelve rounds, four acts of three
  rounds, and three base AP per player per round at every table size. Lost
  players still get one AP under the shared rule. Scenario 03 must not apply
  Scenario 01's small-table AP bonus; shared status penalties and explicit
  ability gains still work.
- Walk, investigate, interact with an NPC, pick up or operate an ordinary
  item, intervene, and help: 1 AP. Time jump: 2 AP, same physical room and
  opposite year. `STABILIZE`: shared 2 AP. `USE_SKILL`: shared zero AP and
  once per run.
- Collapse keeps the shared 0–12 mechanics; Scenario 03 may label it temporal
  collapse. Ordinary jumps do not increase it. Historical contradictions,
  failed fixed facts and round pressure may do so through `changeCollapse`.
- All changes pass the existing server-authoritative action queue, seeded RNG,
  one SQLite transaction and per-viewer projection. No player is eliminated.

## Eight-room map and location

The same undirected tree exists in both years:

```text
                        DIRECTOR_OFFICE
                       /
CENTRAL_HALL -- ARCHIVES -- SECRET_ARCHIVE
       |
       +-- RESEARCH_WING -- MAIN_LAB
                         |-- PROTOTYPE_ROOM
                         +-- POWER_ROOM
```

These are eight physical `RoomId` values. Year-specific state supplies
access, function, occupants, items and actions; rooms unlock over the story.
The containment function is the `TEMPORAL_CONTAINMENT` interactive
facility/state inside the 2026 `RESEARCH_WING`, not a ninth physical room.
The corresponding 1996 space is an ordinary research facility or is still
under construction. The prototype room can be restricted in 2026. The left
branch supports official records and investigation; the right supports
experiments, NPCs and the accident.

The authoritative location is `{ roomId, year }`. The current shared skill
machinery tests `carriageIndex` for co-location and stores it in roll context.
Scenario 03 mirrors location into a compatibility presence key
`roomIndex + (year === Y2026 ? 8 : 0)`. This does **not** create sixteen
topology nodes: walking uses the eight-room adjacency table, never `index ± 1`.
A jump toggles the year and preserves the room. Players in the same room in
different years are not co-located for HELP, TRADE or skill targeting.
`movePlayer` decodes and re-encodes the key. Test the mirror invariant after
walking, jumping, skill movement and reload.

## State and projection

PHASE 1 adds an optional `temporal` field with authoritative `locations` only.
It is absent for S01/S02 to preserve old snapshots. Later phases will extend
it with the following planned fields. Static definitions remain code, while
per-run facts enter the existing snapshot. Proposed eventual state shape:

```ts
type Year = "Y1996" | "Y2026";
type TemporalState = {
  locations: Record<PlayerId, { roomId: RoomId; year: Year }>;
  past: Record<RoomId, PastRoomState>;
  baselinePresent: Record<RoomId, PresentRoomState>;
  present: Record<RoomId, PresentRoomState>;
  nodes: Record<CausalNodeId, CausalNodeState>;
  interventions: CausalIntervention[];
  evidence: Record<EvidenceId, EvidenceState>;
  npcs: Record<NpcId, TemporalNpcState>;
  holdings: Record<PlayerId, ObjectiveHolding>;
  storedItems: Record<ItemInstanceId, StoredItem>;
  bootstrap: BootstrapObligation[];
  story: { revealed: Record<StoryBeatId, boolean>; route: EndingRoute | null };
  causalRevision: number;
};
```

`past` stores 1996 state; `baselinePresent` is the seeded starting 2026;
`present` is a materialized result of applying past interventions in stable
order. Each room state uses IDs for access, function, NPCs, item instances and
available actions. Evidence separates official claim, observed fact,
visibility and provenance. Do not store translated text as a logical value.

`publicTemporal(state, viewerId)` produces the `PlayerView` field. It removes
unrevealed evidence, sealed schedules, NPC secrets, item caches and other
players' private holdings. Public location and year of every teammate remain
visible. Private discoveries stay owner-only until explicitly shared.
Rejections must not disclose hidden facts. Reconnection gets a fresh
projection, including committed `causalRevision`; no client recomputes
causality. The existing `game_sessions.state_json` and action log suffice;
no extra database table is planned.

## Causal node contract

A static `CausalNodeDefinition` has a stable ID, 1996 room, affected 2026
rooms, investigation IDs, allowed interventions, fixed-fact IDs, official
claim IDs and disguisable claim IDs. A `CausalNodeState` holds the current
choice, discovery state and derived consequence. Candidate nodes are security
doors, Ji Linchuan, the prototype core, accident broadcast, staff evacuation
and official report.

```ts
type CausalIntervention = {
  seq: number;
  nodeId: CausalNodeId;
  choiceId: InterventionId;
  actorId: PlayerId;
  round: number;
  roomId: RoomId;
  year: "Y1996";
};
```

Only a validated 1996 action appends an intervention. Recompute 2026 from
the stored baseline in node/sequence order, diff old and new public states,
then commit the updated state and change cue together. Recalculation draws
no RNG; seeded starting facts are drawn during `create` and stored. Repeated
or contradictory interventions have explicit rules, with at most one
Collapse change per action.

The effect must alter gameplay: a past door changes 2026 access; saving a
worker changes the NPC or their legacy; leaving a permitted item creates one
retrievable 2026 instance; an action changes an archive entry with its actor
provenance. Cues contain stable IDs, room/year and public before/after status
for the ripple/archive rewrite animation. Keep **fixed facts** separate from
**official claims**: apparent death and destruction may satisfy a record
without requiring actual death or destruction. This distinction supports the
third ending in rules rather than in a final text-only reveal.

## Items and bootstrap obligations

Scenario 03 has its own ordinary `S03ItemId` pool via
`ScenarioRules.itemPools`. Candidate IDs: `TEMPORAL_ANCHOR`, `OLD_BADGE`,
`AUTHORITY_CARD`, `PHASE_BATTERY`, `REPORT_FRAGMENT`, `SEAL_BAG`,
`TIME_MARKER`, `SEDATIVE03`. Recovery still uses shared Sanity primitives.
Objective/causal artifacts, including a staged death record, live in
`temporal.holdings`, outside ordinary `PlayerGameState.items`; generic
random grants, theft, deletion, copying and reward doubling cannot touch
them.

An ordinary stored item has an instance ID and a conservation lifecycle:
`HELD_1996 -> STORED -> HELD_2026` (or an explicit terminal state).
Placement requires a designated room and protection condition. A 2026 pickup
consumes the stored instance once; trade transfers ownership of that same
instance under the shared co-location gate. No item is duplicated.

At creation, draw a small set of player-linked relic IDs with the run's seed,
create visible 2026 relics, and record matching 1996 placement obligations.
Their later sources must be actual player actions. A history-preserving route
cannot claim a closed loop unless required placements occurred. The route
that removes the Administration must explicitly erase the relics as its
timeline consequence. PHASE 7 must test this in every ending.

## Beats, acts and endings

Each `StoryBeat` has a stable ID, round/fact/investigation trigger,
prerequisites, audience, once-only flag, content/message IDs and optional
window/sequence ID. Archives generated by players refer to real recorded
actions; a beat never claims an action happened when it did not.

| Rounds | Structure | Evidence through play |
| --- | --- | --- |
| 1–3, Act I | 2026 lockdown, initial archive, first 1996 access; more past rooms open after round 3 | First intervention rewrites 2026; bootstrap relics point to players |
| 4–6, Act II | Wider access; round 6 reveals the intruders' identity | Surveillance and records cite actual interventions and relic provenance |
| 7–9, Act III | ZERO explains the founding paradox; round 9 opens the third route | Investigations distinguish fixed facts from official claims |
| 10–12, Act IV | Resolve the accident, bootstrap obligations and ending | Actions determine the human cost, not only a final vote |

The three route IDs are `OFFICIAL_HISTORY` (stable, actual casualties),
`NO_TOMORROW` (accident prevented, Administration erased; a complete ending),
and `DECEIVE_HISTORY` (controlled accident, evacuation, Ji's official death,
hidden prototype and credible evidence). Archivist 00 is present early as an
unassuming 2026 NPC; his identity as older Ji and the seven-minute line
appear on the earned true-ending route. Collapse 12 or all-lost gets a
coherent Scenario 03 result without early player elimination.

The pre-Scenario-03 `GamePhase`, `act`, `turnGate` and `RoomGate` stopped at Act III.
PHASE 1 added generic `ACT_4` support and audited phase
exhaustiveness. Only Scenario 03's own round transition may enter `ACT_4`;
adding the union member must not automatically advance S01/S02 to a fourth
act. Add regression tests that exercise both existing scenarios through
their complete phase transitions and prove they never enter `ACT_4`.
`Outcome`, `Sequence`, `RollPurpose`,
`ItemId` and action unions also need additive IDs in their later phases;
Scenario 03's route details stay in `temporal.story`.

## ScenarioRules and realtime integration

`src/server/engine/scenario03/rules.ts` registers its rules and is imported
by `engine/create.ts`. Use a lazy `actions` getter returning `s03Actions()`
to avoid the import cycle seen in Scenario 02. Hooks:

- `create`: seed two-year baseline, player positions, event deck and relic
  obligations.
- `apFor`: 3 normally, 1 when lost; no player-count AP bonus.
- `onRoundStart`, `afterTurns`, `worldStep`, `roundEvent`,
  `roundCollapse`, `collapseChanged`, `afterRound`: beats, temporal
  pressure, changes and four-act schedule.
- `checkEnd`, `results`, `announceEnding`: route resolution and player
  results. `movePlayer`: skill movement on the eight-room graph.
- `itemPools`: Scenario 03 ordinary items. `runJob` is empty until a real
  queued job is necessary.

Narrow intent types: `TIME_JUMP`, `INTERVENE(nodeId, choiceId)`,
`INTERACT_NPC(npcId, optionId)`, `PICK_UP(itemInstanceId)`,
`STORE_ITEM(itemInstanceId)`, and later objective actions. Clients never
submit a resulting year, changed room, archive, Collapse or outcome. `MOVE`
may retain the numeric target but its Scenario 03 `Spec` validates
same-year tree adjacency and access. `Spec.check` also supplies
`availableActions`; `turnActions` ensures stale turn-version rejection.
Each rolled action has its own `S3_*` purpose and `onRollOutcome` handler,
preserving Fate, help and reactions. Use `openWindow`/`onResume` for
decisions and `measureRewards` for gains.

The existing runner, SQLite transaction, room hub and WebSocket protocol do
not need a Scenario 03 fork. The committed causal revision is broadcast
through each viewer's projection; reconnect resumes the same seat, year,
room, private evidence and pending decision.

## Skills, language and visuals

Keep all 192 identities, portraits and Core Skills unchanged. PHASE 8 builds
`SCENARIO03_SKILLS` through `skillTable(ROSTER, set)` and
`characterSkill(id, scenarioId)`, with 192 English/Chinese names,
descriptions and themed VFX. Earlier closed-lobby development must not ship
train-specific or untranslated player-facing text. Use `behaviour` only
where year, causal node, archive or persistent items require it. Log every
rewording in `docs/skill-mapping-notes.md`. Scenario actions and events
must exercise roll/reroll/result modifiers, help, statuses, negative effects,
resources, items, information, NPCs, event control, turn order, bonds,
protection, copy/swap/preview, challenge and group effects.

English is canonical; Chinese is implemented in the same phase as each
piece of player-facing content. Add Scenario 03 English data and
`src/shared/i18n/zh-CN/scenario03.ts`, client `s3-en.ts`/`s3-zh-CN.ts`,
and literal engine `m` templates with Chinese entries in
`zh-CN/messages.ts`. State and database use IDs. One room can have viewers
in both languages using the same state.

Keep the dark night, gold frame, portraits, HUD and Motion vocabulary. Add
archive files, analog clocks, record numbers, dual-year comparison and
temporal ripples. Desktop can show two year views; mobile switches views but
always shows the player's year, teammates' years and recent causal changes.
The 2026 view must visibly move from old state through a ripple/archive
rewrite to committed new state. Cues drive interruptible animation with
reduced-motion support. Maps scroll inside their frame; no page overflow at
320 px, touch targets at least 48 px, and every colored state has text.

## Test gates and planned files

- PHASE 0: `git diff --check` and design consistency review; no runtime test
  is needed for a documentation-only change.
- PHASE 1: exact AP at 2/3/4 players, 12-round bound, adjacency, jump cost
  and same-room rule, co-location, stale action, reconnect and mobile map.
  Regression tests cover the fourth-phase shared extension.
- PHASE 2: real 2026 map/NPC/item/archive changes, seeded replay, secrecy,
  save/reload, one causal revision and bounded Collapse per intervention.
- PHASE 3: item instance conservation across store/pickup/trade/reload and
  objective-item protection.
- PHASES 4–7: each act's critical path, provenance of evidence, mandatory
  round 6/9 reveals, bootstrap closure and all three reachable endings.
  Simulate 2/3/4/6/10 players; retain replay logs once winnable.
- PHASE 8: 192/192 adapters resolve and fire; wording and numeric effects
  match in both languages; cover mechanisms rather than 192 scenarios.
- PHASES 9–11: real-browser walkthroughs with 3 and 4 isolated players at
  320/390/1280, both languages, causal transitions, reconnect and endings.
  At milestones run typecheck, unit, spec, build, S01/S02 walkthroughs and
  kept deterministic replays.

```text
src/shared/game/scenario03/{content,map,items,nodes,events,skill-adapters,skills}.ts
src/server/engine/scenario03/{create,rules,actions,causality,story,world,ending}.ts
src/shared/i18n/scenario03.ts; src/shared/i18n/zh-CN/scenario03.ts
src/client/i18n/{s3-en,s3-zh-CN}.ts
src/client/screens/Scenario03Game.tsx; src/client/game/scenario03/*
test/scenario03-*.test.ts; test/bot03.ts; scripts/ui-play03.ts
```

The shared state contains inert S01 fields for S02; S03
initialize them inertly for compatibility, never use them for its rules.
Some shared UI and task text still branch on `city`; later phases should
prefer a generic hook with S01/S02 regression tests over adding more
scenario checks. The eight-room containment resolution and fourth-act
extension are fixed design decisions. Each phase reports its checks and stops;
existing S01/S02 replays must remain unchanged.

## PHASE 8 implementation boundary

The Scenario 03 skill table resolves every roster character through its
original Core Skill and a Scenario 03 adapter. The complete English and
Chinese character catalogs supply unchanged wording, with explicit revisions
for scenario-bound terms and one ticket-pass behavior override; see
`docs/skill-mapping-notes.md`. Three scan protocols provide an ordinary roll
path for roll abilities. Co-located help and causal task progress use the
existing shared handlers. The five-card seeded anomaly deck gives event
control abilities real public events. The Scenario 03 screen shows the
ability, target picker, remaining uses, scan actions, die, decisions, event
card and skill VFX. The lobby entry remains closed for later visual and
release phases.

## PHASE 1 implementation boundary

The closed Scenario 03 registration uses its own `create`, `actions` and
`rules` adapter. The implemented map has exactly eight physical rooms, mirrored
in both years. `MOVE` validates one adjacent open room in the same year for
1 AP; `TIME_JUMP` preserves the room and switches year for 2 AP. A year-aware
presence key supports shared co-location checks without changing the map.
`temporal.locations` is persisted in the ordinary session snapshot and its
public portion is explicitly projected to every player. The base turn has
3 AP, four acts span three rounds each, and the twelfth round reaches a
clearly labelled development ending. Story, causality, NPCs, items, abilities
and real outcomes belong to later phases. The lobby entry remains closed.

## PHASE 2 implementation boundary

`temporal` now persists a seeded case-file variant, an immutable 2026 baseline,
the derived 2026 present, ordered 1996 interventions, per-player evidence and
a causal revision. The first three nodes are archive gate, research worker and
official report. An `INTERVENE` intent is valid only in its 1996 room and may
resolve each node once. It recomputes the present from the baseline in sequence
order without new random draws. Opening the gate makes the 2026 Secret Archive
walkable before Act III; saving the worker changes his presence and leaves an
old-badge cache in the Research Wing; correcting the report changes the 2026
archive entry. Choosing to leave a fact unchanged records the decision but
does not claim a timeline rewrite. Each material change increments one causal
revision and emits a public before/after cue.

An `INVESTIGATE` intent in the 2026 Archives grants one private case-file clue.
The projection explicitly exposes public locations, interventions and present
state, plus only the viewer's evidence. The ordinary snapshot and runner
persist and reconnect these facts. PHASE 3 turns the badge cache into a
conserved item instance and adds pickup/storage. Later phases add the
full set of causal nodes, NPC interactions, fixed facts versus official claims,
additional NPC interactions, later-act story beats and endings. The lobby stays closed.

## PHASE 3 implementation boundary

`temporal.storedItems` owns each numbered relic by a stable instance ID. Two
seeded 2026 relics have private player-linked 1996 source obligations.
`PICK_UP` changes an available 2026 instance to `HELD_2026`; time jump changes
a player's held instances to the matching year; `STORE_ITEM` requires the
designated 1996 room, a protected fixture there, and the assigned keeper for
a bootstrap relic. It records the actual placing actor and round, then makes
that same instance available in 2026 as `STORED`. The 2026 Research Wing has
the `TEMPORAL_CONTAINMENT` facility inside the existing room. Its 1996
counterpart has an ordinary protected research cabinet. Saving the worker
creates one `OLD_BADGE` instance in the 2026 wing.

`TRADE` offers a voluntary one-way transfer of a held instance, ordinary
supply or Fate to a co-located teammate. A shared decision window asks the
recipient; acceptance rechecks ownership and co-location before transferring
the original instance. Reciprocal bartering is not yet available in the
Scenario 03 UI. The `itemPools` hook contains only `PHASE_BATTERY` and
`SEDATIVE03`; a 2026 Research Wing search can draw one ordinary supply per
player, which `USE_ITEM` consumes. Numbered relics and objective artifacts
are excluded from generic grants, theft and copying: relics live in
`storedItems`, objective artifacts in `temporal.holdings`. Projection sends
only visible world relics, the viewer's held relics and obligations, and no
other player's private holdings. The lobby stays closed.

## PHASE 4 implementation boundary

Act I uses stable, once-only story IDs in `temporal.story.revealed`. The
server reveals `LOCKDOWN` on creation, `OFFICIAL_FILE` only when a player reads
the 2026 Archives file, `ARCHIVIST_CONTACT` only after a validated conversation
with Archivist 00, `FIRST_JUMP` on the first actual jump to 1996,
`FIRST_REWRITE` only after a material 2026 change, and `BOOTSTRAP_TRACE` when
a player picks up a seeded, player-linked relic. The round event hook reveals
`ROUND2_SIGNAL`; the round 3 transition reveals `ACT1_CLOSE` and opens the
Act II rooms. A skipped archive search or preserved causal decision is never
described as completed or rewritten.

Archivist 00 is a 2026 Archives NPC with a one-use, 1-AP `INTERACT_NPC`
intent. The conversation gives the actor private `ARCHIVIST_NOTE` evidence;
the public beat says only that the official report is incomplete. The NPC's
identity remains concealed. The case-file investigation remains independent
of the NPC note, and both private evidence entries are projected only to the
viewer. The story panel reads public beat IDs through the client locale
catalog. English is canonical; Chinese is keyed by the same IDs. No Act II
reveal, ZERO explanation or ending route is implemented in this phase.

## PHASE 5 implementation boundary

Act II opens the Director's Office and Main Laboratory in both years at
round 4. A validated `INVESTIGATE` action can recover 2026 surveillance in
the Director's Office, the 1996 access ledger there, or 1996 prototype
telemetry in the Main Laboratory. Each investigator receives a private
evidence ID once; the public story records that the source was found.

The server creates sealed 1996 profiles from the selected characters and
seats at run creation. Profile signatures are deterministic for the run and
hidden until the investigation. A real 1996 arrival, movement, causal
intervention or relic storage appends one ordered surveillance trace with
actor, round, room and any node choice or item instance. No round hook
fabricates an action trace. Recovered surveillance shows signatures and
provenance; the projection hides trace actors and intervention actors until
the round 6 reveal, and never sends sealed profiles. New traces appear in
the recovered feed as players create them.

At the end of round 6, the server matches sealed profiles to the current
team by character and seat, records the matches, reveals
`INTRUDERS_IDENTIFIED`, and opens a synchronized `S3_IDENTITY` sequence.
Every connected player must acknowledge the scene (or use the existing host
skip) before round 7 begins. The reveal still works when players skipped
the optional investigations: the sealed profiles exist from creation, while
the surveillance feed correctly remains empty. Act III's paradox explanation
and ending routes remain for later phases.

## PHASE 6 implementation boundary

Act III starts in round 7. The Prototype Room and Power Room open in both
years, and ZERO becomes available in the 2026 Central Hall. Its validated
`INTERACT_NPC` action gives the actor a private transcript and reveals its
public directive. The first two history routes are informational entries,
not action buttons or resolved endings.

The `PROTOTYPE_CORE` intervention exists only in the 1996 Prototype Room from
Act III. `SHUT_DOWN` is a material 1996 decision: the server rederives 2026
from the saved baseline, marks Administration integrity `FADING`, removes
the 2026 Power Room from accessible movement and time-jump targets, increments
the causal revision and adds one Collapse. The 1996 Power Room remains a room;
the fixed map still has exactly eight physical rooms. `LEAVE` records a
preserved decision without a rewrite or extra Collapse. The official accident
record remains a claim after the shutdown.

Validated investigations distinguish the official founder death, staff
casualty and prototype destruction claims from the narrower evidence that can
actually be verified. Each investigator's record remains private; the public
view receives only unlocked fact IDs and story beats. The 1996 director's
margin note is attributed to Ji Linchuan but does not reveal Archivist 00's
identity. At the end of round 8 the founder discrepancy and founding paradox
are revealed even if optional investigations were skipped, so the round 9
conclusion has a factual basis. At the end of round 9 the third possible
history becomes visible in an acknowledged `S3_THIRD_ROUTE` scene. It
transitions to Act IV without executing a route or choosing an ending; those
rules belong to PHASE 7. The public lobby stays closed.

## PHASE 7 implementation boundary

Act IV opens in round 10. Four validated 1996 decisions record the accident,
staff evacuation, Ji Linchuan's official death and the prototype's fate.
Each action rederives the 2026 state. A complete controlled accident restores
Administration integrity after an earlier prototype shutdown and removes the
one extra Collapse caused by that shutdown. The building
still has exactly eight physical rooms.

`RESOLVE_HISTORY` commits one route from the 1996 Archives. The official
route needs an official accident, an operating prototype, no evacuation or
staged death, and both assigned relic sources placed. No tomorrow needs a
real core shutdown and an erased accident record; it erases the numbered
relics and the Administration. The true route needs a controlled record,
evacuated staff, staged official death, hidden prototype and both assigned
relic sources. Only the true route reveals Archivist 00 as older Ji and his
seven-minute line. All endings use synchronized acknowledgement and
localized Results. Collapse, time and all-lost remain failure paths.

## PHASE 8 ability integration

Scenario 03 maps every roster character through the existing Core Skill
resolver and a setting-specific adapter table. The mechanical primitives
remain shared. Eight descriptions that depended on another scenario's
setting are reworded to match real Administration mechanics, with matching
English and Chinese text. Ordinary field scans use the server die and Fate
window; public anomaly events give event-triggered skills real targets.
Skill effects, help and scans pass through the existing serialized action
queue and server projection.

## Scenario 03 action dice resolution

Temporal Scan retains its separate Fate economy. Investigate, the 1996 causal
interventions, formal NPC conversations and the 2026 Research Wing supply
search now enter the shared server d6 pipeline after spending their existing
AP. Help applies to the next shared roll in the same way it already did for a
scan. Time Jump enters it only in Acts III–IV at Collapse 6 or above; the jump
and its 1996 arrival trace occur regardless of the stability result.

For Investigate, Intervene, Speak and Search, a final 1 fails and costs 1
Sanity; 2–3 fails with no extra resource change; 4–5 succeeds with no extra
resource change; and 6 succeeds and gains 1 Fate. Failure leaves evidence,
NPC testimony, the supply search allowance and causal decisions uncommitted
so the player may retry.
Time Jump always arrives: its final 1 costs 1 Sanity, 2–3 applies
`TEMPORAL_LAG`, 4–5 has no extra effect, and 6+ gains 1 Fate. Temporal lag
reduces AP by 1 in the next cycle only, to a minimum of 1. It does not stack;
a further failed jump during the affected cycle schedules the following cycle.
The status expires after the cycle it affects.
Successful investigation, conversation and intervention run their original
story and causal effects. A successful ordinary search draws one of the two
existing supplies; a perfect search opens one persisted choice between them.

The selected evidence, NPC or causal option is stored only in server-side
`rollContext` until Fate spending and reactions finish. `finishRoll` marks a
roll done before its outcome handler runs. The room's serialized queue
persists each action, answer and resulting state atomically. Reconnect
projects the same pending window; repeated answers cannot replay the action.
An in-progress Scenario 03
action roll's Fate or reaction window waits through a brief disconnect; the
host can still skip it explicitly. Existing Dice, Fate, reaction and decision
components render the process. Scenario 03 adds only
localized outcome cues and log messages, without changing the run layout.

## PHASE 9 visual contract

Both years render the same eight physical rooms and adjacency tree. The
map switches room state, NPC presence and player positions by year; the
2026 Research Wing can display Temporal Containment inside its existing
node. An accessible room is a movement button only when the server exposes
it as a target. The 1996/2026 switch changes the viewed layer, not the
player's actual year or position.

The story panel presents public beats in order, and the causal record
shows recent 1996 decisions alongside the derived 2026 status. A causal
revision briefly illuminates the map and record. Synchronized round 6 and
round 9 scenes and the three ending cards use distinct visual accents;
all information is also written as localized text. The phone map uses a
two-column tree at 320 px without adding a room or page overflow.
