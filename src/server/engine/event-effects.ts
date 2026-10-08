// Effect handlers for events, votes, choices and rolls an ability calls for:
// extra events, previews, redraws, forced and contest rolls, wagers, tasks.
// Anything that needs a decision opens a window whose continuation rebuilds
// the ability's scope from its payload (owner, targets, label).
import type { Effect } from "../../shared/game/effects.ts";
import type { EventCard } from "../../shared/game/scenario01/events.ts";
import { EVENT_BY_ID, eventsFor } from "../../shared/game/events.ts";
import type { PlayerId, TaskGoal, WindowOption } from "../../shared/game/state.ts";
import { cue, log, newId, type Ctx } from "./context.ts";
import { isSuccess, quickRoll, resolveAs, TIER_LABEL, tierOf } from "./dice.ts";
import { applyEffects, registerHandler, subjects, type Scope } from "./effects.ts";
import { addStatus, present } from "./players.ts";
import { pick, shuffle } from "./rng.ts";
import { tally } from "./beats.ts";
import { cardsAhead, extraCard, putOnTop, rerollGroup, runCard } from "./round-events.ts";
import { addRule } from "./skill-effects.ts";
import { RULE_CHANGES, TASK_GOALS } from "../../shared/game/scenario01/content.ts";
import { onResume, openWindow } from "./windows.ts";
import { list, m, ref } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";

const selfOf = (scope: Scope): PlayerId | undefined => scope.self ?? (scope.ownerId === "SYSTEM" ? undefined : scope.ownerId);
const nick = (ctx: Ctx, id: PlayerId) => ctx.s.players[id]?.nickname ?? "Someone";
const peek = (ctx: Ctx, id: PlayerId, text: Msg) => ctx.s.secrets[id]?.peeks.push({ id: newId(ctx, "peek"), text, round: ctx.s.round });
const ids = (ctx: Ctx) => present(ctx).map((p) => p.playerId);

/** The parts of a scope a window continuation needs. */
type Saved = { ownerId: PlayerId; targets: PlayerId[]; label: Msg };
const save = (scope: Scope): Saved => ({ ownerId: selfOf(scope)!, targets: scope.targets, label: scope.label });
const restore = (sv: Saved, extra: Partial<Scope> = {}): Scope => ({ ownerId: sv.ownerId, targets: sv.targets, label: sv.label, ...extra });

/** Asks the ability's owner to pick; `action` + `data` say what the answer means. */
function choose(ctx: Ctx, scope: Scope, prompt: Msg, options: WindowOption[], action: string, data: unknown): void {
  const owner = selfOf(scope);
  if (!owner || !options.length) return;
  openWindow(ctx, {
    kind: "SKILL_CHOICE",
    title: scope.label,
    prompt,
    addressees: [owner],
    options,
    defaultOptionId: options[0].id,
    resume: { kind: "SKILL_CHOICE", payload: { action, scope: JSON.stringify(save(scope)), data: JSON.stringify(data) } },
    blocksTable: true,
    ownerId: owner,
  });
}

const CHOICES = new Map<string, (ctx: Ctx, scope: Scope, answer: string, data: never) => void>();
onResume("SKILL_CHOICE", (ctx, w, answers) => {
  const fn = CHOICES.get(String(w.resume.payload?.action));
  const saved = JSON.parse(String(w.resume.payload?.scope)) as Saved;
  fn?.(ctx, restore(saved), answers[w.addressees[0]], JSON.parse(String(w.resume.payload?.data)) as never);
});

// ---- extra events ----------------------------------------------------------------

const kindLabel = (c: EventCard): Msg => ({ VOTE: m`a vote`, EACH_CHOOSE: m`an everyone-chooses event`, GROUP_ROLL: m`a group roll`, INSTANT: m`an instant event` })[c.kind];
const biasLabel = (c: EventCard): Msg => ({ REWARD: m`a reward`, CRISIS: m`a crisis`, MIXED: m`a mix of both` })[c.bias];
const fullText = (c: EventCard): Msg =>
  c.options ? m`${ref.event(c.id)}: ${ref.eventText(c.id)} Options: ${list(c.options.map((o) => m`${ref.option(c.id, o.id)} (${ref.optionDetail(c.id, o.id)})`))}.` : m`${ref.event(c.id)}: ${ref.eventText(c.id)}`;

