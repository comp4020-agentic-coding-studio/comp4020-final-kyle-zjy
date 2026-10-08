# Skills in scenario 01 (PHASE 8)

All 192 abilities run through the Skill Resolver as data: a trigger, a target
rule and a list of `Effect` primitives, each handled by one shared handler.
No character has its own code. A skill's player-facing `description` is the
source of truth for what it does; where the PHASE 2 wording referred to
something this scenario doesn't have, the skill was re-worded (see the table
at the end) so that the description and the behaviour match exactly.

## Glossary: what the generic words mean on train N13

| Word in a description | Meaning in the engine |
| --- | --- |
| **roll** / **ordinary roll** | an action roll: Investigate, Search, Repair, Confront (and ticket checks). Event group rolls and forced quick rolls are not "ordinary". |
| **small roll** / **quick roll** | a d6 with no Fate or reactions (`quickRoll`); 4+ succeeds |
| **risk roll** | a quick roll that costs 1 Fate on a failure, and 1 Fate and 1 Sanity on a disaster |
| **contest roll** | both sides quick-roll; higher wins, ties are a draw |
| **reward** | Fate, Sanity or an item a player gains from a roll's outcome, a public event, or a clue (`reward()` in `outcomes.ts`; event effects that gain). Ability-to-ability transfers are not rewards. |
| **failure penalty** | what a failed or disastrous roll costs its roller (`penalty()` in `outcomes.ts`) |
| **public event** | the round's event card (and the round-6 brake vote) |
| **random / extra event** | an extra card from the act's pool, resolved at once for the named participants without touching the deck |
| **small event** | an extra INSTANT or GROUP_ROLL card |
| **negative effect** | Fate loss, Sanity loss, a negative status, or Fate/items taken, aimed at one player |
| **attack** | a negative effect whose source is another player's ability |
| **buff** | a positive status |
| **task** | a goal drawn from: succeed on a Repair roll, recover a memory fragment, help another passenger, step into a carriage you haven't visited; it pays out when met before its deadline |
| **bond** | a link between players (`state.bonds`) that pays when its condition fires |
| **special rule** | a temporary rule modifier (`state.ruleMods`) |

## Pipelines

- **Incoming negative effect** (`intercept.ts`): a single-target negative
  effect that would wake a reaction (`NEGATIVE_EFFECT_TARGETS_SELF / _ANY`,
  `ATTACKED_BY_PLAYER`, `FATE_THEFT_ATTEMPTED`) is parked as
  `state.pendingEffect`; each holder is asked in turn; then it lands — maybe
  cancelled, reduced, redirected or copied back. Other effects in the same
  list carry on. Only one effect is parked at a time.
- **Ability declared**: an active ability with chosen targets wakes
  `TARGETED_ABILITY_DECLARED` holders before its effects apply (refuse,
  retarget, cancel a theft).
- **Event revealed**: a drawn public event wakes `EVENT_REVEALED` /
  `CHOICE_EVENT_REVEALED` holders before it resolves (cancel, redraw, soften,
  step out, put to a vote, decide it).
- **After-the-fact triggers** (`triggers.ts`): gains, buffs, rewards, helps,
  zero Fate, expiring statuses, abilities used, conditions met. Events queue
  in `state.triggerQueue`; the flow loop asks REACTION holders one at a time
  when no window is open. PASSIVE abilities fire on their own (no question):
  they are once per run and only ever help their owner.
- Reaction windows for abilities with a chosen target list one "Use it on X"
  option per legal target.

## Stored, armed and previewed

- `armed` effects sit on a player until a moment: the next roll (wager,
  all-in, doubled rewards, bonus on next reward, safety rope), and are shown
  as statuses.
- A **recorded result** (`storedResult`) is offered in the player's next
  Fate window as "Use your recorded N".
- **Preview roll** fixes the raw value of the player's next roll now, so the
  preview is exact (`nextRaw`).

## Re-worded skills

Each skill below depended on something this scenario doesn't have. It was
re-worded into a real equivalent here, keeping the character concept. "Was"
is the PHASE 2 description; "Now" is the description players see, which the
effects match exactly.

