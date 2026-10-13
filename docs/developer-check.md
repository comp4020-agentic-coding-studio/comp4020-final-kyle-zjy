# Developer / Assignment Check

Entry: the secondary home-page action. Index route: `/developer`. Test room
route: `/developer/room/:code/:seat` (seat 0–2). Both routes work on direct
HTTP loads and refresh. English remains the default; all labels, instructions
and errors have Chinese equivalents.

Each scenario card has a grouped checkpoint selector and one launch action,
rather than a wall of small buttons. Groups are normal start, mid-game, key
events, and final stages/endings. A separate section replays the four existing
openings and links to transition, ending, recap, private-card, dice and trade
checks. No opening sequence or music asset was replaced.

## Checkpoint inventory

| Scenario | Checkpoints |
| --- | --- |
| 01 | Normal start; Round 4 Inspector/blackout; Round 6 emergency-brake vote; Round 7 Reality Fold; three repaired anchors; two engaged locks and the playable final lock; nameless-passenger choice; extra-ticket ending; trade offer. |
| 02 | Normal start; high water; engine/fuel installed with navigation held at the pier; capacity reveal; boarding vote; final generator restart without a control chip; evacuation ending. |
| 03 | Normal start; 1996/2026 jump; report correction/Timeline Shift; numbered relic source placement; Time Echo/archive traces; final Archives; official history, no tomorrow and deceive-history endings; public Story Recap; an investigation die/Fate window. |
| 04 | Normal start; ordinary fourth-round auction; legally purchased counterfeit held for use; accepted Blackjack; Round 10 settlement; final sealed bidding; tied-bid five-card showdown; high-debt ending; private investigation intel. |

The existing Scenario 03 implementation has a `ROUND5_ECHO` archive-trace story
beat and a Clock Echo event, not a separate mechanic named Time Echo. The
checkpoint explicitly uses the real archive-trace beat and labels that choice.
It does not invent a new echo subsystem.

## Server construction and authority

The client submits only a closed `CheckPresetId` to `POST /api/developer/runs`.
Extra state/seed/round fields are rejected. Every launch creates a new room
with three genuine anonymous player identities and the existing character
roster. Nothing mutates a previously joined normal room.

`server/developer/fixtures.ts` starts from `createGame` with a fixed server
seed, starts the engine, acknowledges the intro, and uses existing actions,
`hostSkip`, round progression, repair, votes, pickup/jump/storage, interventions,
resolve-history, auction, final settlement/bid/reveal, and Blackjack handlers.
Scenario 04 developer rooms also expose an Auction Item Sandbox in the controls
menu. Its server-validated intents grant one selected genuine or counterfeit
ordinary item to the current seat and generate a seeded nine-lot preview. Only
the developer projection includes the preview, seed, and counterfeit labels;
ordinary player snapshots omit them. Quick buttons cover Blank Cheque, Broken
Stopwatch, Ownerless Number, Night Ledger, Burnt Playing Card, and Last Match.
Fate/reaction windows settle through the same resolver as normal play.

Fixture preparation is explicit rather than a claim that the entire preceding
run was played unassisted. Train/temporal construction replenishes resources
and bounds Collapse while advancing unrelated rounds, then places actors at
the checkpoint with usable AP. Train final setups provide the prerequisite
memory fragments/core memories and consolidate the real repaired keys.
Boat setups move unique core parts out of world caches into installed/held
state, prepare facility progress/done flags and passes, and move actors to the
pier/power station. Capacity stays server-seeded. A completed countdown is
prepared before the real boarding handler is invoked. Transport indices and
1996/2026 positions are kept consistent. Auction rounds advance by the actual
pass-and-end-turn handler; Round 10 retains its real Collapse, original chip
balances, conversion records and final-state machine. Counterfeit use starts
with an item won through an actual auction, not a duplicated displayed item.

The prepared state is committed as both `initial_json` and `state_json` in the
existing GameStore transaction. Subsequent actions and inputs replay from that
prepared snapshot; construction steps are not masqueraded as a full normal-run
action history. Preparation failure rolls back the session and removes only
the newly allocated room/identities. No database migration is required.

All subsequent player actions use the unchanged authoritative WebSocket
validate/reduce/persist/broadcast path. `POST /api/developer/rooms/:code/advance`
authenticates an existing test seat, requires the persisted
`flags.developerCheck === 1`, and invokes the existing default/host-skip engine
step. It rejects ordinary rooms and tokens from outside the room. It accepts
no arbitrary state patch, die value, phase or final bid.

