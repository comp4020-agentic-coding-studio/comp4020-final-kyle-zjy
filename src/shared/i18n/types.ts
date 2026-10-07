// Locales and the message type that game state carries instead of sentences.
// English is the canonical locale: its wording lives in the source (engine
// templates, scenario content, the client's en catalog); other locales map
// onto it (docs/localization.md).

export const LOCALES = ["en", "zh-CN"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const isLocale = (x: unknown): x is Locale => typeof x === "string" && (LOCALES as readonly string[]).includes(x);

/**
 * A message in game state. `k` is the English template, with {0}, {1}… for
 * `p`; a key starting with "@" is a reference to scenario content by id
 * (a carriage, an item, a skill…) that each locale names in its own words.
 * Player nicknames travel as plain strings and are never translated.
 */
export type Msg = { k: string; p?: MsgParam[] };
export type MsgParam = string | number | Msg;

export const isMsg = (x: unknown): x is Msg => typeof x === "object" && x !== null && typeof (x as Msg).k === "string";