function runExtra(ctx: Ctx, card: EventCard, pool: PlayerId[], label: Msg): void {
  log(ctx, m`${label}: an extra event, ${ref.event(card.id)}, for ${list(pool.map((id) => nick(ctx, id)))}.`, "EVENT");
  cue(ctx, "EVENT", { id: card.id, extra: true });
  runCard(ctx, card, { card: card.id, extra: true, pool });
}

registerHandler("RANDOM_EVENT", (ctx, e, scope) => {
  const self = selfOf(scope);
  if (!self) return;
  const who = e.participants ?? "SELF";
  const pool = who === "TARGETS" ? [...new Set([...scope.targets, self])] : subjects(ctx, scope, who);
  if (e.split === "TWO_GROUPS") {
    const mixed = shuffle(ctx.s, pool);
    const half = Math.ceil(mixed.length / 2);
    const first = extraCard(ctx, e.size);
    runExtra(ctx, first, mixed.slice(0, half), scope.label);
    if (mixed.length > half) runExtra(ctx, extraCard(ctx, e.size, [first.id]), mixed.slice(half), scope.label);
    return;
  }
  if (!e.choices) return runExtra(ctx, extraCard(ctx, e.size), pool, scope.label);
  const cards: EventCard[] = [];
  for (let i = 0; i < e.choices; i++) cards.push(extraCard(ctx, e.size, cards.map((c) => c.id)));
  if (e.pick === "HIGHER_REWARD") {
    const rank = { REWARD: 0, MIXED: 1, CRISIS: 2 } as const;
    const best = [...cards].sort((a, b) => rank[a.bias] - rank[b.bias])[0];
    log(ctx, m`${scope.label}: drawn ${list(cards.map((c) => ref.event(c.id)))}; ${nick(ctx, self)} takes ${ref.event(best.id)}.`, "EVENT");
    return runExtra(ctx, best, pool, scope.label);
  }
  // Into the Unknown: three face-down events, the owner opens one
  choose(ctx, scope, m`Three events wait face down. Open one.`, cards.map((_, i) => ({ id: String(i), label: m`Event ${i + 1}` })), "OPEN_EVENT", { cards: cards.map((c) => c.id), pool });
});
CHOICES.set("OPEN_EVENT", (ctx, scope, answer, data: { cards: string[]; pool: PlayerId[] }) => {
  const card = EVENT_BY_ID.get(data.cards[Number(answer)] ?? data.cards[0])!;
  runExtra(ctx, card, data.pool, scope.label);
});

registerHandler("PREVIEW_EVENT", (ctx, e, scope) => {
  const self = selfOf(scope);
  if (!self) return;
  let cards = cardsAhead(ctx, e.filter === "NEXT_PENALTY" ? 8 : e.count);
  if (e.filter === "NEXT_PENALTY") cards = cards.filter((c) => c.bias === "CRISIS").slice(0, 1);
  if (!cards.length) return peek(ctx, self, m`${scope.label}: nothing like that is coming in this act.`);
  for (const [i, c] of cards.entries()) {
    const text = e.detail === "TYPE" ? kindLabel(c) : e.detail === "BIAS" ? biasLabel(c) : fullText(c);
    peek(ctx, self, cards.length > 1 ? m`${scope.label}: event ${i + 1} ahead is ${text}.` : e.filter === "NEXT_PENALTY" ? m`${scope.label}: the next crisis is ${text}.` : m`${scope.label}: the next event is ${text}.`);
  }
  log(ctx, m`${nick(ctx, self)} looks ahead at what's coming.`, "SKILL", self);
  if (e.reorder && cards.length > 1) {
    choose(ctx, scope, m`Next: ${ref.event(cards[0].id)}, then ${ref.event(cards[1].id)}. Keep that order?`, [{ id: "KEEP", label: m`Keep the order` }, { id: "SWAP", label: m`${ref.event(cards[1].id)} first` }], "REORDER", { second: cards[1].id });
  }
});
CHOICES.set("REORDER", (ctx, scope, answer, data: { second: string }) => {
  if (answer !== "SWAP") return;
  putOnTop(ctx, data.second);
  log(ctx, m`${scope.label}: the order of what's coming changes.`, "SKILL");
});

