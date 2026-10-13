// Shared deterministic fixture tools; ordinary game requests never call rigNextDie.
import { applyGameAction } from "../engine/engine.ts";
import { next as nextFloat } from "../engine/rng.ts";
import type { GameState } from "../../shared/game/state.ts";
import type { GameAction } from "../../shared/game/actions.ts";
import type { GameEvent } from "../../shared/protocol.ts";

/**
 * Rigs the generator so the next d6 rolls `value`, by searching for a
 * generator state whose next draw lands there. Tests use it to reach a
 * specific outcome without touching engine code.
 */
export function rigNextDie(state: GameState, value: number): void {
  for (let i = 1; i < 10_000; i++) {
    const probe = { rng: [i * 2654435761 >>> 0, i * 40503 + 7, i * 9973 + 11, i] as [number, number, number, number], rngCalls: 0 };
    const copy = { ...probe, rng: [...probe.rng] as [number, number, number, number] };
    if (1 + Math.floor(nextFloat(copy) * 6) === value) {
      state.rng = probe.rng;
      return;
    }
  }
  throw new Error("could not rig the die");
}

/** Resolve a scripted successful action through the actual Fate and reaction windows. */
export function successfulAction03(state: GameState, id: string, action: GameAction, now: number): { state: GameState; events: GameEvent[] } {
  rigNextDie(state, 4);
  let step = applyGameAction(state, id, action, now);
  const events = [...step.events];
  for (let guard = 0; step.state.pending.length && guard < 20; guard++) {
    const w = step.state.pending.at(-1)!;
    for (const recipient of w.addressees) {
      if (step.state.pending.at(-1)?.id !== w.id) break;
      if (w.answers[recipient] !== undefined) continue;
      step = applyGameAction(step.state, recipient, { type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId }, now + guard + 1);
      events.push(...step.events);
    }
  }
  if (step.state.pending.length) throw new Error("Scenario 03 action roll did not settle");
  return { state: step.state, events };
}

/** Finish the ordinary public anomaly before a story test advances a cycle. */
export function settle03(state: GameState, now: number, spendForSuccess = false): GameState {
  let s = state;
  for (let guard = 0; s.pending.length && guard < 100; guard++) {
    const window = s.pending.at(-1)!;
    const needed = s.roll ? Math.max(0, 4 - s.roll.final) : 0;
    const fate = window.kind === "FATE_SPEND" && spendForSuccess && needed <= 2 && window.options.some((option) => option.id === String(needed)) ? String(needed) : null;
    const optionId = fate ?? window.options.find((option) => ["CONTAIN", "SEAL", "SKIP"].includes(option.id))?.id ?? window.defaultOptionId;
    for (const id of window.addressees) {
      if (s.pending.at(-1)?.id !== window.id) break;
      if (window.answers[id] !== undefined) continue;
      s = applyGameAction(s, id, { type: "RESPOND", windowId: window.id, optionId }, now + guard + 1).state;
    }
  }
  if (s.pending.length) throw new Error("Scenario 03 event did not settle");
  return s;
}

export function endTurn03(state: GameState, now: number): GameState {
  const s = settle03(state, now);
  return settle03(applyGameAction(s, s.turnOrder[s.activeIndex], { type: "END_TURN" }, now).state, now);
}
