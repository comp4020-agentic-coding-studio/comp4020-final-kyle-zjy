import { describe, expect, it } from "vitest";
import { createGame } from "../src/server/engine/create.ts";
import { startGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { generateAuctionPool04 } from "../src/server/engine/scenario04/pool.ts";
import { seedState } from "../src/server/engine/rng.ts";
import { LOTS04 } from "../src/shared/game/scenario04/lots.ts";
import { seatsFor, T0 } from "./helpers.ts";

describe("Scenario 04 structured lot draw", () => {
  it("draws a reproducible nine-lot mix and then exactly two fakes across 1000 seeds", () => {
    const seen = new Set<string>();
    const layouts = new Set<string>();
    const draw = (seed: string) => generateAuctionPool04({ rng: seedState(seed), rngCalls: 0 });
    for (let n = 0; n < 1000; n++) {
      const seed = n.toString(16).padStart(32, "0");
      const first = draw(seed);
      expect(first).toEqual(draw(seed));
      expect(first.order).toHaveLength(9);
      expect(new Set(first.order).size).toBe(9);
      expect(first.counterfeit).toHaveLength(2);
      expect(new Set(first.counterfeit).size).toBe(2);
      expect(first.counterfeit.every((id) => first.order.includes(id))).toBe(true);
      expect(first.order).not.toContain("LOT_10");
      const categories = first.order.map((id) => LOTS04.find((lot) => lot.id === id)!.category);
      expect(categories.filter((category) => category === "intel")).toHaveLength(2);
      expect(categories.filter((category) => category === "economy")).toHaveLength(2);
      expect(categories.filter((category) => category === "bidding" || category === "social")).toHaveLength(2);
      expect(categories.filter((category) => category === "gambling")).toHaveLength(1);
      expect(categories.filter((category) => category === "highRisk")).toHaveLength(1);
      expect(categories.filter((category) => category === "endgame")).toHaveLength(1);
      first.order.forEach((id) => seen.add(id));
      layouts.add(first.order.join(","));
    }
    expect(seen.size).toBe(29);
    expect(layouts.size).toBeGreaterThan(900);
  });

  it("persists the draw and never projects authenticity or future order to ordinary players", () => {
    const s = startGame(createGame("pool", seatsFor(3), "0123456789abcdef0123456789abcdef", T0, "S04_UNDERGROUND_AUCTION"), T0).state;
    expect(s.auction!.currentLot).toBe(s.auction!.lotOrder![0]);
    expect(s.auction!.lotOrder).toHaveLength(9);
    const visible = JSON.stringify(project(s, "a").auction);
    expect(visible).not.toContain("counterfeitLots");
    expect(visible).not.toContain("lotOrder");
    expect(visible).not.toContain("itemInstances");
    expect(visible).not.toContain("debugPool");
  });
});
