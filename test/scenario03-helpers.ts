import { applyGameAction } from "../src/server/engine/engine.ts";
import type { GameState } from "../src/shared/game/state.ts";

/** Finish the ordinary public anomaly before a story test advances a cycle. */
export function settle03(state: GameState, now: number): GameState {
  let s = state;
  for (let guard = 0; s.pending.length && guard < 100; guard++) {
    const window = s.pending.at(-1)!;
    const optionId = window.options.find((option) => ["CONTAIN", "SEAL", "SKIP"].includes(option.id))?.id ?? window.defaultOptionId;
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