registerHandler("REVEAL_HIDDEN", (ctx, e, scope) => {
  const self = selfOf(scope);
  if (!self) return;
  if (e.what === "STATUS") {
    for (const id of subjects(ctx, scope, e.who)) {
      const hidden = ctx.s.players[id].statuses.filter((st) => st.hidden);
      peek(ctx, self, hidden.length ? m`${scope.label}: ${nick(ctx, id)} carries ${list(hidden.map((st) => ref.status(st.kind)))}.` : m`${scope.label}: ${nick(ctx, id)} carries nothing hidden.`);
    }
    return;
  }
  const [card] = cardsAhead(ctx, 1);
  if (!card) return;
  peek(ctx, self, m`${scope.label}: the next event is ${fullText(card)}`);
  if (e.mayVeto) choose(ctx, scope, m`The next event is ${ref.event(card.id)}. Let it happen?`, [{ id: "KEEP", label: m`Let it happen` }, { id: "DROP", label: m`Throw it out` }], "VETO", { card: card.id });
});
CHOICES.set("VETO", (ctx, scope, answer, data: { card: string }) => {
  if (answer !== "DROP") return;
  const i = ctx.s.eventDeck.indexOf(data.card);
  if (i >= 0) ctx.s.eventDeck.splice(i, 1);
  log(ctx, m`${scope.label}: an event that was coming never arrives.`, "SKILL");
});

// ---- changing the event being revealed --------------------------------------------

registerHandler("REROLL_EVENT", (ctx, e, scope) => {
  const ce = ctx.s.currentEvent;
  if (e.mode === "CONSENSUS") {
    // Take Two: the next public event is thrown out and replaced
    const [next] = cardsAhead(ctx, 1);
    if (next) ctx.s.eventDeck.splice(ctx.s.eventDeck.indexOf(next.id), 1);
    return log(ctx, m`${scope.label}: the next event is thrown out.`, "EVENT");
  }
  if (!ce?.revealing) return;
  const old = EVENT_BY_ID.get(ce.id)!;
  const pool = cardsFor(ctx, (c) => c.id !== old.id && (e.mode === "OTHER_CATEGORY" ? c.bias !== old.bias : c.kind === old.kind || c.bias === old.bias));
  if (!pool.length) return;
  const fresh = pick(ctx.s, pool);
  ce.id = fresh.id;
  log(ctx, m`${scope.label}: ${ref.event(old.id)} flickers and becomes ${ref.event(fresh.id)}. ${ref.eventText(fresh.id)}`, "EVENT");
  cue(ctx, "EVENT", { id: fresh.id });
});
const cardsFor = (ctx: Ctx, keep: (c: EventCard) => boolean) => eventsFor(ctx.s.scenarioId).filter((c) => c.acts.includes(ctx.s.act) && keep(c));

registerHandler("MODIFY_EVENT", (ctx, e, scope) => {
  const s = ctx.s;
  const self = selfOf(scope);
  const ce = s.currentEvent;
  switch (e.change) {
    case "NEXT_DECIDER":
      if (self) s.flags.nextDeciderSeat = s.players[self].seat + 1;
      return log(ctx, self ? m`${scope.label}: the next event that asks for a choice is ${nick(ctx, self)}'s to decide.` : m`${scope.label}: the next event that asks for a choice is someone's to decide.`, "SKILL", self);
    case "DECIDER_SELF":
      if (ce?.revealing && self) ce.decider = self;
      return log(ctx, self ? m`${scope.label}: ${nick(ctx, self)} decides this one for everyone.` : m`${scope.label}: someone decides this one for everyone.`, "SKILL", self);
    case "REMOVE_CONDITION":
      if (ce?.revealing) ce.softened = true;
      return log(ctx, m`${scope.label}: the event loses its edge (every loss and Collapse rise is 1 smaller).`, "EVENT");
    case "RANDOM_ASPECT": {
      if (!ce?.revealing) return;
      if (pick(s, [0, 1]) === 0) {
        ce.softened = true;
        return log(ctx, m`${scope.label}: the event softens.`, "EVENT");
      }
      return applyEffects(ctx, [{ kind: "REROLL_EVENT", mode: "SAME_CATEGORY" }], scope);
    }
    case "BIAS_CHOSEN":
      return choose(ctx, scope, m`What should the next public event be?`, [{ id: "REWARD", label: m`A reward` }, { id: "CRISIS", label: m`A crisis` }], "BIAS", {});
  }
});
CHOICES.set("BIAS", (ctx, scope, answer) => {
  const wanted = answer === "CRISIS" ? "CRISIS" : "REWARD";
  const ahead = ctx.s.eventDeck.find((id) => EVENT_BY_ID.get(id)!.acts.includes(ctx.s.act) && EVENT_BY_ID.get(id)!.bias === wanted);
  if (ahead) putOnTop(ctx, ahead);
  log(ctx, ahead ? m`${scope.label}: the dream bends the next event.` : m`${scope.label}: the dream bends the next event, but nothing like that is left in the deck.`, "SKILL");
});

