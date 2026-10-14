import { useState } from "react";
import { SHUFFLED_HOUSE_RULES04 } from "../../shared/game/scenario04/houseRules.ts";
import type { HouseRuleId04 } from "../../shared/game/scenario04/types.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { useT, type MessageKey } from "../i18n/index.ts";
import { sendGame } from "../store.ts";

export function HouseRuleSandbox04({ g }: { g: PlayerView }) {
  const t = useT();
  const [rule, setRule] = useState<HouseRuleId04>("anonymousSeat");
  const rules: HouseRuleId04[] = [...SHUFFLED_HOUSE_RULES04];
  const debug = g.auction?.debugHouseRules;
  return <section className="mt-4 min-w-0 border-t border-gold/30 pt-3" aria-label={t("s4.house.debug.title")}>
    <h3 className="font-display text-lg text-gold-bright">{t("s4.house.debug.title")}</h3>
    <select data-house-rule-select className="field mt-2 w-full" value={rule} onChange={(event) => setRule(event.target.value as HouseRuleId04)}>{rules.map((id) => <option key={id} value={id}>{t(`s4.house.${id}.title` as MessageKey)}</option>)}</select>
    <button data-house-rule-activate className="btn btn-gold mt-2 min-h-12 w-full" onClick={() => void sendGame({ type: "DEV_SET_HOUSE_RULE", ruleId: rule })}>{t("s4.house.debug.set")}</button>
    <button data-house-rule-generate className="btn btn-ghost mt-2 min-h-12 w-full" onClick={() => void sendGame({ type: "DEV_GENERATE_HOUSE_RULES" })}>{t("s4.house.debug.generate")}</button>
    {debug && <div className="mt-2 rounded-xl border border-indigo p-2 text-xs"><p className="break-all">{t("s4.sandbox.seed", { seed: debug.seed })}</p><p className="mt-1 font-bold">{t("s4.house.debug.current")}</p><p>{debug.order.map((id, i) => `${i + 1}: ${t(`s4.house.${id}.title` as MessageKey)}`).join(" · ")}</p>{debug.preview && <><p className="mt-2 font-bold">{t("s4.house.debug.preview")}</p><p>{debug.preview.order.map((id, i) => `${i + 1}: ${t(`s4.house.${id}.title` as MessageKey)}`).join(" · ")}</p></>}</div>}
  </section>;
}
