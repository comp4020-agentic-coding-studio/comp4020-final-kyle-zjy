import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionFakeUseText, auctionLotEffectText, auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { useLocale, useT } from "../../i18n/index.ts";
import { itemLotId04 } from "../../../shared/game/scenario04/lots.ts";
import { Card } from "../cards/Card.tsx";
import { LOT_ICON04 } from "./lotVisuals.ts";

export function ItemNotice04({ g }: { g: PlayerView }) {
  const notice = g.auction?.players[g.viewerId]?.itemNotice;
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);
  const t = useT();
  const locale = useLocale();
  const expiresAt = (notice?.at ?? 0) + (notice?.result === "ACQUIRED" ? 1000 : notice?.result === "COUNTERFEIT" ? 5200 : 2500);
  useEffect(() => {
    const remaining = expiresAt - Date.now();
    if (!notice || remaining <= 0) {
      setVisibleSeq(null);
      return;
    }
    setVisibleSeq(notice.seq);
    const timer = setTimeout(() => setVisibleSeq(null), remaining);
    return () => clearTimeout(timer);
  }, [notice?.seq, expiresAt]);
  if (!notice || visibleSeq !== notice.seq || Date.now() >= expiresAt) return null;
  const item = auctionLotText(locale, notice.lotId);
  const copied = notice.copyLotId ? auctionLotText(locale, notice.copyLotId).name : "";
  const counterfeit = notice.result === "COUNTERFEIT";
  if (counterfeit) {
    // The use animation plays first (item_use sound, "used" cue); only then the private verdict lands.
    return <motion.div key={notice.seq} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.9 }} role="alert" aria-live="assertive" data-s4-fake-card className={`pointer-events-none fixed inset-x-3 z-[70] mx-auto max-w-lg ${g.round === 10 ? "bottom-4" : "top-36"}`}>
      <Card variant="intel" private icon={LOT_ICON04[itemLotId04(notice.lotId)] ?? "SECRET"} kicker={t("s4.fake.kicker")} title={item.name}>
        <p className="text-moon">{t("s4.fake.card")}</p>
        <p className="mt-1 text-xs italic text-mist">{auctionFakeUseText(locale, notice.lotId)}</p>
      </Card>
    </motion.div>;
  }
  return <motion.div key={notice.seq} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.42 }} role="status" aria-live="polite" className={`pointer-events-none fixed inset-x-3 z-[70] mx-auto max-w-lg rounded-2xl border-2 bg-[#111936]/95 px-5 py-4 text-center shadow-2xl border-gold-bright shadow-gold/20 ${g.round === 10 ? "bottom-4" : "top-36"}`}>
    <p className="label text-gold-bright">{t(notice.result === "ACQUIRED" ? "s4.item.noticeAcquiredTitle" : notice.result.startsWith("CONVERTED") ? "s4.final.itemConvertedTitle" : "s4.item.noticeTitle")}</p>
    <p className="mt-1 font-display text-2xl text-moon">{item.name}</p>
    <p className="mt-1 text-sm text-signal">{notice.result === "ACQUIRED" ? t("s4.item.noticeAcquired") : notice.result === "CONVERTED" ? t("s4.final.itemConverted") : notice.result === "CONVERTED_COUNTERFEIT" ? t("s4.final.itemFake") : notice.result === "COPIED" ? t("s4.item.noticeCopied", { item: copied }) : t("s4.item.noticeActivated")}</p>
    {notice.result === "ACTIVATED" && <p className="mt-1 text-xs text-mist">{auctionLotEffectText(locale, notice.lotId)}</p>}
  </motion.div>;
}
