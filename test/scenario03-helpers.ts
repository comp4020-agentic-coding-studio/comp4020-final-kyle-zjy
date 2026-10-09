import { applyGameAction } from "../src/server/engine/engine.ts";
import type { GameState } from "../src/shared/game/state.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameEvent } from "../src/shared/protocol.ts";
import { rigNextDie } from "./helpers.ts";

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
