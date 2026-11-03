# Fate Instance

A hidden-role party game for 2–10 people, each on their own phone around one
table. Your zodiac sign and MBTI type pick one of 192 characters, each with one
ability, in one of four scenarios: a last train, a sinking city, a lab looping
between 1996 and 2026, and an underground auction.

## What good means for this app

A party game like this fails socially before it fails technically. If one
screen lags, the table stops talking. If a secret leaks, the round
is spoiled for everyone. If a refresh loses a seat, the night is over. So I
judged it against five promises, in this order:

1. **Fair.** The server decides every roll, turn and outcome. A phone sends
   only intentions ("end my turn"), never values, and receives only what its
   player may know.
2. **Shared.** A move on one phone shows on every other within about a
   second, with no reload.
3. **Durable.** A refresh, a dropped connection or a restart of the machine
   never costs a seat or a run.
4. **Readable at a glance.** Every state is written in words as well as
   colour, every button is at least 48 px, and nothing clips between 320 px
   and 1920 px.
5. **Worth replaying.** No table size always wins or always loses, and no
   strategy wins by doing nothing.

## Enforced and judged

The first three promises, and most of the fourth, are **enforced**:

- `spec/game.test.ts` and `spec/promises.test.ts` run against the live app
  over WebSocket. They check that only the active player can act, that two
  simultaneous presses apply once, that a refresh keeps the seat and the
  turn, that a new connection is handed the committed state, and that in all
  four scenarios no player's messages carry another player's secrets.
- `spec/rooms.test.ts` checks that a change reaches others within 1000 ms.
- `test/store.test.ts` restarts the server against the same database and
  expects the identical run back.
- `scripts/ui-marking.ts` opens 1920×1080 and 390×844 side by side and fails
  on clipping, small targets, or a turn change slower than 1.5 s.

`CLAUDE.md` turns each promise into rules the coding agent must follow, such
as "no client-sent dice" and "never send hidden information and hide it with
CSS".

The fifth promise is **judged**, because balance can't be asserted. I judged
it with simulation instead of opinion: `pnpm sim` plays thousands of
seeded games through the real engine. Results and the rule changes they
caused are in [docs/simulation-report.md](docs/simulation-report.md). Visual
quality is judged from screenshots at each marking size.

## Sources

- The course brief and `fly.toml`. One 256 MB machine and one volume decided
  the stack, as argued in [docs/architecture.md](docs/architecture.md).
- WCAG 2.2 for contrast (AA), meaning not carried by colour alone, and
  touch-target size. These are the basis of promise 4 and
  [docs/visual-direction.md](docs/visual-direction.md).
- My own playthroughs. They found what simulation can't: the Sunken City
  water rose too fast to plan around, and Incident Zero's labels told players
  what the engine knew rather than what to do next. Both were changed
  ([docs/build-log.md](docs/build-log.md)).

## Left out on purpose

- **Accounts.** A player is a nickname plus a session token kept in the
  browser. Asking friends to sign up kills a party game, and nothing here
  needs an identity beyond one evening.
- **Turn timers.** Countdowns skipped people who were still reading. The
  host can move a stalled table along instead.
- **Next.js and Supabase.** That was my first plan. It doesn't fit 256 MB or
  the single volume.
- **Chat and voice.** Everyone is in the same room.

How it was built is in [PROCESS.md](PROCESS.md). The architecture is in
[docs/architecture.md](docs/architecture.md).
