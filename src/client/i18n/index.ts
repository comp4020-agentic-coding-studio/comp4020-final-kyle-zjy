// Client localization: the UI catalogs, the current locale and how it is
// chosen. See docs/localization.md. The locale is per browser
// (localStorage "fate:locale"), defaults to English, and is locked once the
// room departs, so a run is read in one language from start to finish.
import { useCallback } from "react";
import { create } from "zustand";
import type { CharacterId } from "../../shared/characters/types.ts";
import { characterText, scenarioText } from "../../shared/i18n/content.ts";
import { format } from "../../shared/i18n/format.ts";
import { DEFAULT_LOCALE, isLocale, type Locale, type Msg } from "../../shared/i18n/types.ts";
import { useStore } from "../store.ts";
import { en } from "./en.ts";
import type { Catalog, MessageKey, Params } from "./types.ts";
import { zhCN } from "./zh-CN.ts";

export type { Locale } from "../../shared/i18n/types.ts";
export type { MessageKey, Params } from "./types.ts";

export const STORAGE_KEY = "fate:locale";

export const CATALOGS: Record<Locale, Catalog> = { en, "zh-CN": zhCN };

/** Fills {name} placeholders; unknown placeholders are left as written. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** The text for a key in a locale (English if a locale somehow lacks it). */
export function t(locale: Locale, key: MessageKey, params?: Params): string {
  return interpolate(CATALOGS[locale]?.[key] ?? en[key] ?? key, params);
}

/** The stored locale, or English when nothing valid is stored or storage is blocked. */
export function readLocale(storage: Pick<Storage, "getItem"> | undefined): Locale {
  try {
    const v = storage?.getItem(STORAGE_KEY);
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** The language can change on the platform and in the lobby, never once the run has departed. */
export function canChangeLocale(roomPhase: string | undefined): boolean {
  return roomPhase === undefined || roomPhase === "LOBBY";
}

/** Every key of a catalog, sorted (for parity tests between locales). */
export function catalogKeys(catalog: Record<string, string>): string[] {
  return Object.keys(catalog).sort();
}

// ---- the current locale -----------------------------------------------------

const storage = (): Storage | undefined => {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

const applyDocumentLang = (locale: Locale): void => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.title = t(locale, "common.appName");
};

const initial = readLocale(storage());
applyDocumentLang(initial);

const useLocaleStore = create<{ locale: Locale }>(() => ({ locale: initial }));

/** The room phase the player is in, if any. */
const currentRoomPhase = (): string | undefined => {
  const s = useStore.getState();
  if (!s.roomCode || !s.snapshot) return undefined;
  // the same phase RoomGate picks the screen by
  return s.snapshot.game?.phase ?? s.snapshot.room.phase;
};

/** Switches the language; refused (returns false) once the run has departed. */
export function setLocale(locale: Locale): boolean {
  if (!isLocale(locale) || !canChangeLocale(currentRoomPhase())) return false;
  try {
    storage()?.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage blocked: the choice lasts until reload */
  }
  applyDocumentLang(locale);
  useLocaleStore.setState({ locale });
  return true;
}

/** The current locale outside React (store callbacks, error boundary). */
export const getLocale = (): Locale => useLocaleStore.getState().locale;

/** t() in the current locale, outside React. */
export const tNow = (key: MessageKey, params?: Params): string => t(getLocale(), key, params);

export const useLocale = (): Locale => useLocaleStore((s) => s.locale);

export type TFunction = (key: MessageKey, params?: Params) => string;

/** t bound to the current locale; re-renders the component when it changes. */
export function useT(): TFunction {
  const locale = useLocale();
  return useCallback((key: MessageKey, params?: Params) => t(locale, key, params), [locale]);
}

/** Renders a server message (or a legacy plain string) in the current locale. */
export function useFormat(): (msg: Msg | string | undefined | null) => string {
  const locale = useLocale();
  return useCallback((msg: Msg | string | undefined | null) => format(locale, msg), [locale]);
}

/** Scenario text (carriages, items, events, endings…) in the current locale. */
export const useScenarioText = () => scenarioText(useLocale());

/** A character's title and ability text in the current locale. */
export function useCharacterText(): (id: CharacterId) => ReturnType<typeof characterText> {
  const locale = useLocale();
  return useCallback((id: CharacterId) => characterText(locale, id), [locale]);
}