registerHandler("SKIP_EVENT", (ctx, e, scope) => {
  const ce = ctx.s.currentEvent;
  for (const id of subjects(ctx, scope, e.who)) {
    if (ce?.revealing && !ce.excluded?.includes(id)) (ce.excluded ??= []).push(id);
    log(ctx, m`${scope.label}: ${nick(ctx, id)} steps out of the event.`, "EVENT", id);
    if (e.hideUntil) addStatus(ctx, ctx.s.players[id], { kind: "IMMUNE_NEGATIVE", polarity: "POSITIVE", sourceId: id, expiresAtRound: ctx.s.round, hidden: false, ordinary: false, value: 99 });
    if (e.reroute) runExtra(ctx, extraCard(ctx, "STANDARD", ce ? [ce.id] : []), [id], scope.label);
  }
});

// ---- votes and choices -----------------------------------------------------------

registerHandler("VOTE", (ctx, e, scope) => {
  const ce = ctx.s.currentEvent;
  if (e.question === "PICK_OUTCOME") {
    // Put It to a Vote: the event being revealed is settled by everyone's vote
    if (ce?.revealing) ce.asVote = true;
    return log(ctx, m`${scope.label}: everyone votes on this one.`, "EVENT");
  }
  const options: WindowOption[] =
    e.question === "PICK_PLAYER"
      ? present(ctx).map((p) => ({ id: p.playerId, label: m`${p.nickname}` }))
      : e.question === "CONFIRM_REROLL"
        ? [{ id: "YES", label: m`Throw it out` }, { id: "NO", label: m`Keep it` }]
        : [{ id: "LEFT", label: m`The left door` }, { id: "RIGHT", label: m`The right door` }];
  const prompt = { PICK_PLAYER: m`Vote for one passenger.`, CONFIRM_REROLL: m`Throw out the next public event and draw another?`, MINORITY_REWARD: m`Choose a door, in secret. The fewer who pick it, the better.`, PICK_OUTCOME: m`` }[e.question];
  openWindow(ctx, {
    kind: "VOTE",
    title: scope.label,
    prompt,
    addressees: ids(ctx),
    options,
    defaultOptionId: e.question === "PICK_PLAYER" ? selfOf(scope)! : options[options.length - 1].id,
    resume: { kind: "SKILL_VOTE", payload: { question: e.question, scope: JSON.stringify(save(scope)), reward: JSON.stringify(e.reward ?? []) } },
    blocksTable: true,
  });
});

onResume("SKILL_VOTE", (ctx, w, answers) => {
  const sv = JSON.parse(String(w.resume.payload?.scope)) as Saved;
  const reward = JSON.parse(String(w.resume.payload?.reward)) as Effect[];
  const question = String(w.resume.payload?.question);
  const { winner, counts } = tally(ctx, answers, w.options.map((o) => o.id));
  if (question === "PICK_PLAYER") {
    log(ctx, m`${sv.label}: the passengers choose ${nick(ctx, winner)}.`, "VOTE", winner);
    return applyEffects(ctx, reward, restore(sv, { triggerSubject: winner }));
  }
  if (question === "CONFIRM_REROLL") {
    log(ctx, counts.YES > counts.NO ? m`${sv.label}: agreed.` : m`${sv.label}: not enough votes.`, "VOTE");
    if (counts.YES > counts.NO) applyEffects(ctx, reward, restore(sv));
    return;
  }
  // the minority (strictly fewer) wins; an even split pays nobody
  const [l, r] = [counts.LEFT, counts.RIGHT];
  const side = l === r ? null : l < r ? "LEFT" : "RIGHT";
  const winners = Object.entries(answers).filter(([, a]) => a === side).map(([id]) => id);
  log(ctx, winners.length ? m`${sv.label}: left ${l}, right ${r}; ${list(winners.map((id) => nick(ctx, id)))} chose the quiet door.` : m`${sv.label}: left ${l}, right ${r}; nobody stands out.`, "VOTE");
  for (const id of winners) applyEffects(ctx, reward, restore(sv, { triggerSubject: id }));
});