| Character | Was | Now | Why |
| --- | --- | --- | --- |
| aries-istj | If you are the first player to complete a task this round, gain 1 extra Fate. | If you are the first passenger to succeed on a roll this round, gain 1 extra Fate. | The scenario has no generic tasks; succeeding on a roll is its equivalent first-to-act moment. |
| aries-estp | Right after another player uses an ability, you may cut in and act at once. | Right after another player uses an ability, gain 1 action point. | Players can't act out of turn here; an extra action point is the closest real "act at once". |
| taurus-entj | Take 1 temporary resource from each of two different players. Nobody can be taken below 0. | Take 1 Fate from each of two players who have some. Nobody can be taken below 0. | There are no temporary resources; Fate is the shared resource players hold. |
| gemini-entp | After your public choice is locked in, change it once. | When everyone has answered a vote or choice, you may change your own answer before it settles. | Public choices are votes and everyone-chooses events; this lets its holder revise one before it settles. |
| gemini-infp | When an either-or event appears, see the full outcome of both options before you choose. | When an either-or event is revealed, you decide it for everyone. | Event cards already show both outcomes; deciding the event for everyone is what seeing ahead buys. |
| gemini-entj | Two chosen players make the same kind of roll. You choose which result counts. | Two chosen players each make a quick roll. You choose which result counts; it resolves as an Investigate where that player stands. | "The same kind of roll" had no outcome to count toward; an Investigate where the player stands gives it one. |
| gemini-estp | Swap the ordinary roll results two legal players have just made. | When a roll is about to resolve, it takes the best result anyone has rolled this round. | Two fresh ordinary rolls by two players almost never coexist; the round's best roll is always defined. |
| gemini-istp | When a transferable temporary item is about to go to another player, take it yourself. | When another player gains an item as a reward, take it from them. | Items aren't handed over mid-transfer; an item gained as a reward is the moment this answers. |
| cancer-intp | Give up the rest of your actions this round. You are immune to ordinary negative effects for the rest of the round. | Give up the rest of your actions this round. You are immune to negative effects until the round ends. | Kept as written, with the immunity lasting exactly to the end of the round. |
| cancer-estj | Cancel a swap or transfer between two players before it resolves. | When an ability that would move Fate, items or statuses between players is declared, cancel it. | Swaps and transfers between players are abilities, so it answers them as they are declared. |
| cancer-istp | When you receive an ordinary negative status, swap it for another replaceable status you have. | When a negative effect is aimed at you, give up one of your buffs to cancel it. | There is no "replaceable status" slot; trading a buff away to cancel the hit is the equivalent. |
| leo-intj | Pick the next public event that has chosen participants. You are always one of them. | You alone decide the next public event that asks for a choice. | Public events include everyone; deciding the next choice event alone is the real way to lead it. |
| leo-entj | Choose a player. You pick the legal target of their next ordinary action that needs one. | Choose a player. They move one carriage toward you. | Ordinary actions have no target to dictate except Help; moving the player is a real command. |
| leo-infp | When you are the only player a public event targets, gain 1 extra Fate. | When you are the only player who gains from a public event, gain 1 extra Fate. | Public events never target one player; being the only one who gains is the equivalent. |
| leo-enfp | After you successfully complete a random event, immediately trigger an extra small reward event. | After you succeed on a roll two rounds running, draw an extra reward event for yourself. | Events don't have individual success; a success streak is the trackable equivalent. |
| leo-isfp | Turn down a reward you are about to receive. Your next legal reward is doubled. | When you gain a reward, give 1 Fate back. Your next roll's rewards are doubled. | Rewards can't be refused before they land; giving 1 back is the equivalent cost. |
| virgo-intp | Cancel a special rule effect that has just triggered, if it can be cancelled. | When a public event is revealed, cancel it before it takes effect. | Special rules don't fire as discrete effects; cancelling a public event as it appears is the real equivalent. |
| virgo-istj | Send one reward from last round that a player qualified for but never claimed back into settlement. | Choose a player. Anything waiting for them in a later round (set-aside gains, a prepared shield) arrives now. | Rewards are never left unclaimed; things set aside for later rounds are what can arrive early. |
| virgo-estj | Choose a player who has targeted the same player twice this round. They lose 1 Fate. | Choose a player whose abilities hurt other players twice this round. They lose 1 Fate. | Targeting the same player twice is rare and harmless; attacks are what this calls out. |
| virgo-esfp | Call for a group check. If the majority agrees, the current public event is re-drawn once. | Call a vote. If the majority agrees, the next public event is thrown out and replaced. | There is no current event during turns; the next event is what a vote can throw out. |
| libra-infj | End one ordinary opposition status currently active between two players. | Choose two players. Each is cleared of one ordinary negative status. | There is no opposition status between players; clearing negatives is the reconciling equivalent. |
| libra-infp | When a player attacks you, turn their action into a harmless task chosen by the train instead. | When another player's ability would harm you, it is cancelled and you each gain 1 Fate instead. | There are no train-chosen tasks to convert into; cancelling and paying both is the peaceful equivalent. |
| libra-istj | When two players meet the same condition, raise the smaller reward to match the larger one. | When a player gains a reward, the player with the least Fate gains the same (up to 2 Fate, or the same item). | Two players never meet one condition at once; matching a reward for the poorest player is the equivalent. |
| libra-istp | When two players' abilities directly contradict each other, both are cancelled. | When an ability that would take Fate, Sanity or items from a player is declared, cancel it. | Abilities never contradict each other directly; cancelling a declared theft is a real conflict to settle. |
| libra-isfp | Step out of a player-versus-player event that allows it, and gain 1 Fate. | When a public event is revealed, step out of it and gain 1 Fate. | There are no player-versus-player events; stepping out of any public event is the equivalent. |
| scorpio-intj | Secretly choose another player. The next time they gain Fate as a reward, you gain 1 Fate too. | Secretly choose another player. The next time they gain a reward, you gain 1 Fate. | Kept, as a one-way secret bond that pays once. |
| scorpio-istj | Record a copyable effect another player uses on you. Later, you can send the same kind of effect back. | When another player's ability hurts you, it still lands, and the same effect hits them too. | There is no later moment to send an effect back; it rebounds at once instead. |
| scorpio-esfj | Form two hidden pairs of partners at random. Pairs that meet the train's condition are revealed and rewarded. | Two random pairs are secretly bonded for 3 rounds. The first time a partner succeeds on a roll, the other gains 1 Fate. | The train has no hidden condition to meet; a partner's first success is the condition. |
| scorpio-esfp | Players in the top half of the standings randomly swap one temporary status with players in the bottom half. | The players with the most and the least Fate swap one temporary status. | There are no standings; Fate is the measure, so the richest and poorest swap. |
| sagittarius-infp | Refuse an event assigned to you, if it can be refused, and enter a different random event instead. | When a public event is revealed, step out of it and draw an extra event for yourself instead. | Events are never assigned to one player; stepping out and drawing your own is the equivalent. |
| sagittarius-enfj | When you enter a solo reward event, bring another player in with you. | When you gain a reward, a chosen player gains the same (up to 2 Fate, or the same item). | There are no solo reward events; sharing your reward with a chosen player is the equivalent. |
| sagittarius-enfp | Immediately enter a random minigame event. | Draw an extra group-roll event for yourself. | The scenario has no minigames; group-roll events are its closest kind. |
| sagittarius-istj | Each new type of event you complete earns a stamp. At 3 stamps, trade them in for 2 Fate. | Succeed on three different kinds of roll (Investigate, Search, Repair, Confront) and gain 2 Fate. | Events don't have types you complete; kinds of successful roll are the trackable equivalent. |
| sagittarius-istp | When you fail an event roll, leave the event at once and take none of its failure penalty. | When you fail a roll, take none of its penalty. | Event rolls are quick rolls without reactions; ordinary rolls are what it can answer. |
| capricorn-intp | Compare the base risk of two legal actions before deciding which one to take. | See the value of your next roll before you decide what to do. | Actions don't have a stated base risk; seeing your next die is the real information to decide with. |
| capricorn-entp | Spend 1 Fate to regain a character ability you have already used. | Spend 1 Fate to restore another player's ability that is already used. | Using it burns it, so it could never restore itself; restoring another player's ability is what it can do. |
| capricorn-esfp | At the end of the round, the last player to succeed on a roll and you each gain 1 Fate. | At the end of the round, the last player to succeed on a roll and you each gain 1 Fate. | Kept, with the timing (round end) made explicit. |
| aquarius-intj | Change one modifiable number rule by +1 or -1 for this round. | Choose one rule change for this round: +1 to every roll, +1 action point for everyone, or Fate can add up to 3 to a roll. | The scenario's numbers that can bend are listed as three rule changes. |
| aquarius-entj | Next round, every player plays under the same random rule modifier. | Next round, a random rule change applies to everyone. | Same three rule changes, one drawn at random. |
| aquarius-entp | When an ordinary event is revealed, it loses one random non-core restriction. | When a public event is revealed, every loss or Collapse rise it causes is 1 smaller. | Event cards have no restrictions to drop; their losses and Collapse rises can be softened. |
| aquarius-infp | Ignore one ordinary group negative effect that hits most of the players. | You will shrug off the next negative effect that hits most of the table. | Group effects are never parked for reactions, so it could never fire; as an active it arms the same protection. |
| aquarius-esfj | Three random players form a network. When one of them first gains a reward, each of the others has a chance to gain 1 Fate. | Three random players are bonded this round. The first reward any of them gains pays each of the others 1 Fate. | "A chance to gain" was undefined; it pays each of the others 1 Fate. |
| aquarius-esfp | This round, several players' unused active abilities are randomly reassigned. Ownership returns next round. | This round, several players' unused active abilities are randomly reassigned. Ownership returns next round. | Kept, with ownership returning at the start of next round. |
| pisces-intj | Decide whether your next random event leans towards a reward or a challenge. | Decide whether your next random event leans towards a reward or a challenge. | There is one public event per round, so choosing what kind comes next is the equivalent. |
| pisces-intp | Look at one hidden effect and decide whether it triggers as written. | Look at one hidden effect and decide whether it triggers as written. | Events have no hidden effects; seeing the next event and deciding whether it happens is the equivalent. |
| pisces-entp | When you reveal one of your ordinary rolls, show a decoy result. The true value applies when it resolves. | Show the Inspector a fake result: your next ticket check passes whatever you roll. | The log and dice are public, so a decoy can't hide anything; passing the Inspector with a fake is a real bluff. |
| pisces-infj | See the full details of one upcoming event that will target you. | See the next public event in full. | Events never target one player; seeing the next one in full is the equivalent. |
| pisces-infp | After you fail a roll, postpone it and make it again next round. | After you fail a roll, take none of its penalty, and gain 1 extra action point next round. | Rolls can't be postponed to another round; no penalty plus an extra action next round is the equivalent. |
| pisces-istj | Your first successful roll is recorded. Later, you may reuse that result once. | Your first successful roll is recorded. Later, you may use that result once in place of a roll. | The two halves are one effect: record the first success, offered once in a later Fate window. |
| pisces-estj | Immediately end one ongoing effect on the whole table that is allowed to be ended. | End every rule change in play, and clear one ordinary negative status from each player. | "Ongoing table effects" are rule changes and negative statuses; it ends those. |
| pisces-istp | Skip the current event if it can be skipped, and stay hidden until the next round begins. | Skip the current event if it can be skipped, and stay hidden until the next round begins. | Events can't be skipped by one player; stepping out and being untouchable until next round is the equivalent. |
| pisces-estp | Generate two legal events and take the one with the higher potential reward. You must accept its risk. | Generate two legal events and take the one with the higher potential reward. You must accept its risk. | Kept: two extra events, the more rewarding one is taken. |

