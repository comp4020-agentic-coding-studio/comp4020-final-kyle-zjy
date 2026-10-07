// The catalog type is derived from the English catalog, so every other locale
// must define exactly the same keys (a missing or extra key is a type error).
import type { en } from "./en.ts";

export type MessageKey = keyof typeof en;
export type Catalog = Record<MessageKey, string>;
export type Params = Record<string, string | number>;
