import type { Effect } from "../effects.ts";
import type { ItemInfo } from "../scenario01/content.ts";
import type { RoomId03 } from "./map.ts";

export type S03ItemId = "TIME_MARKER" | "AUTHORITY_CARD" | "OLD_BADGE" | "PHASE_BATTERY" | "SEDATIVE03";

export const ITEMS03: Record<S03ItemId, ItemInfo> = {
  TIME_MARKER: { name: "Time Marker", text: "A numbered relic whose 1996 source must be placed in the Archives.", effects: [] },
  AUTHORITY_CARD: { name: "Authority Card", text: "A numbered relic whose 1996 source must be placed in the Central Hall.", effects: [] },
  OLD_BADGE: { name: "Old Badge", text: "A badge preserved in the Research Wing's containment cabinet.", effects: [] },
  PHASE_BATTERY: { name: "Phase Battery", text: "Gain 1 action point this turn.", effects: [{ kind: "GAIN_AP", who: "SELF", amount: 1 }] as Effect[] },
  SEDATIVE03: { name: "Sedative", text: "Recover 1 Sanity.", effects: [{ kind: "GAIN_SANITY", who: "SELF", amount: 1 }] as Effect[] },
};

/** Generic rewards may draw only these consumables, never numbered relics. */
export const ORDINARY_POOL03: S03ItemId[] = ["PHASE_BATTERY", "SEDATIVE03"];
export const RELIC_STORAGE03: Partial<Record<S03ItemId, RoomId03>> = {
  TIME_MARKER: "ARCHIVES",
  AUTHORITY_CARD: "CENTRAL_HALL",
  OLD_BADGE: "RESEARCH_WING",
};

/** Protected 1996 fixtures inside existing rooms; none is a map node. */
export const PROTECTED_STORAGE03: Partial<Record<RoomId03, "LOCKBOX" | "SEALED_CABINET" | "SHIELDED_CABINET">> = {
  CENTRAL_HALL: "LOCKBOX",
  ARCHIVES: "SEALED_CABINET",
  RESEARCH_WING: "SHIELDED_CABINET",
};