## Passive or asked

PASSIVE abilities fire on their own only when they are a pure gain for their
holder with no reason to save them for a better moment (CLAUDE.md). Of the 23
passives, 22 qualify: their gain is the same whenever it fires, or the
description fixes the moment ("your first failure", "your first success").
taurus-infp **Can't Let Go** does not (extending a strong buff is worth more
than a weak one), so it is a REACTION: its holder is asked each time.

## Scenario 02 (the sinking city)

The same 192 core abilities run in the city. Scenario 01's wording carries
over, except where it names the train. Those six read differently here
(`src/shared/game/scenario02/skill-adapters.ts`):

| Character | Scenario 01 | Scenario 02 | Why |
| --- | --- | --- | --- |
| aries-istj | "first passenger to succeed" | "first player to succeed" | passengers are a train word |
| aries-isfp | "The train offers two random instant boons" | "The city offers…" | same boons, no train |
| taurus-istp | "a player in your carriage" | "a player in your zone" | the city has zones; "same carriage" checks the same node in both |
| leo-entj | "move one carriage toward you" | "move one zone toward you" | one walkable step along standing roads toward the user (`movePlayer` hook) |
| capricorn-istp | Fixed Anchor | Hold the Line | the name only; anchors belong to the train |
| pisces-entp | Fake Result: "your next ticket check passes" (a scenario-01 behaviour) | Brave Face: "Gain a shield that blocks the next negative effect on you." | there is no ticket check in the city; it runs its plain core (a one-hit shield) |

