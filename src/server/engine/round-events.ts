// The public event drawn at the end of each round (unless a scripted beat
// takes its place). The deck is shuffled per run; cards are only drawn in the
// acts they belong to, and the deck reshuffles when it runs dry.
//
// A drawn card is first *revealed*: abilities that answer a reveal are asked
// (cancel it, redraw it, soften it, step out, decide it, vote on it), then it
// resolves with whatever they changed. Extra events from abilities use the
// same resolution for their own participants, without touching the deck.
import { EVENT_BY_ID, EVENT_IDS, EVENTS, type EventCard } from "../../shared/game/scenario01/events.ts";
import { WINDOW_MS } from "../../shared/game/scenario01/content.ts";
import type { Effect } from "../../shared/game/effects.ts";
import type { PlayerId } from "../../shared/game/state.ts";
import { cue, log, type Ctx } from "./context.ts";
import { quickRoll, TIER_LABEL, tierOf, clampDie } from "./dice.ts";
import { applyEffects, setGroupReroll } from "./effects.ts";
import { present } from "./players.ts";
import { int, pick, shuffle } from "./rng.ts";
import { tally } from "./beats.ts";
import { askNext } from "./resolver.ts";
import { measureRewards } from "./rewards.ts";
import { onResume, openWindow } from "./windows.ts";

/** How one card resolves: who takes part and what reactions changed. */
export type EventRun = { card: string; extra: boolean; pool: PlayerId[]; softened?: boolean; decider?: PlayerId; asVote?: boolean };

const forAct = (ctx: Ctx, id: string) => EVENT_BY_ID.get(id)!.acts.includes(ctx.s.act);

export function nextCard(ctx: Ctx): EventCard {
  const s = ctx.s;
  for (let pass = 0; pass < 2; pass++) {
    const i = s.eventDeck.findIndex((id) => forAct(ctx, id));
    if (i >= 0) return EVENT_BY_ID.get(s.eventDeck.splice(i, 1)[0])!;
    s.eventDeck = shuffle(s, EVENT_IDS);
    log(ctx, "The event deck reshuffles.", "EVENT");
  }
  throw new Error(`no event card for act ${s.act}`);
}

/** The next `n` cards this act will draw, without drawing them (previews). */
export function cardsAhead(ctx: Ctx, n: number): EventCard[] {
  return ctx.s.eventDeck.filter((id) => forAct(ctx, id)).slice(0, n).map((id) => EVENT_BY_ID.get(id)!);
}

/** Moves a card to the front of the deck (Dream Script, Advance Review). */
export function putOnTop(ctx: Ctx, id: string): void {
  ctx.s.eventDeck = [id, ...ctx.s.eventDeck.filter((x) => x !== id)];
}

/** An extra card from the act's pool, of a size (docs/skill-mapping-notes.md). */
export function extraCard(ctx: Ctx, size: "SMALL" | "STANDARD" | "MULTI" | "MINIGAME" | "REWARD", not: string[] = []): EventCard {
  const fits = (c: EventCard) =>
    size === "SMALL" ? c.kind === "INSTANT" || c.kind === "GROUP_ROLL" : size === "MINIGAME" ? c.kind === "GROUP_ROLL" : size === "REWARD" ? c.bias === "REWARD" : true;
  const pool = EVENTS.filter((c) => c.acts.includes(ctx.s.act) && fits(c) && !not.includes(c.id));
  return pick(ctx.s, pool.length ? pool : EVENTS.filter((c) => fits(c)));
}

// ---- the round's event -------------------------------------------------------

export function drawRoundEvent(ctx: Ctx): void {
  const s = ctx.s;
  const card = nextCard(ctx);
  s.currentEvent = { id: card.id, round: s.round, resolved: false, revealing: true, asked: [], excluded: [] };
  // Lead Role: the next choice event is decided by one passenger
  if (card.options && s.flags.nextDeciderSeat) {
    s.currentEvent.decider = s.turnOrder.find((id) => s.players[id].seat + 1 === s.flags.nextDeciderSeat);
    s.flags.nextDeciderSeat = 0;
  }
  log(ctx, `EVENT · ${card.title}. ${card.text}`, "EVENT");
  cue(ctx, "EVENT", { id: card.id });
}

