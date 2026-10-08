// Scenario 02's things to carry. Ordinary items are used up and can be traded;
// boat parts are key items, kept apart from the item list (CityState.holdings)
// so no random grant, steal or copy can ever touch them.
import type { Effect } from "../effects.ts";
import type { ItemInfo } from "../scenario01/content.ts";

export type S02ItemId = "LIFE_JACKET" | "ROPE" | "WATERPROOF_TORCH" | "FIRST_AID_KIT" | "SEDATIVE" | "TOOLKIT" | "EMERGENCY_BATTERY" | "CROWBAR" | "INFLATABLE_RAFT";

const status = (s: string, value?: number): Effect => ({ kind: "ADD_STATUS", who: "SELF", status: s, rounds: 99, polarity: "POSITIVE", ...(value ? { value } : {}) });

export const ITEMS02: Record<S02ItemId, ItemInfo> = {
  LIFE_JACKET: { name: "Life Jacket", text: "Your next wade can't fail.", effects: [status("BUOYANT")] },
  ROPE: { name: "Rope", text: "+2 to your next wade or rescue roll.", effects: [status("ROPE_BONUS", 2)] },
  WATERPROOF_TORCH: { name: "Waterproof Torch", text: "+2 to your next Search or Investigate roll.", effects: [status("INVESTIGATE_BONUS", 2)] },
  FIRST_AID_KIT: { name: "First Aid Kit", text: "Restore 1 Sanity to yourself or someone in your zone.", effects: [{ kind: "GAIN_SANITY", who: "TARGET", amount: 1 }], needsTarget: "SAME_CARRIAGE_OR_SELF" },
  SEDATIVE: { name: "Sedative", text: "Restore 1 Sanity and clear one ordinary negative status.", effects: [{ kind: "GAIN_SANITY", who: "SELF", amount: 1 }, { kind: "REMOVE_STATUS", who: "SELF", polarity: "NEGATIVE", count: 1, ordinaryOnly: true }] },
  TOOLKIT: { name: "Toolkit", text: "+2 to your next Repair roll.", effects: [status("REPAIR_BONUS", 2)] },
  EMERGENCY_BATTERY: { name: "Emergency Battery", text: "+1 action point this turn.", effects: [{ kind: "GAIN_AP", who: "SELF", amount: 1 }] },
  CROWBAR: { name: "Crowbar", text: "+2 to your next Salvage roll.", effects: [status("RISK_BONUS", 2)] },
  INFLATABLE_RAFT: { name: "Inflatable Raft", text: "Carried, not used: lets one move cross a sunken zone to the dry zone beyond it. Spent when it does.", effects: [] },
};

export const ITEM_IDS02 = Object.keys(ITEMS02) as S02ItemId[];
/** Items that help a later roll (the BUFF pool for abilities that grant one). */
export const BUFF_ITEMS02: S02ItemId[] = ["LIFE_JACKET", "ROPE", "WATERPROOF_TORCH", "TOOLKIT", "CROWBAR"];

/** Boat parts and the rare chip. Carried in holdings, traded, never used up. */
export type PartId = "ENGINE" | "FUEL" | "NAV" | "CHIP";
export const PARTS: Record<PartId, { name: string; text: string }> = {
  ENGINE: { name: "Engine Block", text: "Heavy, oily, and the only one in the city that still turns over." },
  FUEL: { name: "Fuel Drums", text: "Enough diesel to get one boat out past the breakwater." },
  NAV: { name: "Navigation Module", text: "Charts the way out through streets that are now sea." },
  CHIP: { name: "Auto-Control Chip", text: "Runs the pier gate from the boat. Not every run has one. With it fitted, nobody has to stay behind." },
};
export const PART_IDS = Object.keys(PARTS) as PartId[];
/** The three the boat cannot leave without. */
export const BOAT_PARTS: PartId[] = ["ENGINE", "FUEL", "NAV"];

/** Statuses only scenario 02 gives, with their display names. */
export const STATUSES02: Record<string, { short: string; long: string }> = {
  BUOYANT: { short: "Life jacket", long: "Life jacket (your next wade can't fail)" },
  ROPE_BONUS: { short: "Rope +2", long: "Rope (+2 to your next wade or rescue)" },
  RISK_BONUS: { short: "Crowbar +2", long: "Crowbar (+2 to your next salvage)" },
};
