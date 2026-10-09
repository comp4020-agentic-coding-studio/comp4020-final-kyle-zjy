import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, setAway, startGame, tickGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { statusName } from "../src/client/game/status.ts";
import { placeKey03, type RoomId03, type Year03 } from "../src/shared/game/scenario03/map.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { scenarioText } from "../src/shared/i18n/content.ts";
import { rigNextDie, seatsFor, SEED, T0 } from "./helpers.ts";
import { endTurn03 } from "./scenario03-helpers.ts";

function start(): { state: GameState; id: string } {
  let state = startGame(createGame("s3-dice", seatsFor(3), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of state.turnOrder) state = applyGameAction(state, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  const id = state.turnOrder[state.activeIndex];
  state.players[id].fate = 0;
  return { state, id };
}

function place(state: GameState, id: string, roomId: RoomId03, year: Year03): void {
  state.temporal!.locations[id] = { roomId, year };
  state.players[id].carriageIndex = placeKey03(roomId, year);
  state.players[id].ap = 3;
}

function act(state: GameState, id: string, action: GameAction, die: number, fate = 0, supply?: string): GameState {
  rigNextDie(state, die);
  let next = applyGameAction(state, id, action, T0 + 10).state;
  for (let guard = 0; next.pending.length && guard < 15; guard++) {
    const w = next.pending.at(-1)!;
    const answer = w.kind === "FATE_SPEND" ? String(fate) : w.kind === "SUPPLY_CHOICE" ? (supply ?? w.defaultOptionId) : w.defaultOptionId;
    for (const recipient of w.addressees) {
      if (next.pending.at(-1)?.id !== w.id) break;
      next = applyGameAction(next, recipient, { type: "RESPOND", windowId: w.id, optionId: answer }, T0 + 11 + guard).state;
    }
  }
  expect(next.pending).toEqual([]);
  return next;
}

describe("Scenario 03 action dice", () => {
  it.each([
    [1, -1, 0], [2, 0, -1], [4, 0, 1], [6, 0, 2],
  ])("keeps scan's own Fate economy at die %i", (die, sanityDelta, fateDelta) => {
    const { state, id } = start();
    state.players[id].fate = 1;
    const sanity = state.players[id].sanity;
    const fate = state.players[id].fate;
    const next = act(state, id, { type: "SCAN", protocol: "ARCHIVE" }, die);
    expect(next.players[id].sanity).toBe(sanity + sanityDelta);
    expect(next.players[id].fate).toBe(fate + fateDelta);
  });

  it.each(["ARCHIVE", "FIELD", "STABILIZE"] as const)("keeps the %s scan protocol on the original reward rule", (protocol) => {
    const { state, id } = start();
    const next = act(state, id, { type: "SCAN", protocol }, 4);
    expect(next.roll?.purpose).toBe(`S3_SCAN_${protocol}`);
    expect(next.players[id].fate).toBe(1);
  });

  it.each([
    [1, false, -1, 0], [2, false, 0, 0], [4, true, 0, 0], [6, true, 0, 1],
  ])("investigation die %i gates true evidence and only endpoint resources", (die, success, sanityDelta, fateDelta) => {
    const { state, id } = start();
    place(state, id, "ARCHIVES", "Y2026");
    const sanity = state.players[id].sanity;
    const next = act(state, id, { type: "INVESTIGATE" }, die);
    expect(next.players[id].ap).toBe(2);
    expect(next.players[id].sanity).toBe(sanity + sanityDelta);
    expect(next.players[id].fate).toBe(fateDelta);
    expect(next.temporal!.evidence[id].some((e) => e.startsWith("CASE_FILE_"))).toBe(success);
    expect(next.temporal!.story.revealed.includes("OFFICIAL_FILE")).toBe(success);
    expect(project(next, id).myActions.find((a) => a.type === "INVESTIGATE")?.enabled).toBe(!success);
    if (!success) {
      const retry = act(next, id, { type: "INVESTIGATE" }, 4);
      expect(retry.temporal!.evidence[id]).toContain(`CASE_FILE_${retry.temporal!.present.caseFile}`);
    }
  });

  it("records a 1996 investigation trace only on success", () => {
    const { state, id } = start();
    state.act = 2; state.phase = "ACT_2";
    place(state, id, "DIRECTOR_OFFICE", "Y1996");
    const failed = act(state, id, { type: "INVESTIGATE" }, 2);
    expect(failed.temporal!.surveillance).toEqual([]);
    const success = act(failed, id, { type: "INVESTIGATE" }, 4);
    expect(success.temporal!.surveillance).toMatchObject([{ kind: "INVESTIGATION", evidenceId: "ACCESS_LEDGER" }]);
  });

  it.each([
    [1, false, -1, 0], [2, false, 0, 0], [4, true, 0, 0], [6, true, 0, 1],
  ])("intervention die %i only commits a successful causal decision", (die, success, sanityDelta, fateDelta) => {
    const { state, id } = start();
    place(state, id, "ARCHIVES", "Y1996");
    const sanity = state.players[id].sanity;
    const next = act(state, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" }, die);
    expect(next.players[id].ap).toBe(2);
    expect(next.players[id].sanity).toBe(sanity + sanityDelta);
    expect(next.players[id].fate).toBe(fateDelta);
    expect(next.temporal!.interventions).toHaveLength(success ? 1 : 0);
    expect(next.temporal!.present.secretArchiveOpen).toBe(success);
    expect(next.temporal!.causalRevision).toBe(success ? 1 : 0);
    expect(next.temporal!.surveillance.filter((t) => t.kind === "INTERVENTION")).toHaveLength(success ? 1 : 0);
    if (!success) expect(act(next, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" }, 4).temporal!.causalRevision).toBe(1);
  });

  it.each(["ARCHIVIST_00", "ZERO"] as const)("keeps %s speak available after failure", (npcId) => {
    const { state, id } = start();
    if (npcId === "ZERO") { state.act = 3; state.phase = "ACT_3"; place(state, id, "CENTRAL_HALL", "Y2026"); }
    else place(state, id, "ARCHIVES", "Y2026");
    const evidence = npcId === "ZERO" ? "ZERO_TRANSCRIPT" : "ARCHIVIST_NOTE";
    const failed = act(state, id, { type: "INTERACT_NPC", npcId }, 2);
    expect(failed.temporal!.evidence[id]).not.toContain(evidence);
    expect(project(failed, id).myActions.find((a) => a.type === "INTERACT_NPC")?.targets).toContain(npcId);
    const success = act(failed, id, { type: "INTERACT_NPC", npcId }, 6);
    expect(success.temporal!.evidence[id]).toContain(evidence);
    expect(success.players[id].fate).toBe(1);
    expect(project(success, id).myActions.find((a) => a.type === "INTERACT_NPC")?.targets).not.toContain(npcId);
  });

  it("a disastrous conversation costs Sanity without inventing testimony", () => {
    const { state, id } = start();
    place(state, id, "ARCHIVES", "Y2026");
    const sanity = state.players[id].sanity;
    const next = act(state, id, { type: "INTERACT_NPC", npcId: "ARCHIVIST_00" }, 1);
    expect(next.players[id].sanity).toBe(sanity - 1);
    expect(next.temporal!.evidence[id]).toEqual([]);
    expect(next.temporal!.story.revealed).not.toContain("ARCHIVIST_CONTACT");
  });

  it("search failure preserves the allowance; success draws one supply; perfect chooses exactly one", () => {
    const { state, id } = start();
    place(state, id, "RESEARCH_WING", "Y2026");
    const failed = act(state, id, { type: "SEARCH" }, 2);
    expect(failed.players[id].items).toEqual([]);
    expect(failed.players[id].counters.s03Searched).toBeUndefined();
    const success = act(failed, id, { type: "SEARCH" }, 4);
    expect(["PHASE_BATTERY", "SEDATIVE03"]).toContain(success.players[id].items[0]);
    expect(success.players[id].items).toHaveLength(1);

    const fresh = start();
    place(fresh.state, fresh.id, "RESEARCH_WING", "Y2026");
    const perfect = act(fresh.state, fresh.id, { type: "SEARCH" }, 6, 0, "SEDATIVE03");
    expect(perfect.players[fresh.id].items).toEqual(["SEDATIVE03"]);
    expect(perfect.players[fresh.id].fate).toBe(1);
    expect(perfect.players[fresh.id].counters.s03Searched).toBe(1);
  });

  it("persists a perfect search choice and awards the selected supply only once", () => {
    const { state, id } = start();
    place(state, id, "RESEARCH_WING", "Y2026");
    rigNextDie(state, 6);
    const rolled = applyGameAction(state, id, { type: "SEARCH" }, T0 + 10).state;
    const window = rolled.pending.at(-1)!;
    expect(window.kind).toBe("SUPPLY_CHOICE");
    expect(window.options.map((option) => option.id)).toEqual(["PHASE_BATTERY", "SEDATIVE03"]);
    expect(rolled.players[id].items).toEqual([]);
    const restored = JSON.parse(JSON.stringify(rolled)) as GameState;
    const done = applyGameAction(restored, id, { type: "RESPOND", windowId: window.id, optionId: "PHASE_BATTERY" }, T0 + 11).state;
    expect(done.players[id].items).toEqual(["PHASE_BATTERY"]);
    expect(() => applyGameAction(done, id, { type: "RESPOND", windowId: window.id, optionId: "PHASE_BATTERY" }, T0 + 12)).toThrow();
  });

  it.each([
    [1, 0, false], [2, 6, false], [3, 5, false], [3, 6, true], [4, 6, true],
  ])("time jump in Act %i at Collapse %i rolls only when unstable", (actNumber, collapse, rolled) => {
    const { state, id } = start();
    state.act = actNumber as GameState["act"];
    state.phase = `ACT_${actNumber}` as GameState["phase"];
    state.collapse = collapse;
    const next = act(state, id, { type: "TIME_JUMP" }, 2);
    expect(next.temporal!.locations[id]).toEqual({ roomId: "CENTRAL_HALL", year: "Y1996" });
    expect(next.players[id].ap).toBe(1);
    expect(next.roll?.purpose === "S3_TIME_JUMP").toBe(rolled);
    expect(next.temporal!.surveillance.some((t) => t.kind === "ARRIVAL")).toBe(true);
  });

  it("unstable jump arrives on every tier and only Failure grants temporal lag", () => {
    for (const [die, sanityDelta, fateDelta] of [[1, -1, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0], [5, 0, 0], [6, 0, 1]]) {
      const { state, id } = start();
      state.act = 3; state.phase = "ACT_3"; state.collapse = 6;
      const sanity = state.players[id].sanity;
      const next = act(state, id, { type: "TIME_JUMP" }, die);
      expect(next.temporal!.locations[id]).toEqual({ roomId: "CENTRAL_HALL", year: "Y1996" });
      expect(next.players[id].sanity).toBe(sanity + sanityDelta);
      expect(next.players[id].fate).toBe(fateDelta);
      expect(next.players[id].statuses.filter((status) => status.kind === "TEMPORAL_LAG")).toHaveLength(die === 2 || die === 3 ? 1 : 0);
    }
  });

  it("persists temporal lag through reconnect, reduces next cycle AP once, then clears", () => {
    const { state, id } = start();
    state.act = 3; state.phase = "ACT_3"; state.collapse = 6;
    const failed = act(state, id, { type: "TIME_JUMP" }, 2);
    expect(failed.players[id].ap).toBe(1);
    expect(failed.players[id].statuses).toMatchObject([{ kind: "TEMPORAL_LAG", expiresAtRound: 2, hidden: false }]);
    const restored = JSON.parse(JSON.stringify(failed)) as GameState;
    const reconnected = setAway(setAway(restored, id, true, T0 + 30).state, id, false, T0 + 31).state;
    expect(project(reconnected, id).players[id].statuses).toMatchObject([{ kind: "TEMPORAL_LAG" }]);
    expect(project(reconnected, reconnected.turnOrder.find((other) => other !== id)!).players[id].statuses).toMatchObject([{ kind: "TEMPORAL_LAG" }]);
    expect(statusName(scenarioText("en"), "TEMPORAL_LAG")).toBe("Temporal lag −1 AP");
    expect(statusName(scenarioText("zh-CN"), "TEMPORAL_LAG")).toBe("时间迟滞 −1 行动点");

    let next = reconnected;
    for (let turn = 0; turn < 3; turn++) next = endTurn03(next, T0 + 40 + turn);
    expect(next.round).toBe(2);
    expect(next.players[id].ap).toBe(2);
    expect(next.players[id].statuses).toHaveLength(1);
    for (let turn = 0; turn < 3; turn++) next = endTurn03(next, T0 + 50 + turn);
    expect(next.round).toBe(3);
    expect(next.players[id].ap).toBe(3);
    expect(next.players[id].statuses).not.toContainEqual(expect.objectContaining({ kind: "TEMPORAL_LAG" }));
  });

  it("does not stack temporal lag and keeps at least 1 AP", () => {
    const { state, id } = start();
    state.act = 3; state.phase = "ACT_3"; state.collapse = 6;
    const first = act(state, id, { type: "TIME_JUMP" }, 2);
    first.players[id].ap = 3;
    const second = act(first, id, { type: "TIME_JUMP" }, 3);
    expect(second.players[id].statuses.filter((status) => status.kind === "TEMPORAL_LAG")).toHaveLength(1);
    second.players[id].lost = true;
    let next = second;
    for (let turn = 0; turn < 3; turn++) next = endTurn03(next, T0 + 60 + turn);
    expect(next.round).toBe(2);
    expect(next.players[id].ap).toBe(1);
  });

  it("a new failed jump during the affected cycle schedules one later penalty", () => {
    const { state, id } = start();
    state.act = 3; state.phase = "ACT_3"; state.collapse = 6;
    let next = act(state, id, { type: "TIME_JUMP" }, 2);
    for (let turn = 0; turn < 3; turn++) next = endTurn03(next, T0 + 70 + turn);
    expect(next.round).toBe(2);
    expect(next.players[id].ap).toBe(2);
    next = act(next, id, { type: "TIME_JUMP" }, 3);
    expect(next.players[id].statuses).toMatchObject([{ kind: "TEMPORAL_LAG", expiresAtRound: 3 }]);
    for (let turn = 0; turn < 3; turn++) next = endTurn03(next, T0 + 80 + turn);
    expect(next.round).toBe(3);
    expect(next.players[id].ap).toBe(2);
    expect(next.players[id].statuses.filter((status) => status.kind === "TEMPORAL_LAG")).toHaveLength(1);
  });

  it.each([[3, 1, 4], [5, 1, 6], [1, 2, 3]])("Fate changes %i by %i to %i before the outcome", (die, spend, final) => {
    const { state, id } = start();
    state.players[id].fate = 2;
    place(state, id, "ARCHIVES", "Y2026");
    const next = act(state, id, { type: "INVESTIGATE" }, die, spend);
    expect(next.roll).toMatchObject({ raw: die, fateSpent: spend, final });
    expect(next.temporal!.evidence[id].length).toBe(final >= 4 ? 1 : 0);
    expect(next.players[id].sanity).toBe(state.players[id].sanity);
  });

  it("caps Fate at two and applies Help before offering it", () => {
    const { state, id } = start();
    state.players[id].fate = 4;
    state.players[id].helpBonus = 1;
    place(state, id, "ARCHIVES", "Y2026");
    rigNextDie(state, 2);
    const pending = applyGameAction(state, id, { type: "INVESTIGATE" }, T0 + 10).state;
    expect(pending.roll).toMatchObject({ raw: 2, final: 3, modifiers: [{ delta: 1 }] });
    expect(pending.pending.at(-1)?.kind).toBe("FATE_SPEND");
    expect(pending.pending.at(-1)?.options.map((option) => option.id)).toEqual(["0", "1", "2"]);
    const done = applyGameAction(pending, id, { type: "RESPOND", windowId: pending.pending.at(-1)!.id, optionId: "1" }, T0 + 11).state;
    expect(done.roll).toMatchObject({ final: 4, fateSpent: 1 });
    expect(done.temporal!.evidence[id]).toHaveLength(1);
  });

  it("lets a shared roll reaction turn a failed investigation into a success", () => {
    const { state, id } = start();
    state.players[id].characterId = "aries-intj";
    state.players[id].skill = { usesLeft: 1, state: "READY" };
    place(state, id, "ARCHIVES", "Y2026");
    rigNextDie(state, 3);
    const pending = applyGameAction(state, id, { type: "INVESTIGATE" }, T0 + 10).state;
    const reaction = pending.pending.at(-1)!;
    expect(reaction.kind).toBe("REACTION");
    expect(pending.roll?.tier).toBe("FAIL");
    const done = applyGameAction(pending, id, { type: "RESPOND", windowId: reaction.id, optionId: "USE" }, T0 + 11).state;
    expect(done.roll?.tier).toBe("SUCCESS");
    expect(done.temporal!.evidence[id]).toContain(`CASE_FILE_${done.temporal!.present.caseFile}`);
    expect(done.players[id].skill.usesLeft).toBe(0);
  });

  it("persists one pending intervention across reconnect and applies it only once", () => {
    const { state, id } = start();
    state.players[id].fate = 1;
    place(state, id, "ARCHIVES", "Y1996");
    rigNextDie(state, 3);
    const pending = applyGameAction(state, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" }, T0 + 10).state;
    const window = pending.pending.at(-1)!;
    expect(window.kind).toBe("FATE_SPEND");
    expect(pending.temporal!.interventions).toEqual([]);
    expect(() => applyGameAction(pending, id, { type: "INTERVENE", nodeId: "ARCHIVE_GATE", choiceId: "OPEN" }, T0 + 11)).toThrow();
    const disconnected = setAway(pending, id, true, T0 + 11).state;
    expect(disconnected.pending.at(-1)?.id).toBe(window.id);
    expect(disconnected.roll?.done).toBe(false);
    const ticked = tickGame(disconnected, T0 + 12).state;
    expect(ticked.pending.at(-1)?.id).toBe(window.id);
    const restored = JSON.parse(JSON.stringify(ticked)) as GameState;
    const reconnected = setAway(restored, id, false, T0 + 13).state;
    expect(reconnected.pending.at(-1)?.id).toBe(window.id);
    expect(project(reconnected, id).pending.at(-1)?.id).toBe(window.id);
    const done = applyGameAction(reconnected, id, { type: "RESPOND", windowId: window.id, optionId: "1" }, T0 + 14).state;
    expect(done.roll).toMatchObject({ final: 4, done: true });
    expect(done.temporal!.interventions).toHaveLength(1);
    expect(done.temporal!.causalRevision).toBe(1);
    expect(done.temporal!.surveillance.filter((t) => t.kind === "INTERVENTION")).toHaveLength(1);
    expect(() => applyGameAction(done, id, { type: "RESPOND", windowId: window.id, optionId: "1" }, T0 + 13)).toThrow();
    expect(JSON.parse(JSON.stringify(done)).temporal.interventions).toHaveLength(1);
  });
});