/** The instant boons a "two random effects" choice draws from. */
const BOONS: { id: string; effects: Effect[] }[] = [
  { id: "FATE", effects: [{ kind: "GAIN_FATE", who: "SELF", amount: 2 }] },
  { id: "SANITY", effects: [{ kind: "GAIN_SANITY", who: "SELF", amount: 1 }] },
  { id: "ITEM", effects: [{ kind: "GRANT_ITEM", who: "SELF", pool: "ANY", count: 1 }] },
  { id: "SHIELD", effects: [{ kind: "SHIELD", who: "SELF", charges: 1 }] },
  { id: "AP", effects: [{ kind: "GAIN_AP", who: "SELF", amount: 1 }] },
  { id: "CLEANSE", effects: [{ kind: "REMOVE_STATUS", who: "SELF", polarity: "NEGATIVE", count: "ALL" }] },
];

registerHandler("CHOOSE_ONE", (ctx, e, scope) => {
  const n = e.from === "RANDOM_THREE" ? 3 : 2;
  const offered = e.options.length ? e.options.map((effects, i) => ({ label: m`Option ${i + 1}`, effects })) : shuffle(ctx.s, BOONS).slice(0, n).map((b) => ({ label: ref.boon(b.id), effects: b.effects }));
  choose(ctx, scope, m`Choose one.`, offered.map((o, i) => ({ id: String(i), label: o.label })), "BOON", offered.map((o) => o.effects));
});
CHOICES.set("BOON", (ctx, scope, answer, data: Effect[][]) => applyEffects(ctx, data[Number(answer)] ?? data[0], scope));

registerHandler("MODIFY_RULE", (ctx, e, scope) => {
  if (e.rule === "CHOSEN_NUMERIC_RULE") return choose(ctx, scope, m`Rewrite one rule for this round.`, Object.keys(RULE_CHANGES).map((id) => ({ id, label: ref.ruleChange(id) })), "RULE", { rounds: e.rounds });
  addRule(ctx, e.rule === "RANDOM_GLOBAL_MODIFIER" ? pick(ctx.s, Object.keys(RULE_CHANGES)) : e.rule, e.rounds, scope.label);
});
CHOICES.set("RULE", (ctx, scope, answer, data: { rounds: number }) => addRule(ctx, answer, data.rounds, scope.label));

registerHandler("REVISE_CHOICE", (ctx, _e, scope) => {
  // the trigger carries "windowId:newAnswer" (resolver's beforeClose hook)
  const [windowId, answer] = String(scope.trigger?.condition ?? "").split(":");
  const w = ctx.s.pending.find((x) => x.id === windowId);
  const self = selfOf(scope);
  if (!w || !self || !w.options.some((o) => o.id === answer)) return;
  w.answers[self] = answer;
  log(ctx, m`${nick(ctx, self)} changes their answer.`, "VOTE", self);
});

// ---- rolls an ability calls for ------------------------------------------------------

/** A quick roll with an optional risk: failure costs 1 Fate, disaster also 1 Sanity. */
function forced(ctx: Ctx, id: PlayerId, kind: string, scope: Scope): boolean {
  const p = ctx.s.players[id];
  if (kind === "ORDINARY") {
    // a real Investigate where they stand, at no cost
    const { value, tier } = quickRoll(ctx, p);
    resolveAs(ctx, p, "INVESTIGATE", value, m`${scope.label} (Investigate)`);
    return isSuccess(tier);
  }
  const { value, tier } = quickRoll(ctx, p);
  log(ctx, m`${scope.label}: ${p.nickname} rolls ${value} (${TIER_LABEL[tier]}).`, "ROLL", id);
  cue(ctx, "QUICK_ROLL", { playerId: id, value, tier });
  if (kind === "RISK" && !isSuccess(tier)) {
    const cost: Effect[] = [{ kind: "LOSE_FATE", who: "TARGET", amount: 1 }];
    if (tier === "DISASTER") cost.push({ kind: "LOSE_SANITY", who: "TARGET", amount: 1 });
    applyEffects(ctx, cost, { ...scope, targets: [id] });
  }
  return isSuccess(tier);
}

