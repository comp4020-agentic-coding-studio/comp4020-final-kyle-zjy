// @vitest-environment jsdom
// The ending film's handoff: it holds the screen through its scenes and card,
// hands back only after the fade (whether it ran out or was skipped), and the
// score is faded and its effects cut on the way out.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sound = vi.hoisted(() => ({ setTheme: vi.fn(), tension: vi.fn(), play: vi.fn(), hush: vi.fn() }));
vi.mock("motion/react", async () => {
  const { createElement } = await import("react");
  const strip = (tag: string) => ({ initial: _i, animate: _a, exit: _e, transition: _t, ...props }: Record<string, unknown>) => createElement(tag, props);
  return { useReducedMotion: () => false, AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion: { div: strip("div") } };
});
vi.mock("../src/client/audio/manager.ts", () => ({ audio: sound }));
vi.mock("../src/client/audio/AudioControl.tsx", () => ({ AudioControl: () => null }));

const { EndingFilm } = await import("../src/client/game/ending/EndingFilm.tsx");
const { ENDING_FILMS } = await import("../src/client/game/ending/cinematics.ts");

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const facts = { me: "Bea", names: ["Ada", "Bea", "Cal"], aboard: ["Ada"], seat: 2, debt: 6 };
let host: HTMLDivElement;
beforeEach(() => { vi.useFakeTimers(); Object.values(sound).forEach((f) => f.mockClear()); });
afterEach(() => { vi.useRealTimers(); host?.remove(); });

async function mount(id: keyof typeof ENDING_FILMS, onDone: () => void) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(EndingFilm, { id, facts, onDone })));
  return root;
}
const advance = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
const film = () => host.querySelector("[data-ending]")!;

describe("ending film handoff", () => {
  it("plays through its scenes to the card, then hands back only after the fade", async () => {
    const onDone = vi.fn();
    const root = await mount("s02_last_light", onDone);
    const total = ENDING_FILMS.s02_last_light.scenes.reduce((n, s) => n + s.duration, 0) * 1000;
    expect(film().getAttribute("data-scene")).toBe("stay");
    expect(sound.setTheme).toHaveBeenCalledWith("s02_ending");
    await advance(total - 3000);
    expect(film().getAttribute("data-scene")).toBe("card");
    expect(host.textContent).toContain("The Last Light");
    expect(onDone).not.toHaveBeenCalled();
    await advance(3200);
    // the card has had its time; the frame is fading and the score falling away
    expect(film().className).toContain("is-ending");
    expect(sound.tension).toHaveBeenLastCalledWith(0, expect.any(Number));
    expect(onDone).not.toHaveBeenCalled();
    await advance(2500);
    expect(onDone).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    expect(sound.hush).toHaveBeenCalled();
  });

  it("skips from the button after two seconds: the score fades over about a second, then hands back once", async () => {
    const onDone = vi.fn();
    await mount("s04_debt_follows", onDone);
    const skip = [...host.querySelectorAll("button")].find((b) => b.textContent === "Skip Ending")!;
    expect(skip.className).not.toContain("is-visible");
    await advance(2100);
    expect(skip.className).toContain("is-visible");
    await act(async () => skip.click());
    expect(sound.tension).toHaveBeenLastCalledWith(0, 1);
    expect(sound.hush).toHaveBeenCalled();
    await act(async () => skip.click());
    await advance(1100);
    expect(onDone).toHaveBeenCalledTimes(1);
    // no foley is scheduled once the film has closed
    const played = sound.play.mock.calls.length;
    await advance(10_000);
    expect(sound.play.mock.calls.length).toBe(played);
  });

  it("shows only the viewer's own debt on the ledger", async () => {
    await mount("s04_debt_follows", vi.fn());
    const ledger = ENDING_FILMS.s04_debt_follows.scenes;
    const before = ledger.slice(0, ledger.findIndex((s) => s.id === "ledger")).reduce((n, s) => n + s.duration, 0);
    await advance(before * 1000 + 500);
    expect(film().getAttribute("data-scene")).toBe("ledger");
    expect(host.querySelector(".end-ledger")!.textContent).toContain("6");
  });
});