## Manual seats and isolation

The page explicitly says these are three manually controlled test seats, with
no automated players. The selected seat supplies its own authenticated token
to RoomGate. A link opens the next seat in another tab; selecting an already
connected seat follows the existing session-replacement behavior. Each socket
receives only its normal projected view. Sealed bids, private intel, opponents'
Blackjack/five-card data and temporal evidence remain server-projected.

Credentials are held in a separate bounded `fate:developer:runs` browser entry
(last eight rooms), containing test identities and routing metadata, never
full game snapshots. The normal `fate:token`, nickname and rejoin room are
preserved. Checkpoint entry marks only its new opening keys seen; normal-start
and opening-replay entries use fresh sessions and the existing cinematic.
Refreshing a test URL reconnects the same selected seat.

A seat change clears snapshots, cues and pending client requests; callbacks
from the old socket are ignored. RoomGate also refuses to render a view whose
viewer ID differs from the explicitly selected test identity. The UI therefore
cannot briefly show the previous seat's secrets while the new socket connects.

Developer fixtures keep seats logically present for manual control, while the
lobby projection continues to report actual socket connectivity. Disconnects
in these marked rooms do not auto-pass seats or transfer the host. Idle test
runs are evicted from memory and remain in SQLite for reconnect. These special
presentation/check semantics do not apply to normal rooms.

The persistent test toolbar exposes return, seat selection, inspection and a
collapsible tools menu. Returning from a test or its normal result/leave action
goes to `/developer`; the index's Back to home returns to `/`. Existing Story
Recap markup was extracted from Private03 and reused, and private drawers,
dice animation, trade decisions, openings and audio remain the actual game UI.

## Reused helpers and validation

`rigNextDie` and Scenario 03's `successfulAction03`, `settle03`, `endTurn03`
were extracted without behavior changes into `server/testing/steps.ts`.
`test/helpers.ts` and `test/scenario03-helpers.ts` re-export the same functions,
so both the developer factory and existing tests share the real resolvers.
The test-only `Table`/`seatsFor` fixtures remain the unit-test entry points;
production code never imports files from `test/`.

`test/developer.test.ts` checks construction/continuation of all checkpoints,
lock/boat/history/final-auction behavior, hidden hands and bids, persistence,
replay, invalid requests, ordinary-room protection, cleanup and idle eviction.
`test/developer-session.test.ts` checks normal identity preservation, stale
socket rejection, reconnect credentials and opening memory.

With a built running application, `node scripts/ui-developer.ts` launches all
36 presets through the real page/API in isolated English desktop and Chinese
phone contexts, checks server-projected identities/private data, opening reuse,
seat switch/reload, default advance, return paths and ordinary entry dialogs.
It checks 1280/390px plus representative 320px screens for clipping and 48px
controls and writes screenshots to `/tmp/fate-developer-ui`.

## Files in this change

- Client entry/routing: `client/App.tsx`, `client/router.ts`,
  `client/screens/Landing.tsx`, `client/screens/RoomGate.tsx`, `client/store.ts`.
- Client checks: `client/developer/DeveloperCheck.tsx`, `DeveloperRoom.tsx`,
  `session.ts`, `client/styles/developer.css`, and the reused public recap in
  `client/game/scenario03/Private03.tsx`.
- Localization: `client/i18n/developer-en.ts`, `developer-zh-CN.ts`, `index.ts`,
  `types.ts`, and `shared/i18n/zh-CN/messages.ts`.
- Shared/API/state preparation: `shared/developer.ts`,
  `server/developer/fixtures.ts`, `service.ts`, `server/testing/steps.ts`,
  `server/game/store.ts`, `runner.ts`, `server/http.ts`, `server/rooms/hub.ts`.
- Verification: `test/developer.test.ts`, `test/developer-session.test.ts`,
  existing helper re-exports in `test/helpers.ts` and `test/scenario03-helpers.ts`,
  and `scripts/ui-developer.ts`.
- Documentation: this guide plus `docs/architecture.md`, `game-state.md`,
  `database-schema.md`, `visual-direction.md`, `localization.md`, `build-log.md`.

Client/shared/server paths above are relative to `src/`; tests/scripts/docs are
relative to the repository root.