Generic words mean in the city:

- **Event** (preview, redraw, change, skip): the city's own deck (`scenario02/events.ts`).
- **Task goals**: "find a boat part or a pass" stands for scenario 01's fragment goal, and "reach a zone you haven't been to" for its new-carriage goal.
- **Items**: an item granted by an ability comes from the city's items.
- **"Three kinds of roll"**: counts the city's rolls. Search, investigate, repair and rescue or salvage stand for scenario 01's investigate, search, repair and confront.

## Scenario 03 (Incident Zero)

`SCENARIO03_SKILLS` resolves the same 192 Core Skills through the shared
resolver. It inherits setting-neutral wording from the complete Scenario 01
catalog, applies the two setting-neutral Scenario 02 revisions, and replaces
the eight entries below. `characterText` resolves all 192 English and Chinese
names and descriptions; the only mechanical override discards Scenario 01's
ticket pass for Pisces ENTP and uses its unchanged core shield. Scenario 01
and 02 adapter tables are untouched.

| Character | Earlier wording | Incident Zero wording and reason |
| --- | --- | --- |
| aries-isfp | The train or city offers boons | The Administration offers the same two instant boons |
| aries-estj | Free Investigate roll | Free temporal scan at the player's location |
| gemini-entj | Chosen quick roll resolves as Investigate | Chosen result resolves as a temporal scan |
| taurus-istp | Same carriage or zone | Same physical room and year, validated by the shared presence key |
| leo-entj | Move one carriage or zone | Move one open room in the target's year; the `movePlayer` hook follows the eight-room graph |
| capricorn-estj | Two free Investigate rolls | Two free temporal scans; successful rollers receive the same Fate bonus |
| pisces-entp | Ticket pass in Scenario 01; core shield in Scenario 02 | Core one-hit shield, since no ticket check exists |
| sagittarius-istj | Three different ordinary roll kinds | Three temporal scan protocols, tracked by the same success-kind bits |

The **ordinary roll** is a once-per-cycle temporal scan. Archive, field and
stabilization protocols use the same server die, Fate spending and reaction
pipeline. A Success grants 1 Fate, Perfect grants 2, Failure loses 1 Fate,
and Disaster loses 1 Sanity. Shared forced Investigate effects resolve as a
free field scan here. Help is a co-located, year-aware +1 to a later scan.

The **public event** is an Incident Zero anomaly, drawn from its own seeded
five-card deck after each cycle's story beat. Its instant, group-roll, vote
and individual-choice cards make event preview, redraw, cancellation and
reward skills meaningful. Generic item grants draw only the ordinary supply
pool, never numbered relics or objective artifacts. Shared task goals map to
causal intervention, new evidence, scan help and a new room/year location.
Every rewording has matching English and Simplified Chinese text. Skill cues
use the existing VFX family, with clock imagery for temporal previews,
event control and movement.