registerHandler("FORCE_ROLL", (ctx, e, scope) => {
  for (const id of subjects(ctx, scope, e.who)) {
    const ok = forced(ctx, id, e.roll, scope);
    const then = ok ? e.onSuccess : e.onFail;
    if (then?.length) applyEffects(ctx, then, { ...scope, triggerSubject: id });
  }
});

registerHandler("CHALLENGE", (ctx, e, scope) => {
  const self = selfOf(scope);
  const [a, b] = e.scope === "TWO_TARGETS" ? [scope.targets[0], scope.targets[1]] : [self, subjects(ctx, scope, e.against)[0]];
  if (!a || !b || a === b) return;
  const ra = quickRoll(ctx, ctx.s.players[a]).value;
  const rb = quickRoll(ctx, ctx.s.players[b]).value;
  cue(ctx, "QUICK_ROLL", { playerId: a, value: ra, tier: tierOf(ra) });
  cue(ctx, "QUICK_ROLL", { playerId: b, value: rb, tier: tierOf(rb) });
  log(ctx, m`${scope.label}: ${nick(ctx, a)} ${ra} against ${nick(ctx, b)} ${rb}.`, "ROLL");
  const gain = (id: PlayerId, n: number) => n > 0 && applyEffects(ctx, [{ kind: "GAIN_FATE", who: "TARGET", amount: n }], { ...scope, targets: [id] });
  if (ra === rb) {
    if (e.tieGains) [a, b].forEach((id) => gain(id, e.tieGains!));
    return;
  }
  gain(ra > rb ? a : b, e.winnerGains);
});

registerHandler("GROUP_ROLL", (ctx, e, scope) => {
  const who = subjects(ctx, scope, e.who);
  if (!who.length) return;
  const rolls = who.map((id) => ({ id, value: quickRoll(ctx, ctx.s.players[id]).value }));
  for (const r of rolls) cue(ctx, "QUICK_ROLL", { playerId: r.id, value: r.value, tier: tierOf(r.value) });
  log(ctx, m`${scope.label}: ${rolls.map((r) => `${nick(ctx, r.id)} ${r.value}`).join(" · ")}.`, "ROLL");
  if (e.mode === "PICK_ONE") {
    return choose(ctx, scope, m`Which result counts? It resolves as an Investigate where that player stands.`, rolls.map((r) => ({ id: r.id, label: m`${nick(ctx, r.id)}: ${r.value}` })), "PICK_ROLL", rolls);
  }
  if (e.mode === "SUM_THRESHOLD") {
    const total = rolls.reduce((sum, r) => sum + r.value, 0);
    const needed = 4 * rolls.length;
    log(ctx, m`${scope.label}: ${total} of ${needed} needed.`, "ROLL");
    if (total >= needed) applyEffects(ctx, e.reward, scope);
    return;
  }
  // HIGHEST_WINS: per-winner parts go to every top roller, the rest once
  const top = Math.max(...rolls.map((r) => r.value));
  const perWinner = e.reward.filter((x) => "who" in x && x.who === "TRIGGER_SUBJECT");
  for (const r of rolls.filter((x) => x.value === top)) applyEffects(ctx, perWinner, { ...scope, triggerSubject: r.id });
  applyEffects(ctx, e.reward.filter((x) => !perWinner.includes(x)), scope);
});
CHOICES.set("PICK_ROLL", (ctx, scope, answer, data: { id: PlayerId; value: number }[]) => {
  const r = data.find((x) => x.id === answer) ?? data[0];
  if (ctx.s.players[r.id]) resolveAs(ctx, ctx.s.players[r.id], "INVESTIGATE", r.value, m`${scope.label} (Investigate)`);
});

registerHandler("WAGER", (ctx, e, scope) => {
  const self = selfOf(scope);
  if (!self) return;
  const p = ctx.s.players[self];
  p.wager = { onSuccess: e.onSuccess, onFail: e.onFail, label: scope.label };
  addStatus(ctx, p, { kind: "WAGER", polarity: "POSITIVE", sourceId: self, expiresAtRound: null, hidden: false, ordinary: false });
  log(ctx, m`${p.nickname} bets on their next roll (${scope.label}).`, "SKILL", self);
});

