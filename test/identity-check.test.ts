import { describe, expect, it } from "vitest";
import { identityRecord01 } from "../src/client/game/IdentityCheck01.tsx";
import { project } from "../src/server/engine/project.ts";
import { isKeyItem } from "../src/shared/game/scenario01/content.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { rigNextDie, Table } from "./helpers.ts";

/** A round-4 table with the active player standing with the Inspector and a check queued. */
function queued(): { t: Table; me: string } {
  const t = new Table(3);
  t.playUntil((s) => s.round === 4 && s.step === "PLAYER_TURNS");
  const me = t.active!;
  const s = structuredClone(t.state);
  s.players[me].carriageIndex = s.inspector.carriageIndex;
  s.jobs.push({ kind: "TICKET_CHECK", playerId: me });
  rigNextDie(s, 2);
  t.state = s;
  return { t, me };
}

describe("scenario 01 identity verification", () => {
  it("a ticket check is a public TICKET_CHECK roll every viewer can see", () => {
    const { t, me } = queued();
    const step = t.tick(1);
    expect(step.events.some((e) => e.kind === "ROLL" && e.payload.purpose === "TICKET_CHECK" && e.payload.playerId === me)).toBe(true);
    for (const viewer of t.state.turnOrder) expect(project(t.state, viewer).roll).toMatchObject({ purpose: "TICKET_CHECK", playerId: me });
  });

  it("draws its record only from public facts: never a private truth, an obsession or an ordinary item", () => {
    const { t, me } = queued();
    const s: GameState = structuredClone(t.state);
    // give the checked passenger every kind of secret, and an ordinary item
    s.secrets[me].messages.push({ id: "m1", text: { k: "PRIVATE TRUTH" }, round: 5 });
    s.secrets[me].obsession = "LONE_WOLF";
    s.players[me].items = ["FLASHLIGHT"];
    const viewer = s.turnOrder.find((id) => id !== me)!;
    const view = project(s, viewer);
    const record = identityRecord01(view, view.players[me]);
    expect(record.kind).toBe("PLACE");
    expect(JSON.stringify(record)).not.toMatch(/PRIVATE TRUTH|LONE_WOLF|FLASHLIGHT/);
    // a key item is shown, because keys are public on the train
    s.players[me].items = ["FLASHLIGHT", "POWER_KEY"];
    const withKey = identityRecord01(project(s, viewer), project(s, viewer).players[me]);
    expect(withKey).toEqual({ kind: "KEY", item: "POWER_KEY" });
    expect(isKeyItem("POWER_KEY")).toBe(true);
    // a repaired anchor, which the whole table saw, ranks first
    s.anchors.IDENTITY = { ...s.anchors.IDENTITY, repaired: true, lastRepairedBy: me };
    expect(identityRecord01(project(s, viewer), project(s, viewer).players[me])).toEqual({ kind: "ANCHOR", anchor: "IDENTITY" });
  });

  it("is the same record for every viewer, the checked passenger included", () => {
    const { t, me } = queued();
    const records = t.state.turnOrder.map((viewer) => { const v = project(t.state, viewer); return identityRecord01(v, v.players[me]); });
    expect(new Set(records.map((r) => JSON.stringify(r))).size).toBe(1);
  });
});
