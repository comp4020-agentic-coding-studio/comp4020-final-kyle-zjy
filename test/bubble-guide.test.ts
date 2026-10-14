// @vitest-environment jsdom
// The first-view guide: four to six notes per scenario with copy in both
// locales, a per-scenario seen marker, notes that skip a missing region
// instead of stalling, and Skip/Escape that clear the overlay.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const { createElement, forwardRef } = await import("react");
  const div = forwardRef(({ initial: _i, animate: _a, exit: _e, transition: _t, ...props }: Record<string, unknown>, ref) => createElement("div", { ...props, ref }));
  return { useReducedMotion: () => true, AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion: { div } };
});

const { BubbleGuide, placeBubble } = await import("../src/client/components/guide/BubbleGuide.tsx");
const { GUIDES, GUIDE_STEP_MS, forgetGuides, guideSeen, rememberGuide } = await import("../src/client/components/guide/steps.ts");
const { CATALOGS } = await import("../src/client/i18n/index.ts");

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
beforeEach(() => { vi.useFakeTimers(); forgetGuides(); });
afterEach(() => { vi.useRealTimers(); host?.remove(); document.body.innerHTML = ""; });

/** A page with these anchors, each laid out on screen. */
function page(anchors: string[]) {
  for (const a of anchors) {
    const el = document.createElement(a === "end" ? "button" : "div");
    if (a === "end") el.dataset.action = "END_TURN"; else el.dataset.guide = a;
    el.getBoundingClientRect = () => ({ top: 100, left: 20, width: 200, height: 40, right: 220, bottom: 140, x: 20, y: 100, toJSON: () => ({}) });
    el.getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList;
    document.body.append(el);
  }
}
async function mount(scenario: keyof typeof GUIDES, onDone: () => void) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(BubbleGuide, { scenario, onDone })));
  return root;
}
const advance = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });

describe("bubble guide", () => {
  it("has four to six notes per scenario, each with a title and body in both locales", () => {
    for (const steps of Object.values(GUIDES)) {
      expect(steps.length).toBeGreaterThanOrEqual(4);
      expect(steps.length).toBeLessThanOrEqual(6);
      expect(steps.at(-1)!.target).toBe("end");
      for (const s of steps) for (const locale of ["en", "zh-CN"] as const) {
        expect(CATALOGS[locale][s.title], `${locale} ${s.title}`).toBeTruthy();
        expect(CATALOGS[locale][s.body], `${locale} ${s.body}`).toBeTruthy();
      }
    }
  });

  it("remembers a seen guide per scenario, and forgets on request", () => {
    expect(guideSeen("S03_INCIDENT_ZERO")).toBe(false);
    rememberGuide("S03_INCIDENT_ZERO");
    expect(guideSeen("S03_INCIDENT_ZERO")).toBe(true);
    expect(guideSeen("S01_LAST_TRAIN")).toBe(false);
    forgetGuides();
    expect(guideSeen("S03_INCIDENT_ZERO")).toBe(false);
  });

  it("walks through its notes on its own and finishes once", async () => {
    page(["top", "map", "place", "actions", "memory", "end"]);
    const onDone = vi.fn();
    await mount("S01_LAST_TRAIN", onDone);
    expect(document.querySelector("[data-guide-step]")!.getAttribute("data-guide-step")).toBe("goal");
    expect(document.querySelector(".bubble-guide-ring")).not.toBeNull();
    await advance(GUIDE_STEP_MS + 50);
    expect(document.querySelector("[data-guide-step]")!.getAttribute("data-guide-step")).toBe("map");
    for (let i = 0; i < 6; i++) await advance(GUIDE_STEP_MS + 50);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("passes over a note whose region is missing instead of stalling", async () => {
    page(["top", "end"]);
    const onDone = vi.fn();
    await mount("S03_INCIDENT_ZERO", onDone);
    expect(document.querySelector("[data-guide-step]")!.getAttribute("data-guide-step")).toBe("status");
    await advance(GUIDE_STEP_MS + 50);
    // four notes in a row have no region; each is passed over on the next tick
    for (let i = 0; i < 5; i++) await advance(1);
    expect(document.querySelector("[data-guide-step]")!.getAttribute("data-guide-step")).toBe("end");
  });

  it("Skip ends it", async () => {
    page(["top", "map", "place", "actions", "hud", "seats", "end"]);
    const onDone = vi.fn();
    await mount("S04_UNDERGROUND_AUCTION", onDone);
    await act(async () => [...document.querySelectorAll("button")].find((b) => b.textContent === "Skip")!.click());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Escape ends it", async () => {
    page(["top", "map", "place", "actions", "hud", "seats", "end"]);
    const onDone = vi.fn();
    await mount("S02_SUNKEN_CITY", onDone);
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("keeps the bubble on screen near any edge", () => {
    const view = { width: 320, height: 640 };
    for (const box of [{ top: 4, left: 0, width: 40, height: 40 }, { top: 600, left: 290, width: 30, height: 30 }, { top: 200, left: 0, width: 320, height: 420 }]) {
      const p = placeBubble(box, view, { width: 300, height: 140 });
      expect(p.left).toBeGreaterThanOrEqual(12);
      expect(p.left + p.width).toBeLessThanOrEqual(view.width - 12);
      expect(p.top).toBeGreaterThanOrEqual(12);
    }
  });
});
