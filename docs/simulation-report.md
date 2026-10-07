# Simulation report (PHASE 11)

Whole runs played through the real engine by `scripts/sim.ts`, using the
team strategy in `test/bot.ts`: investigate where a fragment is missing, repair
the nearest broken anchor, split up over the escape locks in act 3, spend Fate
only to turn a failure into a success, help a carriage-mate or dig for clues
when nothing is pressing, use items, and (with `--abilities`) use the active
ability once it can act and accept every reaction. It is deliberately naive:
it never plans across turns, coordinates positions or saves an ability for a
better moment, so real tables should do better.

Kept action logs: `docs/simulations/*.json` (2 players escaped and collapsed,
6 escaped, 10 escaped and collapsed). Each holds the seed, the characters and
every input; `test/simulations.test.ts` replays them to the recorded ending.

## Final win rates

100 runs per size with abilities, 60 without (± about 5–6 points).

| Players | 2 | 3 | 4 | 6 | 8 | 10 |
| --- | --- | --- | --- | --- | --- | --- |
| with abilities | 59% | 56% | 62% | 72% | 53% | 67% |
| without abilities | 53% | | | 57% | | 45% |

Losses are almost all Collapse reaching 12; a few small-table runs end with
everyone lost or on time.

## What the simulations found, and what changed

| Found | Change |
| --- | --- |
| 2-player tables won 0–20%: two players have 4 action points a round against the same Collapse clock as a table of 10 | 2 players get 3 action points a round, 4 in act 3 |
| 8–10 player tables won 80–85%: many hands repair fast and help a lot | anchors need 1 / 2 / 3 / 4 repairs (2–3 / 4–5 / 6–7 / 8–10 players); 6–7 players start at Collapse 1, 8–10 at 2 |
| Doing something was worse than doing nothing: a disastrous investigation or search raised Collapse for the whole train, so filler rolls lost games (10 players fell from 72% to 12% when the bot explored instead of idling) | only key tasks (repair, confront) raise Collapse on a disaster; exploring costs the explorer Sanity |
| Emergency Rations never fired: Fate spent in the Fate window, a trade or a balance went to 0 without counting | `spendFate` reports Fate reaching 0 however it happens |
| Can't Let Go / Something to Show almost never fired: item buffs last until used, so they never "end" | a buff that is used up ends like one that runs out; Can't Let Go brings it back for one more round |

Dead ends: none. Every simulated run (well over 2,000 across this phase)
reached its results; `test/system.test.ts` also proves an idle table and a
fully disconnected table finish at every size.

Idle players: with the team strategy, turns where a player had action points
but no action the rules allowed besides ending the turn are 0–0.1% (Investigate
is always open and always worth something: Fate for the dice, a core memory on
a Perfect).

## Ability coverage

`node scripts/sim.ts --coverage 8` puts every character in seat 0 of a
4-player table 8 times. All 192 abilities are resolvable and tested; these
are the ones the simulations rarely or never saw used, and why:

| Abilities | Why they are rare |
| --- | --- |
| Backbite, On Record, Now You Feel It, No Fighting, Swap Shells, Hold a Grudge, Settle Down, Void Call, Come Home, Penalty Notice, Reckoning | counters to one player's ability hurting or robbing another. Only a handful of abilities do that (Requisition, Snatch, Penalty Notice, Reckoning, Backbite), so at a random co-operative table they rarely meet. Each is proven to work in `test/abilities.test.ts`. |
| Check In | needs successes on three kinds of roll; the bot mostly investigates and repairs |
| Soft Response, Spread the Word, Shared Dream | need someone to help, or to gain a buff; rarer with the bot than with people |

Keeping the counters as they are is a design choice: they describe a real
mechanism of this scenario, it is just uncommon. Making them common would
mean re-aiming them at the train's own threats (the Inspector, echoes), which
changes what they say; that is left to the user.
