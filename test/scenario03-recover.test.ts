import { expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { seatsFor, SEED, T0 } from "./helpers.ts";

it("recovers one Sanity for one AP and rejects full Sanity without changing state", () => {
  let s = startGame(createGame("recover", seatsFor(3), SEED, T0, "S03_INCIDENT_ZERO"), T0).state;
  for (const id of s.turnOrder) s = applyGameAction(s, id, { type: "ACK_SEQUENCE" }, T0 + 1).state;
  const id = s.turnOrder[s.activeIndex];
  s.players[id].sanity = 2;
  const beforeAp = s.players[id].ap;
  const next = applyGameAction(s, id, { type: "RECOVER" }, T0 + 2).state;
  expect(next.players[id].sanity).toBe(3);
  expect(next.players[id].ap).toBe(beforeAp - 1);
  expect(project(next, id).myActions.find((a) => a.type === "RECOVER")?.enabled).toBe(false);
  const copy = structuredClone(next);
  expect(() => applyGameAction(next, id, { type: "RECOVER" }, T0 + 3)).toThrow();
  expect(next).toEqual(copy);
  s.players[id].ap = 0;
  expect(() => applyGameAction(s, id, { type: "RECOVER" }, T0 + 4)).toThrow();
});
