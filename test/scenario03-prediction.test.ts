import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { placeKey03 } from "../src/shared/game/scenario03/map.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { rigNextDie, seatsFor, SEED, T0 } from "./helpers.ts";

let now = T0;
const act = (s: GameState, id: string, action: Parameters<typeof applyGameAction>[2]) => applyGameAction(s, id, action, (now += 1000)).state;

/** Act 3, the active traveller in 1996 · Prototype Room with AP, the others holding Fate. */
function atCore(): { s: GameState; actor: string; others: string[] } {
  let s = startGame(createGame("s3-predict", seatsFor(3), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = act(s, id, { type: "ACK_SEQUENCE" });
  s.act = 3;
  s.phase = "ACT_3";
  const actor = s.turnOrder[s.activeIndex];
  s.temporal!.locations[actor] = { roomId: "PROTOTYPE_ROOM", year: "Y1996" };
  s.players[actor].carriageIndex = placeKey03("PROTOTYPE_ROOM", "Y1996");
  s.players[actor].ap = 3;
  const others = s.turnOrder.filter((id) => id !== actor);
  for (const id of others) s.players[id].fate = 2;
  return { s, actor, others };
}

/** Answer the prediction, then let the roll and its windows resolve with defaults. */
function resolve(s: GameState, bets: Record<string, string>): GameState {
  const w = s.pending.at(-1)!;
  for (const [id, choice] of Object.entries(bets)) s = act(s, id, { type: "RESPOND", windowId: w.id, optionId: choice });
  for (let guard = 0; s.pending.length && guard < 20; guard++) {
    const top = s.pending.at(-1)!;
    if (top.resume.kind === "S3_PREDICTION") break;
    for (const id of top.addressees) if (s.pending.at(-1)?.id === top.id && top.answers[id] === undefined) s = act(s, id, { type: "RESPOND", windowId: top.id, optionId: top.defaultOptionId });
  }
  return s;
}

describe("scenario 03 time prediction", () => {
  it("opens for the other travellers on a major decision and keeps every answer secret", () => {
    const { s, actor, others } = atCore();
    const next = act(s, actor, { type: "INTERVENE", nodeId: "PROTOTYPE_CORE", choiceId: "SHUT_DOWN" });
    const w = next.pending.at(-1)!;
    expect(w.resume.kind).toBe("S3_PREDICTION");
    expect(w.addressees.sort()).toEqual([...others].sort());
    const answered = act(next, others[0], { type: "RESPOND", windowId: w.id, optionId: "CHANGE" });
    const seen = project(answered, others[1]).pending.at(-1)!;
    expect(seen.myAnswer).toBeNull();
    expect(JSON.stringify(seen)).not.toContain("CHANGE\"}");
    expect(JSON.stringify(project(answered, others[1]))).not.toMatch(/s3_bet_/);
  });

  it("pays a correct call and takes a wrong one, on what history actually did", () => {
    const { s, actor, others } = atCore();
    const [right, wrong] = others;
    let next = act(s, actor, { type: "INTERVENE", nodeId: "PROTOTYPE_CORE", choiceId: "SHUT_DOWN" });
    rigNextDie(next, 6);
    next = resolve(next, { [right]: "CHANGE", [wrong]: "SAME" });
    expect(next.temporal!.interventions.some((i) => i.nodeId === "PROTOTYPE_CORE")).toBe(true);
    expect(next.players[right].fate).toBe(3);
    expect(next.players[wrong].fate).toBe(1);
  });

  it("settles a failed intervention as no change, and charges nobody who stayed out", () => {
    const { s, actor, others } = atCore();
    const [bettor, abstainer] = others;
    let next = act(s, actor, { type: "INTERVENE", nodeId: "PROTOTYPE_CORE", choiceId: "SHUT_DOWN" });
    rigNextDie(next, 1);
    next = resolve(next, { [bettor]: "SAME", [abstainer]: "PASS" });
    expect(next.temporal!.interventions.some((i) => i.nodeId === "PROTOTYPE_CORE")).toBe(false);
    expect(next.players[bettor].fate).toBe(3);
    expect(next.players[abstainer].fate).toBe(2);
    expect(Object.keys(next.flags).filter((k) => k.startsWith("s3_bet_"))).toEqual([]);
  });

  it("rolls at once for an ordinary decision", () => {
    const { s, actor } = atCore();
    s.temporal!.locations[actor] = { roomId: "ARCHIVES", year: "Y1996" };
    s.players[actor].carriageIndex = placeKey03("ARCHIVES", "Y1996");
    const next = act(s, actor, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" });
    expect(next.pending.some((w) => w.resume.kind === "S3_PREDICTION")).toBe(false);
    expect(next.roll?.purpose).toBe("S3_INTERVENE");
  });
});
