// The first-view bubble guide: per scenario, four to six short notes that
// each point at one region of the screen (a `data-guide` anchor) and say what
// it is for. Data only; BubbleGuide.tsx plays it. Whether a player has seen a
// scenario's guide is remembered per scenario on this device.
import type { ScenarioId } from "../../../shared/game/state.ts";
import type { MessageKey } from "../../i18n/index.ts";

export type GuideStep = { id: string; target: string; title: MessageKey; body: MessageKey };

const step = (n: number, id: string, target: string): GuideStep => ({ id, target, title: `guide.s${n}.${id}.title` as MessageKey, body: `guide.s${n}.${id}.body` as MessageKey });

export const GUIDES: Record<ScenarioId, readonly GuideStep[]> = {
  S01_LAST_TRAIN: [step(1, "goal", "top"), step(1, "map", "map"), step(1, "place", "place"), step(1, "actions", "actions"), step(1, "memory", "memory"), step(1, "end", "end")],
  S02_SUNKEN_CITY: [step(2, "status", "top"), step(2, "map", "map"), step(2, "place", "place"), step(2, "actions", "actions"), step(2, "boat", "top"), step(2, "end", "end")],
  S03_INCIDENT_ZERO: [step(3, "status", "top"), step(3, "map", "map"), step(3, "dossier", "dossier"), step(3, "place", "place"), step(3, "actions", "actions"), step(3, "end", "end")],
  S04_UNDERGROUND_AUCTION: [step(4, "status", "top"), step(4, "lot", "map"), step(4, "seats", "seats"), step(4, "actions", "actions"), step(4, "resources", "hud"), step(4, "end", "end")],
};

/** How long each note stays before the next, unless the player moves on. */
export const GUIDE_STEP_MS = 2600;

const KEY = (scenario: ScenarioId) => `fate:guide:${scenario}`;
const seen = new Set<string>();
export function guideSeen(scenario: ScenarioId): boolean {
  if (seen.has(scenario)) return true;
  try { return localStorage.getItem(KEY(scenario)) === "1"; } catch { return false; }
}
export function rememberGuide(scenario: ScenarioId): void {
  seen.add(scenario);
  try { localStorage.setItem(KEY(scenario), "1"); } catch { /* this document still remembers */ }
}
export function forgetGuides(): void {
  seen.clear();
  try { for (const id of Object.keys(GUIDES)) localStorage.removeItem(KEY(id as ScenarioId)); } catch { /* nothing stored */ }
}

/** The first visible element for an anchor (phones and desktops can each hide one copy). */
export function guideTarget(anchor: string, root: ParentNode = document): HTMLElement | null {
  const end = anchor === "end" ? '[data-action="END_TURN"]' : `[data-guide="${anchor}"]`;
  return ([...root.querySelectorAll<HTMLElement>(end)].find((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0) ?? null);
}