/** Called by the flow loop while the current event is being revealed or its dice are out. */
export function continueReveal(ctx: Ctx): void {
  const s = ctx.s;
  const ce = s.currentEvent!;
  const card = EVENT_BY_ID.get(ce.id)!;
  if (ce.rolling) {
    if (askNext(ctx, [{ kind: "PUBLIC_ROLL_DONE" }], (ce.asked ??= []), `Everyone has rolled for ${card.title}.`)) return;
    ce.rolling = false;
    return applyGroupRolls(ctx, card, roundRun(ctx));
  }
  const events = card.options ? [{ kind: "EVENT_REVEALED" as const }, { kind: "CHOICE_EVENT_REVEALED" as const }] : [{ kind: "EVENT_REVEALED" as const }];
  if (askNext(ctx, events, (ce.asked ??= []), `Event: ${card.title}.`)) return;
  ce.revealing = false;
  ce.asked = [];
  if (ce.cancelled) {
    log(ctx, `${card.title} is cancelled before it takes effect.`, "EVENT");
    return resolved(ctx, "Cancelled before it took effect.");
  }
  runCard(ctx, EVENT_BY_ID.get(ce.id)!, roundRun(ctx));
}

const roundRun = (ctx: Ctx): EventRun => {
  const ce = ctx.s.currentEvent!;
  return { card: ce.id, extra: false, pool: present(ctx).map((p) => p.playerId).filter((id) => !ce.excluded?.includes(id)), softened: ce.softened, decider: ce.decider, asVote: ce.asVote };
};

// ---- resolving a card ----------------------------------------------------------

/** Throw an Error: every Collapse rise or loss the card causes is 1 smaller. */
export function soften(effects: Effect[]): Effect[] {
  return effects.flatMap((e): Effect[] => {
    if ((e.kind === "LOSE_FATE" || e.kind === "LOSE_SANITY") && e.amount > 0) return e.amount > 1 ? [{ ...e, amount: e.amount - 1 }] : [];
    if (e.kind === "CHANGE_COLLAPSE" && e.delta > 0) return e.delta > 1 ? [{ ...e, delta: e.delta - 1 }] : [];
    return [e];
  });
}

const effectsOf = (run: EventRun, effects: Effect[] | undefined) => (run.softened ? soften(effects ?? []) : (effects ?? []));

/** Resolves a card for the run's participants: at once, or through a window. */
export function runCard(ctx: Ctx, card: EventCard, run: EventRun): void {
  const pool = run.pool.filter((id) => ctx.s.players[id] && !ctx.s.players[id].away);
  if (!pool.length) return resolved(ctx, "Nobody took part.", undefined, run);
  run = { ...run, pool };
  const options = (card.options ?? []).map((o) => ({ id: o.id, label: o.label, detail: o.detail }));
  const voting = card.kind === "VOTE" || (card.kind === "EACH_CHOOSE" && (run.asVote || run.decider));
  switch (card.kind) {
    case "INSTANT":
      settle(ctx, run, card.title, () => applyEffects(ctx, effectsOf(run, card.effects), { ownerId: "SYSTEM", targets: [], label: card.title, group: true, pool }));
      return resolved(ctx, "", undefined, run);
    case "GROUP_ROLL": {
      const rolls: Record<PlayerId, number> = {};
      for (const id of pool) rolls[id] = quickRoll(ctx, ctx.s.players[id]).value;
      const ce = ctx.s.currentEvent;
      if (!run.extra && ce) {
        // abilities that answer a public roll get their moment before it counts
        ce.groupRolls = rolls;
        ce.rolling = true;
        ce.asked = [];
        return;
      }
      return applyGroupRolls(ctx, card, run, rolls);
    }
    case "VOTE":
    case "EACH_CHOOSE": {
      const decider = run.decider && pool.includes(run.decider) ? run.decider : undefined;
      openWindow(ctx, {
        kind: voting ? "VOTE" : "EVENT_CHOICE",
        title: card.title,
        prompt: decider ? `${card.text} ${ctx.s.players[decider].nickname} decides for everyone.` : voting ? card.text : `${card.text} Each of you chooses for yourself.`,
        addressees: decider ? [decider] : pool,
        options,
        defaultOptionId: options[options.length - 1].id,
        resume: { kind: voting ? "EVENT_VOTE" : "EVENT_CHOICE", payload: { run: JSON.stringify(run) } },
        blocksTable: true,
        ms: voting ? WINDOW_MS.VOTE : WINDOW_MS.EVENT_CHOICE,
      });
      return;
    }
  }
}

