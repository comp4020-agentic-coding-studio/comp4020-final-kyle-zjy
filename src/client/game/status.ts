// A status's short name in the current locale (statusShort, localized).
import type { ScenarioText } from "../../shared/i18n/content-types.ts";

export const statusName = (text: ScenarioText, kind: string): string => text.statuses[kind]?.short ?? kind.toLowerCase().replace(/_/g, " ");
