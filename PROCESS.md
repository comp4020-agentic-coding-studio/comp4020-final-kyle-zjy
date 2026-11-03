# Process

## Stack: fitting the machine instead of fighting it

My first plan was Next.js with Supabase, because it would have given me auth,
realtime and a database for free. Reading `fly.toml` ended that plan: one
256 MB machine, one volume at `/data`, and no separate database server. I
switched to a Vite + React client built to static files, plus one Node process
running Hono, `ws` and SQLite (`node:sqlite`) on `/data`. The whole game
shipped in that shape in [3a614a6](https://github.com/comp4020-agentic-coding-studio/comp4020-final-kyle-zjy/commit/3a614a6).

I chose WebSockets over server-sent events or polling because a party game
talks both ways at high frequency. Every press is an intent going up, and
every accepted action is a new per-player view coming down. One socket
carries both, with an action id and a state version, so the server can refuse
duplicates and stale presses. The cost is that I own reconnects and presence
myself. Identity is a nickname plus a session token in the browser, with no
accounts, because nobody signs up to play a party game for one evening.
Persistence is write-through: every accepted action and its resulting state
go into one SQLite transaction before anything is broadcast. A restarted
server rebuilds each run from the database, and `test/store.test.ts` holds it
to that.

The trade-off of one process is that nothing runs in parallel, so all
correctness lives in a serialised per-room queue. In exchange, the app idles
far below 256 MB, survives Fly stopping the machine when nobody is playing,
and needs no infrastructure beyond what the course provides.

## Workflow: phases, a harness, and a second agent

I planned the build as PHASE 0–11, from architecture and shared types,
through the lobby, the 192-character roster and the engine, to balance. For a
while I let the agent run several phases unattended. I couldn't judge a
decision before ten others depended on it, so I made it stop after every
phase, report done / files changed / not done / next, and wait for me to say
"continue". That is slower, but every direction change happened at a
checkpoint I had actually reviewed.

`CLAUDE.md` became the harness. I added rules there when something went
wrong, not when I imagined it might:

- Tailwind utilities silently lost to unlayered CSS, so custom CSS now goes in
  `@layer`.
- A `min-h-11` utility shrank buttons below the 48 px target, so it is banned
  on buttons.
- Balance changes judged by feel kept going wrong, so tuning is now judged
  with `pnpm sim`.

After scenario 01, I brought in Codex for scenario 03 and wrote it a handoff
in [cfa1891](https://github.com/comp4020-agentic-coding-studio/comp4020-final-kyle-zjy/commit/cfa1891):
`AGENTS.md`, `PROJECT_RULES.md` and `CODEX_HANDOFF.md`. Its rules split into
two layers. Product rules (server authority, 2–10 players, 192 shared
characters) apply to every scenario. Working rules are per agent. The mistake
I made was letting `AGENTS.md` keep the stale template text while
`CLAUDE.md` moved on. They now mirror each other, and the harness says so.

## Testing: from exhaustive to risk-driven

Early on, I asked for exhaustive tests because the foundations were moving.
By PHASE 5, re-testing unchanged roster data and avatar files cost time and
found nothing, so I wrote a risk-driven policy into `CLAUDE.md`. New logic in
the state machine, concurrency, hidden information, reconnects, abilities,
seeded randomness and win/loss still gets strong tests, and the
security-sensitive ones get mutation checks.

That focus paid off. Tests caught a field that told each player whether their
own secret message was true. They caught two players both ending the same
turn. Simulation found the worst incentive: a disastrous investigation raised
Collapse for the whole train, so idling beat exploring. 10-player tables fell
from 72% to 12% when the bot explored instead of idling. Moving that cost onto
the explorer's own Sanity fixed it. More than 2,000 simulated runs finished
with no deadlock.

## Deployment found what local runs couldn't

On the live site, a refresh by the active player skipped their turn
immediately. An old "skip if offline" check was bypassing the 15-second grace
period. I fixed it in [8bea061](https://github.com/comp4020-agentic-coding-studio/comp4020-final-kyle-zjy/commit/8bea061)
with regression tests. I restored the old code to watch them fail, then
redeployed and verified the fix by disconnecting for eight seconds. Fly's proxy
also takes about five seconds to report a dropped socket, so
[71602e7](https://github.com/comp4020-agentic-coding-studio/comp4020-final-kyle-zjy/commit/71602e7)
gave the presence specs real network time without changing any rule.

The ten-player spec stayed flaky after
[98294b1](https://github.com/comp4020-agentic-coding-studio/comp4020-final-kyle-zjy/commit/98294b1)
made it wait for a fresh snapshot per turn. Raising the wait to ten seconds
didn't help either. Logging the last snapshot on a timeout showed the real
cause: when seat 0 moved first, the test had already consumed the very
snapshot it was waiting for. [b8e621c](https://github.com/comp4020-agentic-coding-studio/comp4020-final-kyle-zjy/commit/b8e621c)
fixed the test's logic, not its timeout.

## Breadth, and one thing I took out

Scenarios 02–04 reused the engine, the characters and the realtime layer, and
added only their own rules and content. A skill is data (trigger, target and
effect primitives) with a per-scenario adapter, so 192 abilities work in four
scenarios without per-character code. Later work went into presentation:
openings, music, ending films, a timeline dossier, and an onboarding guide.
Each one checks that it reads only the projected state.

I also built a standalone poker toolbox
([2777d4b](https://github.com/comp4020-agentic-coding-studio/comp4020-final-kyle-zjy/commit/2777d4b))
and later removed it
([38be9ab](https://github.com/comp4020-agentic-coding-studio/comp4020-final-kyle-zjy/commit/38be9ab)).
It served none of the five promises in the README, so it went. A test now
checks that its retired routes stay closed and that old stored data isn't
exposed.

## What I would keep

Using an agent well was never about producing more code. It was about making
decisions visible, turning failures into rules, and requiring evidence: a test
that fails without the fix, a simulation number, a screenshot at the marking
size. The agent gave me speed and breadth. Choosing the trade-offs, deciding
which tests were worth their cost, and noticing when a correct rule created a
bad incentive stayed my job.
