import { useEffect, useState } from "react";
import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { useLocale, useT } from "../../i18n/index.ts";

export function ItemNotice04({ g }: { g: PlayerView }) {
  const notice = g.auction?.players[g.viewerId]?.itemNotice;
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);
  const t = useT();
  const locale = useLocale();
  const expiresAt = (notice?.at ?? 0) + (notice?.result === "ACQUIRED" ? 1000 : 2500);
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
  return <div role="status" aria-live="polite" className={`pointer-events-none fixed inset-x-3 z-40 mx-auto max-w-lg rounded-2xl border-2 border-gold-bright bg-[#111936]/95 px-5 py-4 text-center shadow-2xl shadow-gold/20 ${g.round === 10 ? "bottom-4" : "top-36"}`}>
    <p className="label text-gold-bright">{t(notice.result === "ACQUIRED" ? "s4.item.noticeAcquiredTitle" : notice.result.startsWith("CONVERTED") ? "s4.final.itemConvertedTitle" : "s4.item.noticeTitle")}</p>
    <p className="mt-1 font-display text-2xl text-moon">{item.name}</p>
    <p className="mt-1 text-sm text-signal">{notice.result === "ACQUIRED" ? t("s4.item.noticeAcquired") : notice.result === "CONVERTED" ? t("s4.final.itemConverted") : notice.result === "CONVERTED_COUNTERFEIT" ? t("s4.final.itemFake") : notice.result === "COUNTERFEIT" ? t("s4.item.noticeCounterfeit") : notice.result === "COPIED" ? t("s4.item.noticeCopied", { item: copied }) : t("s4.item.noticeActivated")}</p>
    {notice.result === "ACTIVATED" && <p className="mt-1 text-xs text-mist">{item.description}</p>}
  </div>;
}
