// Interrupt windows: any moment the table waits for someone's decision (spend
// Fate, use a reaction, vote, accept a trade). Windows are data with a
// deadline, so a restart resumes them; when one closes, the continuation
// registered for its `resume.kind` carries the game on.
import type { PendingWindow, PlayerId } from "../../shared/game/state.ts";
import { cue, newId, RuleError, type Ctx } from "./context.ts";
import { m, ref } from "../../shared/i18n/msg.ts";

export type Resumer = (ctx: Ctx, w: PendingWindow, answers: Record<PlayerId, string>) => void;

const RESUMERS = new Map<string, Resumer>();

export function onResume(kind: string, fn: Resumer): void {
  RESUMERS.set(kind, fn);
}

export type WindowSpec = Omit<PendingWindow, "id" | "answers">;

export function openWindow(ctx: Ctx, spec: WindowSpec): PendingWindow {
  const w: PendingWindow = { ...spec, id: newId(ctx, "w"), answers: {} };
  ctx.s.pending.push(w);
  cue(ctx, "WINDOW", { kind: w.kind, id: w.id, addressees: w.addressees });
  // nobody present to answer: close at once with defaults
  if (w.addressees.every((id) => ctx.s.players[id]?.away)) closeTop(ctx);
  return w;
}

export function answerWindow(ctx: Ctx, actorId: PlayerId, windowId: string, optionId: string): void {
  const w = ctx.s.pending.at(-1);
  if (!w || w.id !== windowId) throw new RuleError("NOT_YOUR_WINDOW", m`That decision has already closed.`);
  if (!w.addressees.includes(actorId)) throw new RuleError("NOT_YOUR_WINDOW", m`This decision isn't yours to make.`);
  if (w.answers[actorId] !== undefined) throw new RuleError("INVALID", m`You've already answered.`);
  if (!w.options.some((o) => o.id === optionId)) throw new RuleError("INVALID", m`That isn't one of the options.`);
  w.answers[actorId] = optionId;
  cue(ctx, "ANSWER", { windowId: w.id, playerId: actorId });
  settleIfAnswered(ctx, w);
}

/** A window everyone has answered closes, unless an ability wants a word first (I Never Said That). */
export function settleIfAnswered(ctx: Ctx, w: PendingWindow): void {
  if (ctx.s.pending.at(-1)?.id === w.id && allAnswered(ctx, w) && !beforeClose(ctx, w)) closeTop(ctx);
}

let beforeClose: (ctx: Ctx, w: PendingWindow) => boolean = () => false;
export const setBeforeClose = (fn: typeof beforeClose) => (beforeClose = fn);

const allAnswered = (ctx: Ctx, w: PendingWindow): boolean => {
  // A Scenario 03 action roll survives a brief disconnect/refresh. The host
  // can still close its Fate or reaction window explicitly with hostSkip.
  const actionRoll03 = ctx.s.scenarioId === "S03_INCIDENT_ZERO" && ctx.s.roll && !ctx.s.roll.done &&
    ["S3_INVESTIGATE", "S3_INTERVENE", "S3_SPEAK", "S3_SEARCH", "S3_TIME_JUMP"].includes(ctx.s.roll.purpose);
  const holdForReconnect = actionRoll03 && (w.kind === "FATE_SPEND" || w.kind === "REACTION");
  return w.addressees.every((id) => w.answers[id] !== undefined || (!holdForReconnect && ctx.s.players[id]?.away));
};

/** Closes the top window, filling defaults for anyone who didn't answer. */
export function closeTop(ctx: Ctx): void {
  const w = ctx.s.pending.pop();
  if (!w) return;
  const answers: Record<PlayerId, string> = {};
  for (const id of w.addressees) answers[id] = w.answers[id] ?? w.defaultOptionId;
  cue(ctx, "WINDOW_CLOSED", { kind: w.kind, id: w.id });
  const resume = RESUMERS.get(w.resume.kind);
  if (!resume) throw new Error(`no continuation registered for ${w.resume.kind}`);
  resume(ctx, w, answers);
}

/**
 * Closes windows nobody connected is still answering (the rest are away).
 * There are no time limits: a connected player is always waited for, and
 * only the host can move a stalled table along (hostSkip in engine.ts).
 */
export function expireWindows(ctx: Ctx): boolean {
  let changed = false;
  for (let guard = 0; guard < 50; guard++) {
    const w = ctx.s.pending.at(-1);
    if (!w || !allAnswered(ctx, w)) break;
    closeTop(ctx);
    changed = true;
  }
  return changed;
}
