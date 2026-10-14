# Ending cinematics

Once the server has decided how a run ends, each player sees a short film
before the Story Recap. The film is presentation only. It never decides an
outcome, never sends anything to the server, and the server never waits for it.

## Flow

```
server: startEnding → phase ENDING (results already projected)
client: endingFor(view) → this viewer's film, if the outcome has one
        EndingFilm: scenes → ending card → fade to black (≈2.4 s)
        → ACK_SEQUENCE for this viewer, and the run's Results/Story Recap at once
server: every seat acknowledged (or the host skips) → phase RESULTS
```

`ScenarioExperience` stays mounted from intro to results, so it owns the film
the same way it owns the opening. It provides `EndingFilmDone`. After the film,
`RoomGate` shows that scenario's results screen in place of its ending screen.
Results are projected from the start of `ENDING`, so nobody waits for slower
players. Outcomes without a film (every failure, and Scenario 01's delete
ending) keep the existing ending screen.

## Which film

`src/client/game/ending/cinematics.ts` maps the projected view to a film. It
never copies a rule:

| Outcome | Film | Kind |
| --- | --- | --- |
| `NORMAL` | `s01_normal_escape` | world |
| `TRUE_TICKET` | `s01_ticket_true_end` | world |
| `S02_EVACUATED` + own `results[].escape` = `ESCAPED` / `ENGINEER` / `LEFT_BEHIND` | `s02_escaped` / `s02_last_light` / `s02_left_behind` | personal |
| `S03_OFFICIAL_HISTORY` / `S03_NO_TOMORROW` / `S03_DECEIVE_HISTORY` | `s03_official_history` / `s03_no_tomorrow` / `s03_deceive_history` | world |
| `S04_EXIT` / `S04_DEBT` with the public final `winnerId` = viewer | `s04_normal_exit` / `s04_debt_follows` | personal |
| any S04 outcome, viewer not the winner | `s04_no_exit` | personal |

The server's outcome already says whether the winner leaves with debt, so the
client never compares debt to a threshold. The films read only `EndingFacts`:
the viewer's own name, the public boat list, their seat number and their own
debt. No private result, settlement, commission or directive reaches another
client.

## Once per run

`sessionStorage` key `fate:ending:<sessionId>:<viewerId>:<filmId>`. It is
written when the film ends or is skipped. A refresh during the film restarts
it. A refresh after the film goes straight to the recap. A new run has a new
`sessionId`, so the film plays again. The developer preview never writes the key.

## Time and score

| Film | Scenes + card | Reduced motion | Score (scene order) |
| --- | --- | --- | --- |
| S01 Normal Escape | 41 s | 18.5 s | Measured Paces → Blue Feather |
| S01 One Ticket | 47 s | 21 s | Dark Walk (opening motif) → Blue Feather |
| S02 Evacuated | 37 s | 18.5 s | The Complex → Immersed |
| S02 The Last Light | 48 s | 23 s | Immersed, fading to silence for 2 s before the card |
| S02 Left Behind | 30 s | 16 s | Aftermath |
| S03 Official History | 41 s | 18.5 s | Echoes of Time → Decisions |
| S03 No Tomorrow | 35 s | 16 s | Echoes of Time, layers fading to silence → Aftermath |
| S03 Deceive History | 39 s | 16 s | Echoes of Time → Despair and Triumph |
| S04 Normal Exit | 32 s | 16 s | Covert Affair → Comfortable Mystery 2 |
| S04 Debt Follows | 44 s | 21 s | Covert Affair → Comfortable Mystery 2, cut by paper → Oppressive Gloom |
| S04 No Exit Rights | 37 s | 20.5 s | Covert Affair → silence → gavel → Covert Affair again |

Each film's last ~2.4 s is the fade to black. Every film is under 51 s
including that fade. All music uses the licensed recordings already in
`public/audio/music/`, through the existing two-deck `MusicPlayer` with its
2.4 s crossfade. No file was added. Each scenario's films start from the motif
of its own opening or gameplay, then move to that scenario's ending recording.
`audio.tension(level, seconds)` gives scenes and the outro a slow fade.
`audio.hush()` cuts any foley still sounding when a film closes. After the
film, `gameplayScore` brings back the existing results cue. Foley is the
existing synth `SFX`, used sparingly, on a scene's key action.

## Skip, motion and access

- Skip (top right, inside the safe area, at least 48 px) appears after 2 s.
  Escape also skips. The scene fades in about 1 s while the score falls away,
  then the recap appears. The film stays in the DOM until that fade ends.
- `prefers-reduced-motion` (or the developer toggle) keeps every scene as a
  2.5 s still frame with crossfades. The card keeps its full 6 s and the music
  is unchanged.
- The film is a modal `dialog` with a label. Captions are a polite live region.
  Each card has a kicker, title and lines, so its meaning never depends on colour.

## Checking

- `test/ending-cinematics.test.ts`: the mapping on real end states from the
  developer fixtures. One S02 run splits into different films per seat, as does
  one S04 run. The delete ending and failures get none. Another player's debt
  never reaches a viewer. Durations, a real music cue and both locales for every
  film. Once-per-run keys.
- `test/ending-film-render.test.ts`: the card is shown before the handoff, the
  handoff waits for the fade, skip fades the score over 1 s and hands back once,
  and no foley sounds after close.
- `scripts/ui-endings.ts [--watch]`: real browsers against `APP_URL` for S01
  ticket, S02 last light, S03 deceive and S04 debt. The film appears on its own,
  exactly one recording is audible, it reaches its card, hands over to the
  recap, and a refresh doesn't replay it. Layout is checked at 390 and 320 px.
- `scripts/ui-music.ts`: the film's cue takes over from gameplay on the same two
  decks, and after skip the results cue returns.
- `/developer` → **Ending cinematic preview**: plays the real `EndingFilm` for
  all 11 films, with a reduced-motion toggle. It respects the global mute.
