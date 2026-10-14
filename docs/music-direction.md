# Scenario score direction

This replaces the placeholder oscillator beds and eight-second lounge synthesis
with 27 edited recordings by Kevin MacLeod. A score should support the fiction
and leave room for reading and discussion. Opening scenes share a musical arc;
a new subtitle, turn, bid, or snapshot does not restart the piece.

## Cue sheet

| World / public stage | Recording | Musical purpose |
| --- | --- | --- |
| 01 opening, after the train arrives | Dark Walk | Piano, organ and strings introduce an uneasy motif as the tickets turn. The first 22 seconds retain environmental silence. |
| 01 Act I | Measured Paces | Spacious, measured piano supports observation and reading. |
| 01 blackout / Act II | Lightless Dawn | Dark strings, bells and a restrained pulse deepen the identity anomaly. |
| 01 fold / cab / Act III | Unseen Horrors | Low strings, brass and percussion provide an orchestral threat for the escape. |
| 01 arrival / results | Blue Feather | Sparse descending piano makes arrival reflective rather than a victory fanfare. |
| 02 opening: alarm, city, distress | Shadowlands 1 - Horizon | Submerged, strained textures place the city under water before the danger accelerates. |
| 02 opening: water, capacity, route, title | Industrial Cinematic | Layered percussion propels the rising-water montage. |
| 02 Act I | Lost Frontier | Slow orchestral movement leaves space for rescue and exploration. |
| 02 Act II | Industrial Cinematic | Mechanical percussion supports repairs and a shrinking route network. |
| 02 Act III / boat publicly ready | The Complex (later passage) | The arrangement's stronger electronic pulse drives evacuation. |
| 02 evacuation / results | Immersed | Piano and strings release the urgency without erasing the cost of escape. |
| 03 opening: sync through corrupted records | Echoes of Time | Layered soundscape and displaced bells support surveillance and chronology. |
| 03 opening: mission and title | Decisions | A deliberate, pulsing statement introduces the players' responsibility. |
| 03 Act I, 2026 | Crypto | Suspended flute, percussion and electronics suggest a functioning but suspect institution. |
| 03 Act I, 1996 | Comfortable Mystery | Vintage electric piano makes the older institution intimate and uncanny. |
| 03 Act II, 2026 | Cognitive Dissonance (after its long fade-in) | Conflicting electronic treatments support contradictory records. |
| 03 Act II, 1996 | Darkest Child | Celesta, harp and low strings replace the electronic palette with an analogue memory. |
| 03 Act III, either era | Dark Fog | Restrained percussion and dark harmony accompany consequential rewriting. |
| 03 Act IV | Decisions | The opening's mission motif returns for the final history choice. |
| 03 surviving history / results | Despair and Triumph | Altered piano leaves the ending morally ambiguous. |
| 04 opening: invitation through lots | Night on the Docks - Piano | Noir electric piano suggests wealth, secrecy and an empty room. Paper precedes the music. |
| 04 opening: seats through title / rounds 1–3 | Covert Affair | Woody bass, brushes, electric piano and trumpet establish controlled social play. |
| 04 rounds 4–6 | I Knew a Guy | Walking bass and vibraphone emphasize negotiation and observation. |
| 04 rounds 7–9 / public Blackjack challenge | Deadly Roulette | A more active jazz groove increases the stakes without changing the world's palette. |
| 04 final settlement | Dark Standoff | Low strings interrupt the lounge mood as resources become final. |
| 04 sealed auction / showdown choice | Darkening Developments | Bass, woodwinds and percussion hold unresolved tension. No private bid affects the music. |
| 04 reveal / showdown reveal / debt ending | Oppressive Gloom | Heavy orchestral harmony gives the public verdict weight. |
| 04 exit / results | Comfortable Mystery 2 | A short electric-piano coda leaves the room quieter. |
| Failure / no tomorrow / unsold exit | Aftermath | A subdued piano soundscape acknowledges loss rather than continuing an action cue. |

Ending cinematics reuse these recordings scene by scene before the results cue
returns; their score plan is in `docs/ending-cinematics.md`.

The train's first station beats, invitation paper, corrupted-record pause, and
auctioneer's initial strike retain deliberate silence. Otherwise, transitions
are between authored recordings, with a 2.4-second linear crossfade. The old
track continues until the incoming track's play promise resolves. The score
stays below short foley; openings can lower it beneath urgent caption passages.
Game decisions select cues only from `PlayerView` public phases, public rounds,
public sequences, public boat readiness, public auction final stage, outcomes,
and the viewer's own visible era. No hidden capacity, private bids, balances,
secret evidence, or game RNG participate.

## Assets and attribution

Source: [Incompetech catalog](https://incompetech.com/music/royalty-free/).
Composer: Kevin MacLeod. License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
confirmed in the composer's [crediting instructions](https://incompetech.com/music/royalty-free/faq.html)
and the track renderer's attribution block. The catalog records each track's
ISRC and original download/source URLs. The visible **Music** menu contains the
composer, license link, modification notice, and individual source links in
both locales. Canonical recording titles remain unchanged.

`public/audio/music/` contains the deliverable MP3 loops, `CREDITS.txt` and
`SHA256.json`. Edits are selected 37–108 second passages, normalized to -18 LUFS
with a -2 dBTP limiter target, encoded as stereo 44.1 kHz / 112 kbps MP3. A
sine-shaped tail/head blend is baked into each edit; the repeated boundary
joins adjacent source samples. Jazz excerpts use longer, approximately
phrase-aligned overlap lengths. These are licensed excerpts, not original
compositions made by this project. Short synthesized foley remains separate.

Reproduction (development only; requires curl and an FFmpeg executable):

```sh
FFMPEG=/path/to/ffmpeg node scripts/music/prepare.ts
FFMPEG=/path/to/ffmpeg node scripts/music/verify.ts
```

The preparation script caches original masters in the OS temporary directory,
bounds downloads to three workers and does not change system/project runtime
dependencies. Verification checks hashes, duration, decoded sample validity,
clipping, and non-silent, continuous loop boundaries; the checked report is
`music-validation.json`. All recordings ship locally. No gameplay audio uses
third-party hosts, and no external audio service is required.

## Playback lifecycle

`MusicPlayer` owns exactly two reusable HTML audio elements routed through the
single Web Audio context. Compressed media streams on demand rather than
decoding the entire collection into `AudioBuffer`s. At most two recordings can
be audible during a transition; obsolete loads and retirement timers are
cancelled. The same cue on another snapshot is a no-op. Mute/background pause
retains the current position, and muted initial playback does not fetch music.
Autoplay rejection retries on a real pointer/key gesture. Network/decode
failure leaves the previous track playing and never blocks the game.

`ScenarioExperience` remains mounted through Ending and Results so that the
score can crossfade into a coda. Skip hands over to the *current* public stage,
even if another player has already advanced the run. Lobby, room replacement,
SPA navigation, or unmount stop media, release URLs, disconnect audio sources,
clear fade timers, and suspend the shared context. Existing bounded opening
memory and mute preference remain compatible.