function applyGroupRolls(ctx: Ctx, card: EventCard, run: EventRun, given?: Record<PlayerId, number>): void {
  const rolls = given ?? ctx.s.currentEvent?.groupRolls ?? {};
  if (ctx.s.currentEvent) ctx.s.currentEvent.groupRolls = undefined;
  const results: string[] = [];
  settle(ctx, run, card.title, () => {
    for (const [id, value] of Object.entries(rolls)) {
      const p = ctx.s.players[id];
      if (!p) continue;
      const tier = tierOf(value);
      results.push(`${p.nickname} ${value} (${TIER_LABEL[tier]})`);
      cue(ctx, "QUICK_ROLL", { playerId: id, value, tier });
      const effects = effectsOf(run, card.onTier?.[tier]);
      if (effects.length) applyEffects(ctx, effects, { ownerId: "SYSTEM", self: id, targets: [], label: card.title, group: true, pool: run.pool });
    }
  });
  log(ctx, `Rolls: ${results.join(" · ")}.`, "EVENT");
  resolved(ctx, results.join(" · "), undefined, run);
}

/** Objection: every die of the public roll in progress is rolled again. */
export function rerollGroup(ctx: Ctx, label: string): boolean {
  const rolls = ctx.s.currentEvent?.groupRolls;
  if (!rolls) return false;
  for (const id of Object.keys(rolls)) rolls[id] = clampDie(1 + int(ctx.s, 6));
  log(ctx, `${label}: everyone rolls again.`, "EVENT");
  return true;
}

setGroupReroll(rerollGroup);

/** Applies a card's effects and treats what participants gained as event rewards. */
function settle(ctx: Ctx, run: EventRun, label: string, fn: () => void): void {
  const gains = measureRewards(ctx, run.pool, label, fn);
  if (!run.extra && gains.length === 1) ctx.s.players[gains[0].playerId].counters.soleGainerRound = ctx.s.round;
}

function resolved(ctx: Ctx, text: string, choice?: string, run?: EventRun): void {
  if (run?.extra || !ctx.s.currentEvent) return;
  ctx.s.currentEvent.resolved = true;
  ctx.s.currentEvent.resultText = text;
  if (choice) ctx.s.currentEvent.choice = choice;
  cue(ctx, "EVENT_RESOLVED", { id: ctx.s.currentEvent.id });
}

onResume("EVENT_VOTE", (ctx, w, answers) => {
  const run = JSON.parse(String(w.resume.payload?.run)) as EventRun;
  const card = EVENT_BY_ID.get(run.card)!;
  const { winner, counts, tie } = tally(ctx, answers, card.options!.map((o) => o.id));
  const option = card.options!.find((o) => o.id === winner)!;
  const summary = card.options!.map((o) => `${o.label} ${counts[o.id]}`).join(" · ");
  log(ctx, `${run.decider ? `${ctx.s.players[run.decider]?.nickname ?? "Someone"} decides` : "The passengers decide"}: ${option.label}. (${summary}${tie ? ", tie settled by chance" : ""})`, "VOTE");
  // a vote on an everyone-chooses card gives every participant the winning option
  settle(ctx, run, card.title, () => {
    if (card.kind === "EACH_CHOOSE") for (const id of run.pool) applyEffects(ctx, effectsOf(run, option.effects), { ownerId: "SYSTEM", self: id, targets: [], label: card.title });
    else applyEffects(ctx, effectsOf(run, option.effects), { ownerId: "SYSTEM", targets: [], label: card.title, group: true, pool: run.pool });
  });
  cue(ctx, "VOTE_RESULT", { winner, counts });
  resolved(ctx, `${option.label}. ${summary}.`, winner, run);
});

onResume("EVENT_CHOICE", (ctx, w, answers) => {
  const run = JSON.parse(String(w.resume.payload?.run)) as EventRun;
  const card = EVENT_BY_ID.get(run.card)!;
  const parts: string[] = [];
  settle(ctx, run, card.title, () => {
    for (const [playerId, optionId] of Object.entries(answers)) {
      const option = card.options!.find((o) => o.id === optionId)!;
      const p = ctx.s.players[playerId];
      if (!p) continue;
      parts.push(`${p.nickname}: ${option.label}`);
      applyEffects(ctx, effectsOf(run, option.effects), { ownerId: "SYSTEM", self: playerId, targets: [], label: card.title });
    }
  });
  log(ctx, `${card.title}: ${parts.join(" · ")}.`, "EVENT");
  resolved(ctx, parts.join(" · "), undefined, run);
});
