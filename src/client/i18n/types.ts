// The catalog type is derived from the English catalog, so every other locale
// must define exactly the same keys (a missing or extra key is a type error).
import type { en } from "./en.ts";
import type { s2en } from "./s2-en.ts";
import type { s3en } from "./s3-en.ts";
import type { s4en } from "./s4-en.ts";

/** Scenario 02's keys (s2-en.ts / s2-zh-CN.ts). */
export type S2Key = keyof typeof s2en;
export type S3Key = keyof typeof s3en;
export type S4Key = keyof typeof s4en;
export type MessageKey = keyof typeof en | S2Key | S3Key | S4Key;
export type Catalog = Record<keyof typeof en, string>;
export type Params = Record<string, string | number>;
