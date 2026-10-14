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
  return <motion.aside key={`${round}:${rule}`} data-house-rule={rule} className="min-w-0 self-start rounded-xl border border-gold/25 bg-[#111524] px-3 py-2.5"
    initial={{ opacity: 0, x: reduceMotion ? 0 : 14, y: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: reduceMotion ? 0.15 : 0.4 }}>
    <details className="group"><summary className="min-h-12 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <span className="label block text-[10px] text-gold/80">{t("s4.house.label", { n: String(round).padStart(2, "0") })}</span>
      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-moon"><Icon name={icons[rule]} size={17} /><strong className="min-w-0 text-sm font-semibold leading-tight">{t(key("title"))}</strong></span>
      <span className="mt-1 block text-xs leading-snug text-mist">{t(key("description"))}</span>
      <span className="mt-1.5 block text-right text-xs text-gold/80 group-open:hidden">{t("s4.house.details")} →</span>
    </summary><div className="mt-2 border-t border-gold/20 pt-2 text-xs leading-relaxed text-mist"><p className="text-gold-bright italic">{t(`s4.house.${rule}.host` as MessageKey)}</p><p className="mt-1 italic">{t(key("flavor"))}</p><p className="mt-1">{t(key("detail"))}</p></div></details>
  </motion.aside>;
}
