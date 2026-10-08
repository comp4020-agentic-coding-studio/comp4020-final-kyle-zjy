import { ITEMS03 } from "../game/scenario03/items.ts";
import { EVENTS03 } from "../game/scenario03/events.ts";
import type { S03ItemId } from "../game/scenario03/items.ts";
import type { Locale } from "./types.ts";
import { ZH_ITEMS03 } from "./zh-CN/scenario03.ts";

export const EN_ITEMS03 = Object.fromEntries(Object.entries(ITEMS03).map(([id, item]) => [id, { name: item.name, text: item.text }])) as Record<S03ItemId, { name: string; text: string }>;

export const EN_EVENTS03 = Object.fromEntries(EVENTS03.map((event) => [event.id, { title: event.title, text: event.text, options: event.options && Object.fromEntries(event.options.map((option) => [option.id, { label: option.label, detail: option.detail }])) }]));

export const EN_GOALS03: Record<string, string> = {
  REPAIR: "record a causal intervention",
  FRAGMENT: "find new evidence",
  HELP: "help a teammate prepare a temporal scan",
  NEW_CARRIAGE: "enter a room and year you have not visited",
};

export const scenario03Items = (locale: Locale) => locale === "zh-CN" ? ZH_ITEMS03 : EN_ITEMS03;
