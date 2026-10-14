import { motion, useReducedMotion } from "motion/react";
import type { HouseRuleId04 } from "../../../shared/game/scenario04/types.ts";
import { useT, type MessageKey } from "../../i18n/index.ts";
import { Icon } from "../Icon.tsx";

const icons: Record<HouseRuleId04, string> = {
  openingCourtesy: "INVESTIGATE", anonymousSeat: "SECRET", doubleRaise: "BID",
  creditNight: "BORROW", holdingDisclosure: "STORE_ITEM", houseChallenge: "CHALLENGE",
  transparentTrade: "DEAL", singleRaise: "BID", creditFreeze: "LOCK", finalSettlement: "S4_EXIT",
};

export function HouseRuleCard04({ round, rule }: { round: number; rule: HouseRuleId04 | null }) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  if (!rule) return null;
  const key = (part: "title" | "description" | "flavor" | "detail") => `s4.house.${rule}.${part}` as MessageKey;
  return <motion.aside key={`${round}:${rule}`} data-house-rule={rule} className="min-w-0 rounded-2xl border border-gold/40 bg-[#15172a] p-3 shadow-[inset_0_0_24px_#d7ae5110] sm:p-4"
    initial={{ opacity: 0, x: reduceMotion ? 0 : 14, y: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: reduceMotion ? 0.15 : 0.4 }}>
    <p className="label text-xs text-gold">{t("s4.house.label", { n: String(round).padStart(2, "0") })}</p>
    <div className="mt-2 flex min-w-0 items-center gap-2 text-gold-bright"><Icon name={icons[rule]} size={22} /><h2 className="min-w-0 font-display text-xl leading-tight">{t(key("title"))}</h2></div>
    <p className="mt-2 text-sm leading-relaxed text-moon">{t(key("description"))}</p>
    <p className="mt-1 text-xs italic text-mist">{t(key("flavor"))}</p>
    <details className="mt-2 border-t border-gold/20 pt-1 text-xs text-mist"><summary className="flex min-h-12 cursor-pointer items-center text-gold">{t("s4.house.details")}</summary><p className="pb-1 leading-relaxed">{t(key("detail"))}</p></details>
  </motion.aside>;
}
