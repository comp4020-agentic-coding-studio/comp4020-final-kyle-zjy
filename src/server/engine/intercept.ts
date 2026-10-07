// Things that wait for reactions before they happen (docs/skill-mapping-notes.md):
// a single-target negative effect, and a targeted ability being declared.
// Either is parked as `state.pendingEffect`; the holders it wakes are asked
// in turn; then it lands, maybe cancelled, weakened, redirected, retargeted
// or sent back. Only one thing is parked at a time.
import type { Effect } from "../../shared/game/effects.ts";
import type { PendingEffect, PlayerId } from "../../shared/game/state.ts";
import { cue, log, newId, type Ctx } from "./context.ts";
import { applyEffects, setInterceptor, type Scope } from "./effects.ts";
import { askNext, runEffects, skillOf, wokenBy } from "./resolver.ts";
import type { TriggerEvent } from "./skills.ts";
import { m, ref } from "../../shared/i18n/msg.ts";
import type { Msg } from "../../shared/i18n/types.ts";

const SUBJECT_FIELDS = ["who", "from"] as const;

/** The triggers a parked thing wakes. */
export function pendingEvents(pe: PendingEffect): TriggerEvent[] {
  if (pe.kind === "ABILITY") return [{ kind: "TARGETED_ABILITY_DECLARED", sourceId: pe.sourceId, subjectId: pe.targetId }];
  const base = { sourceId: pe.sourceId, subjectId: pe.targetId };
  const events: TriggerEvent[] = [
    { kind: "NEGATIVE_EFFECT_TARGETS_SELF", ...base },
    { kind: "NEGATIVE_EFFECT_TARGETS_ANY", ...base },
  ];
  if (pe.attack) events.push({ kind: "ATTACKED_BY_PLAYER", ...base });
  if (pe.theft) events.push({ kind: "FATE_THEFT_ATTEMPTED", ...base });
  return events;
}

/** Weakens an effect by `levels`: amounts drop, a status gets shorter (and vanishes at 0). */
export function weaken(e: Effect, levels: number): Effect | null {
  if (levels <= 0) return e;
  if ("amount" in e && typeof e.amount === "number") return e.amount - levels > 0 ? ({ ...e, amount: e.amount - levels } as Effect) : null;
  if (e.kind === "ADD_STATUS") return e.rounds >= 99 || e.rounds - levels <= 0 ? null : { ...e, rounds: e.rounds - levels };
  return levels > 0 ? null : e;
}

/** Points an effect at the TARGET subject (scope.targets[0]). */
const aimed = (e: Effect): Effect => {
  const out: Record<string, unknown> = { ...e };
  for (const f of SUBJECT_FIELDS) if (f in out) out[f] = "TARGET";
  if (e.kind === "TRANSFER_FATE") out.to = "SECOND_TARGET";
  return out as Effect;
};

/** Called by the negative-effect handlers: park this one if someone can answer it. */
setInterceptor((ctx, e, scope, targetId, recipient) => {
  const s = ctx.s;
  if (scope.landing || scope.group || s.pendingEffect || s.phase === "ENDING") return false;
  const source = scope.ownerId;
  if (source === targetId) return false; // a cost you pay yourself isn't something done to you
  const pe: PendingEffect = {
    id: newId(ctx, "pe"),
    kind: "EFFECT",
    sourceId: source,
    targetId,
    targets: recipient ? [targetId, recipient] : [targetId],
    label: scope.label,
    effects: [e],
    single: true,
    reduced: 0,
    cancelled: false,
    asked: [],
    copyBack: [],
    attack: source !== "SYSTEM",
    theft: e.kind === "TRANSFER_FATE" || e.kind === "STEAL_ITEM",
  };
  if (!wokenBy(ctx, pendingEvents(pe), []).length) return false;
  s.pendingEffect = pe;
  cue(ctx, "INCOMING", { targetId, label: scope.label });
  return true;
});

/** Called by the flow loop while something is parked and no window is open. */
export function processPending(ctx: Ctx): void {
  const pe = ctx.s.pendingEffect;
  if (!pe) return;
  const source = pe.sourceId === "SYSTEM" ? undefined : ctx.s.players[pe.sourceId]?.nickname;
  const why = pe.kind === "ABILITY" ? m`${source ?? "?"} is using ${pe.label}.` : m`${pe.label} is about to hit ${ctx.s.players[pe.targetId]?.nickname ?? "?"}.`;
  if (askNext(ctx, pendingEvents(pe), pe.asked, why)) return;
  land(ctx, pe);
}

function land(ctx: Ctx, pe: PendingEffect): void {
  const s = ctx.s;
  s.pendingEffect = null;
  if (pe.cancelled) return log(ctx, m`${pe.label} is cancelled before it lands.`, "DEFENCE", pe.targetId);
  if (pe.kind === "ABILITY") {
    const owner = pe.sourceId as PlayerId;
    const p = s.players[owner];
    return runEffects(ctx, owner, { ...skillOf(ctx, owner), effects: pe.effects }, pe.targets, undefined, p.skill.borrowed ?? p.characterId);
  }
  const scope = (targets: PlayerId[], ownerId: PlayerId | "SYSTEM"): Scope => ({ ownerId, targets, label: pe.label, landing: true });
  const effects = pe.effects.map((e) => weaken(e, pe.reduced)).filter((e): e is Effect => !!e);
  if (!effects.length) log(ctx, m`${pe.label} is weakened to nothing.`, "DEFENCE", pe.targetId);
  else applyEffects(ctx, effects.map(aimed), scope(pe.targets, pe.sourceId));
  // copies sent back to whoever caused it
  if (pe.sourceId !== "SYSTEM") {
    for (const copy of pe.copyBack) {
      const back = pe.effects.map((e) => weaken(e, copy.weaken ? 1 : 0)).filter((e): e is Effect => !!e);
      if (!back.length) continue;
      log(ctx, m`${pe.label} rebounds on ${s.players[pe.sourceId].nickname}.`, "DEFENCE", pe.sourceId);
      // aimed at the source; anything taken goes to the one who was hit
      applyEffects(ctx, back.map(aimed), scope([pe.sourceId, pe.targetId], pe.targetId));
    }
  }
}
