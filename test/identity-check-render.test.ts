// @vitest-environment jsdom
// The identity file under reduced motion: it heads the dice card (so it can't
// cover the roll), says only public things, and its stamp follows the server.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerView } from "../src/shared/game/state.ts";

const mocks = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("motion/react", async () => {
  const { createElement } = await import("react");
  const strip = (tag: string) => ({ initial: _i, animate: _a, exit: _e, transition: _t, ...props }: Record<string, unknown>) => createElement(tag, props);
  return { useReducedMotion: () => true, AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion: { div: strip("div"), button: strip("button"), p: strip("p"), span: strip("span") } };
});
vi.mock("../src/client/audio/manager.ts", () => ({ audio: { play: mocks.play } }));
vi.mock("../src/client/store.ts", () => ({ sendGame: vi.fn() }));

const { DiceOverlay } = await import("../src/client/game/Dice.tsx");
const { project } = await import("../src/server/engine/project.ts");
const { rigNextDie, Table } = await import("./helpers.ts");

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
afterEach(() => host?.remove());

function viewDuringCheck(): { view: PlayerView; me: string; state: import("../src/shared/game/state.ts").GameState } {
  const t = new Table(3);
  t.playUntil((s) => s.round === 4 && s.step === "PLAYER_TURNS");
  const me = t.active!;
  const s = structuredClone(t.state);
  s.players[me].carriageIndex = s.inspector.carriageIndex;
  s.secrets[me].messages.push({ id: "m1", text: { k: "PRIVATE TRUTH" }, round: 5 });
  s.jobs.push({ kind: "TICKET_CHECK", playerId: me });
  rigNextDie(s, 5);
  t.state = s;
  t.tick(1);
  const viewer = t.state.turnOrder.find((id) => id !== me)!;
  return { view: project(t.state, viewer), me, state: t.state };
}

describe("identity verification under reduced motion", () => {
  it("appears with the passenger's public record, holds CHECKING, and plays the punch once", async () => {
    const { view, me } = viewDuringCheck();
    expect(view.roll?.purpose).toBe("TICKET_CHECK");
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(DiceOverlay, { g: view })));
    const text = host.textContent ?? "";
    expect(text).toContain(view.players[me].nickname);
    expect(text).toContain("Identity verification");
    // the roll waits on the checked passenger's Fate decision, so no verdict yet
    expect(view.roll?.done).toBe(false);
    expect(text).toContain("CHECKING");
    expect(text).not.toMatch(/VERIFIED|WAVERING/);
    // inside the dice card, above the roll: it can't sit on top of the die or the Fate choice
    const file = host.querySelector(".identity-file")!;
    const card = host.querySelector('[role="dialog"]')!;
    expect(file).not.toBeNull();
    expect(card.contains(file)).toBe(true);
    expect(card.firstElementChild).toBe(file);
    expect(text).not.toContain("PRIVATE TRUTH");
    expect(mocks.play).toHaveBeenCalledWith("ticket_punch");
    expect(mocks.play).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});
