# Scenario opening cinematics

## Shared lifecycle

`RoomGate` holds `ScenarioExperience` across INTRO and all active acts. It
automatically acknowledges the existing server INTRO sequence without waiting
for the local film. Each viewer independently watches or skips; snapshots
continue updating beneath an inert, visually hidden game. There is no new server
phase, deadline, outcome rule or client copy of the reducer.

`ScenarioOpening` owns a single elapsed-time clock, captions, sound cue delivery,
focus containment, Escape/Skip, scroll restoration and the final handoff.
`definitions.ts` supplies typed scene durations, full-sentence subtitle keys,
SFX and audio mixes. World renderers are separate; only lifecycle and the title
shell are shared. Scenario 03's import paths remain thin compatibility adapters,
so its original lifecycle tests still exercise the shared implementation.

Seen entries use `[scenarioId, sessionId, viewerId]` under `fate:openings`, bounded
to forty saved entries, written on entry to prevent a reload during playback
from replaying the film. Previously shipped Scenario 03 markers remain valid.
Unavailable storage falls back to document memory. Unseen reconnects after
cycle/round 1 resume the game rather than covering an ongoing run.

Skip cancels the cinematic clock immediately, changes to the authoritative
world's ambient theme, and fades away. Natural handoff reveals the live game
under the title, without loading a second game page. New scenarios show one
twelve-second contextual hint; Scenario 03 keeps its existing location hint.
Unmount removes listeners, stops/disconnects every audio source, suspends the
one reusable context and cancels owned callbacks.

## Stories and boundaries

| Scenario | Duration including handoff | Beats | Protected information |
| --- | --- | --- | --- |
| 01 | 68 s | 00:17, impossible phones, black train, tickets, anonymous manifest, memory objects, survival protocol, rail title | No Nameless Passenger identity, assembled-memory answer, true-ending choice, round-7 fold or named forgotten player. The 6/5/6 record is labeled illustrative. |
| 02 | 60 s | Interrupted siren, city flood forecast, disabled boat, distress, rising water, unknown capacity, route objectives, rain title | No numeric capacity, passenger-shortage reveal or contribution ranking. Forecast uses static topology/elevation, never future seeded flood thresholds. |
| 03 | 81 s | Existing temporal/archive film | Original hidden-profile and ending boundaries retained. |
| 04 | 61 s | Invitation, door, ten-lot catalogue/Exit Rights, eight chips, lot silhouettes, public seats, auctioneer, spotlight title | No lot effect text, counterfeit list, sealed-bid procedure, blind tie cards or high-debt outcome. Starting chips come from AUCTION_CONFIG04, not another player's balance. |

The flood film shares `city/geometry.ts` with `HexCityMap` and reads `ZONES` and
`ADJACENT`; it introduces no second topology. Auction silhouettes share
`scenario04/lotVisuals.ts` with the actual table. The film reads localized lot
names only. None of the new renderers receives a `PlayerView`; the only dynamic
presentation input is public player nicknames for auction seats.

## Sound

One AudioManager serves every world and the persistent mute control. Themes:

- `silence` → `intro_train` → `s01_ambient`: the train's first 22 seconds use
  environmental cues only; a restrained low score arrives with the tickets.
- `intro_flood` → `s02_city_ambient`: deterministic noise-based rain/wind texture,
  low tones, interrupted alarm, distress/static, road failure and distant horn.
- `scenario03_intro` → `scenario03_2026_ambient` (or actual 1996 ambient): the
  original temporal score and nine cue types.
- `silence` → `intro_auction` → `s04_auction_ambient`: paper first, then an
  original sparse looping piano/bass/brush synthesis, chips, doors, cards and
  hammer. The auctioneer's strike briefly silences the musical bed.

Buffers and short tones are synthesized locally with deterministic sample noise;
no asset URLs, downloads, third-party music, speech generation or additional
dependency is used. Old/new pads and textures crossfade with Web Audio ramps.
Muted/blocked short effects are discarded rather than delayed until unmute.
Initial ownership is acquired before the first passive sound cue. Production
foley/voice recording and richer authored music are optional replacements for
the working procedural sound, not required runtime assets.

## Verification

Unit coverage checks the shared lifecycle, StrictMode, phase/rerender continuity,
skip, completion, cancellation, new sessions, legacy markers, initial audio
ownership, all sound types, unavailable/muted audio, bilingual placeholders and
actual rendered spoiler boundaries. The engine/replay/spec suite remains intact.

`node scripts/ui-openings.ts` runs real-time two-viewer paths for all four worlds
(`--scenario 01|02|03|04` selects one). It captures each scene at 1280, 390 and
320px, including a Chinese/reduced-motion/muted full playback, independent Skip,
same-run reload, another session, mid-film reload and SPA cleanup. It checks
element clipping, touch targets, failed requests, console/page errors, live audio
connections, unknown capacity, eight chips and Lot 01 arrival. The earlier
Scenario 03 walkthrough and the standard train/city/auction scripts use the
shared Skip control.