registerHandler("DOUBLE_REWARD", (ctx, e, scope) => {
  for (const id of subjects(ctx, scope, e.who)) {
    addStatus(ctx, ctx.s.players[id], { kind: e.penaltyToo ? "ALL_IN" : "DOUBLE_NEXT_ROLL", polarity: "POSITIVE", sourceId: selfOf(scope) ?? "SYSTEM", expiresAtRound: null, hidden: false, ordinary: false });
    log(ctx, e.penaltyToo ? m`${scope.label}: ${nick(ctx, id)}'s next roll counts double, penalties too.` : m`${scope.label}: ${nick(ctx, id)}'s next roll counts double.`, "STATUS", id);
  }
});

registerHandler("BONUS_ON_NEXT_REWARD", (ctx, e, scope) => {
  for (const id of subjects(ctx, scope, e.who)) {
    addStatus(ctx, ctx.s.players[id], { kind: "BONUS_NEXT_REWARD", polarity: "POSITIVE", sourceId: selfOf(scope) ?? "SYSTEM", expiresAtRound: e.scope === "FIRST_THIS_ROUND" ? ctx.s.round : null, hidden: false, ordinary: false, value: e.amount });
    log(ctx, m`${scope.label}: ${nick(ctx, id)}'s next reward gives +${e.amount} Fate.`, "STATUS", id);
  }
});

registerHandler("NEGATE_PENALTY", (ctx, e, scope) => {
  if (e.also === "KEEP_RESOURCES") {
    for (const id of subjects(ctx, scope, e.who)) {
      addStatus(ctx, ctx.s.players[id], { kind: "SAFETY_ROPE", polarity: "POSITIVE", sourceId: selfOf(scope) ?? "SYSTEM", expiresAtRound: null, hidden: false, ordinary: false });
      log(ctx, m`${scope.label}: ${nick(ctx, id)}'s next failure will cost nothing.`, "STATUS", id);
    }
    return;
  }
  // the roll being resolved costs its roller nothing
  const rc = ctx.s.rollContext;
  if (rc) rc.stakes = { rewardMult: rc.stakes?.rewardMult ?? 1, penaltyMult: rc.stakes?.penaltyMult ?? 1, ...rc.stakes, noPenalty: true };
});

// ---- tasks -----------------------------------------------------------------------------

const GOALS = Object.keys(TASK_GOALS) as TaskGoal[];

export function taskProgress(ctx: Ctx, id: PlayerId, goal: TaskGoal): number {
  const st = ctx.s.players[id].stats;
  const places = ctx.s.city ? (ctx.s.players[id].counters.zonesVisited ?? 1) : st.carriagesVisited.length;
  return { REPAIR: st.repairs, FRAGMENT: st.fragmentsFound, HELP: st.helpsGiven, NEW_CARRIAGE: places }[goal];
}

registerHandler("SET_TASK", (ctx, e, scope) => {
  const setBy = selfOf(scope);
  if (!setBy) return;
  for (const id of subjects(ctx, scope, e.who)) {
    const goal = pick(ctx.s, GOALS);
    ctx.s.secrets[id].tasks.push({ id: newId(ctx, "task"), text: ctx.s.city ? ref.goal02(goal) : ref.goal(goal), untilRound: ctx.s.round + e.rounds, done: false, goal, baseline: taskProgress(ctx, id, goal), reward: e.reward, setBy });
    log(ctx, e.secret ? m`${nick(ctx, id)} draws a secret goal.` : m`${scope.label}: by the end of round ${ctx.s.round + e.rounds}, ${nick(ctx, id)} must: ${ctx.s.city ? ref.goal02(goal) : ref.goal(goal)}.`, "SKILL", id);
  }
});

/** Pays out every task whose goal has been met; drops the ones past their deadline. */
export function checkTasks(ctx: Ctx): void {
  const s = ctx.s;
  for (const [holder, sec] of Object.entries(s.secrets)) {
    for (const t of sec.tasks) {
      if (t.done || t.untilRound < s.round || taskProgress(ctx, holder, t.goal) <= t.baseline) continue;
      t.done = true;
      log(ctx, m`${nick(ctx, holder)} completes a goal: ${t.text}.`, "SKILL", holder);
      applyEffects(ctx, t.reward, { ownerId: t.setBy, targets: [holder], label: m`a goal met` });
    }
  }
}
