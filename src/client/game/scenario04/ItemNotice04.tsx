import { useEffect, useState } from "react";
import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { useLocale, useT } from "../../i18n/index.ts";

export function ItemNotice04({ g }: { g: PlayerView }) {
  const notice = g.auction?.players[g.viewerId]?.itemNotice;
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);
  const t = useT();
  const locale = useLocale();
  useEffect(() => {
    if (!notice) return;
    setVisibleSeq(notice.seq);
    const timer = setTimeout(() => setVisibleSeq(null), 6000);
    return () => clearTimeout(timer);
  }, [notice?.seq]);
  if (!notice || visibleSeq !== notice.seq) return null;
  const item = auctionLotText(locale, notice.lotId);
  const copied = notice.copyLotId ? auctionLotText(locale, notice.copyLotId).name : "";
  return <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 top-36 z-40 mx-auto max-w-lg rounded-2xl border-2 border-gold-bright bg-[#111936]/95 px-5 py-4 text-center shadow-2xl shadow-gold/20">
    <p className="label text-gold-bright">{t("s4.item.noticeTitle")}</p>
    <p className="mt-1 font-display text-2xl text-moon">{item.name}</p>
    <p className="mt-1 text-sm text-signal">{notice.result === "COUNTERFEIT" ? t("s4.item.noticeCounterfeit") : notice.result === "COPIED" ? t("s4.item.noticeCopied", { item: copied }) : t("s4.item.noticeActivated")}</p>
    {notice.result === "ACTIVATED" && <p className="mt-1 text-xs text-mist">{item.description}</p>}
  </div>;
}
