import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { debtTier04 } from "../../../shared/game/scenario04/debt.ts";
import { itemLotId04, LOTS04 } from "../../../shared/game/scenario04/lots.ts";
import type { LotId04 } from "../../../shared/game/scenario04/types.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { Avatar } from "../../components/Avatar.tsx";
import { getCharacterById } from "../../../shared/characters/roster/index.ts";
import { useLocale, useT } from "../../i18n/index.ts";
import { sendGame } from "../../store.ts";

export function FinalAuction04({ g }: { g: PlayerView }) {
  const t = useT();
  const locale = useLocale();
  const a = g.auction!;
  const final = a.final!;
  const own = final.players[g.viewerId];
  const me = a.players[g.viewerId];
  const player = g.players[g.viewerId];
  const [bidText, setBidText] = useState("0");
  const [copySource, setCopySource] = useState<LotId04 | null>(null);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const tier = debtTier04(me.debt);
  const resourceRows = [
    { resource: "BLACK_CHIPS" as const, label: t("s4.final.blackChips"), available: (me.blackChips ?? 0) - (own.converted?.blackChips ?? 0), invested: own.converted?.blackChips ?? 0 },
    { resource: "SANITY" as const, label: t("s4.final.sanity"), available: player.sanity - (own.converted?.sanity ?? 0), invested: own.converted?.sanity ?? 0 },
    { resource: "FATE" as const, label: t("s4.final.fate"), available: player.fate - (own.converted?.fate ?? 0), invested: own.converted?.fate ?? 0 },
    { resource: "AP" as const, label: t("s4.final.ap"), available: player.ap - (own.converted?.ap ?? 0), invested: own.converted?.ap ?? 0 },
  ];
  const bid = Number(bidText);
  const legalBid = Number.isSafeInteger(bid) && bid >= 0 && bid <= (own.usable ?? 0);

  return <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
    <div data-s4-final-overture className="min-w-0 rounded-2xl border border-ember/50 bg-[#1d1020]/90 px-4 py-3 lg:col-span-2">
      <p className="label text-ember">{t("s4.final.overture.title")}</p>
      <p className="mt-1 font-mono text-xs text-gold-bright">{t("s4.final.overture.pressure", { n: g.collapse, max: g.collapseMax })}</p>
      <p className="mt-2 text-sm leading-relaxed text-moon">{t(`s4.final.overture.${final.stage === "SETTLEMENT" ? "settlement" : final.stage === "AUCTION" ? "auction" : "reveal"}`)}</p>
    </div>
    <section className="min-w-0 rounded-3xl border-2 border-gold/60 bg-[#0b1028]/95 p-4 text-center shadow-[0_0_44px_#d7ae5130] sm:p-7" aria-label={t("s4.final.title")}>
      {final.stage !== "SETTLEMENT" && <><p className="label text-signal">{t(final.stage === "AUCTION" ? "s4.final.auction" : "s4.final.reveal")}</p><h1 className="mt-2 font-display text-3xl text-gold-bright sm:text-5xl">{t("s4.final.title")}</h1></>}
      {final.stage === "SETTLEMENT" && <>
        <div className="sticky top-0 z-30 -mx-2 rounded-xl border-b border-gold/40 bg-[#0b1028]/98 px-2 py-2 backdrop-blur-md">
          <p className="label text-signal">{t("s4.final.settlement")}</p>
          <h1 className="font-display text-3xl text-gold-bright sm:text-5xl">{t("s4.final.title")}</h1>
          <div className="mt-1 text-sm text-mist">{tier !== "none" && <p className="font-bold text-ember">{t(`s4.debt.${tier}`)}</p>}<p>{t("s4.table.debt", { n: me.debt })}</p></div>
          <motion.p key={own.balance} data-final-balance className="font-display text-6xl leading-none tabular-nums text-gold-bright sm:text-8xl" initial={{ scale: 1.22, opacity: 0.45 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>{own.balance}</motion.p>
          <p className="text-xs text-mist">{t("s4.final.balanceHint")}</p>
        </div>
        {own.status === "SETTLING" ? <>
          <div className="mt-6 grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {resourceRows.map(({ resource, label, available, invested }) => <button key={resource} data-final-resource={resource} className="btn btn-ghost min-h-16 h-auto min-w-0 flex-col items-start gap-0.5 whitespace-normal py-3 text-left" disabled={available <= 0} onClick={() => void sendGame({ type: "FINAL_CONVERT", resource })}>
              <span className="font-bold">{label} · {available > 0 ? t("s4.final.add", { n: available }) : t("s4.final.invested")}</span>
              <span className="text-xs text-mist">{t("s4.final.investedCount", { n: invested })}</span>
            </button>)}
          </div>
          <h2 className="label mt-6 text-left text-gold-bright">{t("s4.final.items")}</h2>
          <div className="mt-2 grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {me.items.map((id) => {
              const base = itemLotId04(id);
              const item = auctionLotText(locale, id);
              const usable = (base !== "LOT_06" || me.debt > 0) && (base !== "LOT_09" || player.sanity > (own.converted?.sanity ?? 0) && !me.sanityWard);
              return <div key={id} data-final-item={id} className="min-w-0 rounded-xl border border-gold/30 bg-night/70 p-3">
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-mist">{t("s4.item.unverified")}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn btn-ghost min-h-12" disabled={!usable} onClick={() => base === "LOT_05" ? setCopySource(id) : void sendGame({ type: "USE_LOT", lotId: id })}>{t("s4.final.use")}</button>
                  <button className="btn btn-gold min-h-12" onClick={() => void sendGame({ type: "FINAL_CONVERT", resource: "ITEM", lotId: id })}>{t("s4.final.convert")}</button>
                </div>
                {copySource === id && <div className="mt-2 grid grid-cols-2 gap-2">{LOTS04.slice(0, 4).map((source) => <button key={source.id} className="btn btn-ghost min-h-12 h-auto whitespace-normal text-xs" onClick={() => { setCopySource(null); void sendGame({ type: "USE_LOT", lotId: id, sourceLotId: source.id }); }}>{auctionLotText(locale, source.id).name}</button>)}</div>}
              </div>;
            })}
          </div>
          {!!own.converted?.items.length && <div className="mt-3 text-left text-sm text-mist"><p className="label">{t("s4.final.invested")}</p>{own.converted.items.map(({ id, gain }) => <p key={id}>{auctionLotText(locale, id).name} · +{gain}</p>)}</div>}
          <button data-final-ready className="btn btn-gold mt-6 min-h-14 w-full" onClick={() => void sendGame({ type: "FINAL_READY" })}>{t("s4.final.ready")}</button>
        </> : <p className="mt-6 rounded-xl border border-moss/50 p-4 text-moss">{t("s4.final.readyLocked", { n: own.usable ?? 0 })}</p>}
      </>}
      {final.stage === "AUCTION" && <div className="mx-auto mt-8 max-w-lg">
        <p className="font-display text-6xl text-gold-bright" data-final-usable>{own.usable}</p>
        <p className="mt-2 text-mist">{t("s4.final.usable")}</p>
        {own.status === "BID_SUBMITTED" ? <p className="mt-8 rounded-xl border border-moss/50 p-4 text-moss">{t("s4.final.bidLocked")}</p> : <>
          <label className="label mt-7 block text-left" htmlFor="s4-final-bid">{t("s4.final.yourBid")}</label>
          <input id="s4-final-bid" data-final-bid type="number" min={0} max={own.usable ?? 0} step={1} inputMode="numeric" className="mt-2 min-h-14 w-full rounded-xl border border-gold/60 bg-night px-4 text-center font-display text-3xl" value={bidText} onChange={(event) => setBidText(event.target.value)} />
          <button data-final-submit className="btn btn-gold mt-4 min-h-14 w-full" disabled={!legalBid} onClick={() => void sendGame({ type: "FINAL_BID", amount: bid })}>{t("s4.final.submitSecret")}</button>
        </>}
      </div>}
      {final.stage === "REVEAL" && <>
        <h2 className="mt-5 font-display text-3xl text-gold-bright">{final.winnerId ? t("s4.final.winner", { name: g.players[final.winnerId].nickname }) : t("s4.final.noWinner")}</h2>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{a.seatOrder.map((id) => <div key={id} className={`rounded-xl border p-3 text-left ${id === final.winnerId ? "border-gold-bright" : "border-indigo"}`}>
          <p className="font-bold">{g.players[id].nickname}</p>
          <p className="mt-1 text-sm">{t("s4.final.revealLine", { bid: final.players[id].bid ?? 0, modifier: final.players[id].modifier ?? 0, effective: final.players[id].effectiveBid ?? 0 })}</p>
        </div>)}</div>
        <button data-final-continue className="btn btn-gold mt-6 min-h-14 w-full" disabled={own.continued} onClick={() => void sendGame({ type: "FINAL_CONTINUE" })}>{own.continued ? t("s4.waiting") : t("s4.final.continue")}</button>
      </>}
    </section>
    <aside className="min-w-0 rounded-2xl border border-indigo bg-[#0b1028]/90 p-4">
      <h2 className="label text-gold-bright">{t("s4.final.tableStatus")}</h2>
      <div className="mt-3 space-y-2">{a.seatOrder.map((id) => {
        const ch = getCharacterById(g.players[id].characterId);
        const debt = a.players[id].debt;
        return <div key={id} className="flex min-w-0 items-center gap-3 rounded-xl border border-indigo/70 p-2">
          <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={36} />
          <div className="min-w-0"><p className="truncate font-semibold">{g.players[id].nickname}</p><p className="text-xs text-mist">{t(`s4.final.status.${final.players[id].status}`)}</p>{debtTier04(debt) !== "none" && <p className="text-xs text-ember">{t("s4.table.debt", { n: debt })} · {t(`s4.debt.${debtTier04(debt)}`)}</p>}</div>
        </div>;
      })}</div>
      <p className="mt-4 text-sm text-mist">{t(final.stage === "SETTLEMENT" ? "s4.final.privacySettlement" : final.stage === "AUCTION" ? "s4.final.privacyBid" : "s4.final.revealed")}</p>
    </aside>
  </div>;
}
