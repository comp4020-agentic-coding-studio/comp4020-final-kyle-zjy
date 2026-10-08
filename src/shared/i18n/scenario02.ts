// Scenario 02's content text by id. English comes from the content itself;
// Chinese is in zh-CN/scenario02.ts.
import { ITEMS02, PARTS, STATUSES02 } from "../game/scenario02/items.ts";
import { ZONES } from "../game/scenario02/map.ts";
import { NPCS } from "../game/scenario02/npcs.ts";
import { EVENTS02 } from "../game/scenario02/events.ts";
import type { Locale } from "./types.ts";
import { ZH_SCENARIO02 } from "./zh-CN/scenario02.ts";

export type NameText = { name: string; text: string };
export type Scenario02Text = {
  scenario: { title: string; tagline: string };
  zones: Record<string, NameText>;
  items: Record<string, NameText>;
  parts: Record<string, NameText>;
  npcs: Record<string, NameText>;
  statuses: Record<string, { short: string; long: string }>;
  events: Record<string, { title: string; text: string; options?: Record<string, { label: string; detail: string }> }>;
  goals: Record<string, string>;
};

const byId = <T extends { id: string; name: string; text: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, { name: x.name, text: x.text }]));
const names = (rec: Record<string, { name: string; text: string }>) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, { name: v.name, text: v.text }]));

export const EN_SCENARIO02: Scenario02Text = {
  scenario: { title: "Sunken City: The Last High Ground", tagline: "The water is coming. The boat can't take everyone." },
  zones: byId(ZONES),
  items: names(ITEMS02),
  parts: names(PARTS),
  npcs: byId(NPCS),
  statuses: STATUSES02,
  events: Object.fromEntries(EVENTS02.map((e) => [e.id, { title: e.title, text: e.text, options: e.options && Object.fromEntries(e.options.map((o) => [o.id, { label: o.label, detail: o.detail }])) }])),
  goals: { REPAIR: "make a repair", FRAGMENT: "find a boat part or a pass", HELP: "help someone", NEW_CARRIAGE: "reach a zone you haven't been to" },
};

export function scenario02Text(locale: Locale): Scenario02Text {
  return locale === "zh-CN" ? ZH_SCENARIO02 : EN_SCENARIO02;
}
