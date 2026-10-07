// Renders a message in a locale. The server renders English (log text kept
// for readability and tests); each client renders its own locale.
import type { CharacterId } from "../characters/types.ts";
import { characterText, scenarioText } from "./content.ts";
import { isMsg, type Locale, type Msg, type MsgParam } from "./types.ts";
import { ZH_MESSAGES } from "./zh-CN/messages.ts";

const LIST_SEP: Record<Locale, string> = { en: ", ", "zh-CN": "、" };

/** The text of a content reference ("@item" + id…). */
function content(locale: Locale, kind: string, ids: string[]): string {
  const s = scenarioText(locale);
  const [a, b] = ids;
  switch (kind) {
    case "carriage": return s.carriages[a as keyof typeof s.carriages]?.name ?? a;
    case "item": return s.items[a as keyof typeof s.items]?.name ?? a;
    case "fragment": return s.fragments[a as keyof typeof s.fragments]?.name ?? a;
    case "fragmentText": return s.fragments[a as keyof typeof s.fragments]?.text ?? a;
    case "ending": {
      const e = s.endings[a as keyof typeof s.endings];
      return e ? [e.title, ...e.lines].join(locale === "zh-CN" ? "" : " ") : a;
    }
    case "status": return s.statuses[a]?.long ?? a.toLowerCase().replace(/_/g, " ");
    case "anchor": return s.anchors[a as keyof typeof s.anchors] ?? a;
    case "lock": return s.locks[a as keyof typeof s.locks] ?? a;
    case "skill": return characterText(locale, a as CharacterId).skillName;
    case "skillDescription": return characterText(locale, a as CharacterId).skillDescription;
    case "investigateHint": return s.carriages[a as keyof typeof s.carriages]?.investigateHint ?? a;
    case "searchHint": return s.carriages[a as keyof typeof s.carriages]?.searchHint ?? a;
    case "title": return characterText(locale, a as CharacterId).title;
    case "event": return s.events[a]?.title ?? a;
    case "option": return s.events[a]?.options?.[b]?.label ?? b;
    case "optionDetail": return s.events[a]?.options?.[b]?.detail ?? b;
    case "eventText": return s.events[a]?.text ?? a;
    case "nightRule": return s.nightRules[a as keyof typeof s.nightRules]?.name ?? a;
    case "nightRuleText": return s.nightRules[a as keyof typeof s.nightRules]?.text ?? a;
    case "obsession": return s.obsessions[a as keyof typeof s.obsessions]?.name ?? a;
    case "zodiac": return s.zodiac[a as keyof typeof s.zodiac]?.name ?? a;
    case "ruleChange": return s.ruleChanges[a] ?? a;
    case "goal": return s.goals[a as keyof typeof s.goals] ?? a;
    case "boon": return s.boons[a] ?? a;
    default: return a;
  }
}

const param = (locale: Locale, p: MsgParam): string => (isMsg(p) ? format(locale, p) : String(p));

export function format(locale: Locale, msg: Msg | string | undefined | null): string {
  if (msg === undefined || msg === null) return "";
  if (typeof msg === "string") return msg;
  const params = msg.p ?? [];
  if (msg.k === "@list") return params.map((p) => param(locale, p)).join(LIST_SEP[locale]);
  if (msg.k.startsWith("@")) return content(locale, msg.k.slice(1), params.map(String));
  const template = (locale === "zh-CN" ? ZH_MESSAGES[msg.k] : undefined) ?? msg.k;
  return template.replace(/\{(\d+)\}/g, (_, i) => param(locale, params[Number(i)] ?? ""));
}

/** English, for server-side log text and tests. */
export const en = (msg: Msg | string | undefined | null) => format("en", msg);
