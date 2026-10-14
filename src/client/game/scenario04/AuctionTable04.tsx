import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LOT_ICON04 } from "./lotVisuals.ts";
import { getCharacterById } from "../../../shared/characters/roster/index.ts";
import { LOTS04 } from "../../../shared/game/scenario04/lots.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionIntelText, auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { Avatar } from "../../components/Avatar.tsx";
import { useLocale, useT } from "../../i18n/index.ts";
import { debtTier04 } from "../../../shared/game/scenario04/debt.ts";
import { Icon } from "../Icon.tsx";
import { HouseRuleCard04 } from "./HouseRuleCard04.tsx";

export function AuctionTable04({ g }: { g: PlayerView }) {
  const a = g.auction!;
  const t = useT();
  const locale = useLocale();
  const lot = auctionLotText(locale, a.currentLot);
  const last = a.auctionHistory.at(-1);
  const state = a.auctionOpen ? "open" : last?.winnerId ? "sold" : "unsold";
  const who = (id: string | null) => id ? g.players[id]?.nickname ?? t("s4.table.none") : t("s4.table.none");
  const startingBid = LOTS04.find((entry) => entry.id === a.currentLot)?.startingBid ?? 1;
  const reduce = useReducedMotion();
  const stillIn = a.seatOrder.filter((id) => !a.passedPlayers.includes(id)).length;
  const hostLines = ["s4.host.round1", "s4.host.round2", "s4.host.round3", "s4.host.round4", "s4.host.round5", "s4.host.round6", "s4.host.round7", "s4.host.round8", "s4.host.round9"] as const;
  return <section aria-label={t("s4.table.aria")} className="mx-auto w-full max-w-6xl min-w-0 px-3 sm:px-4">
    <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-[#0b1028]/90 px-4 py-5 shadow-[inset_0_0_60px_#05060d] sm:px-8">
      <div className="pointer-events-none absolute inset-x-[14%] top-8 bottom-5 hidden rounded-[50%] border border-gold/15 lg:block" aria-hidden="true" />
      <div data-guide="map" className="relative mx-auto max-w-3xl rounded-2xl border border-gold/30 bg-[#05060d]/80 p-4 text-center">
        <div data-s4-transition={g.round} className="mb-3 grid min-w-0 grid-cols-1 gap-3 border-b border-gold/20 pb-3 text-left md:items-start md:grid-cols-[minmax(0,1fr)_minmax(220px,0.78fr)]" aria-live="polite">
          <div className="min-w-0"><div className="flex items-center gap-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold" aria-hidden="true"><Icon name="INSPECTOR" size={23} /></span><p className="label text-xs text-gold">{t("s4.host.label")}</p></div>
            {last?.round === g.round - 1 && <p className="mt-2 text-xs text-mist">{t(last.winnerId ? "s4.host.lastSold" : "s4.host.lastUnsold")}</p>}
            <p className="mt-2 text-sm text-moon">{t(hostLines[Math.min(8, Math.max(0, g.round - 1))])}</p>
          </div>
          <HouseRuleCard04 round={g.round} rule={a.houseRule} />
        </div>
        {a.houseRule === "holdingDisclosure" && !!Object.keys(a.holdingDeclarations ?? {}).length && <div className="mb-3 rounded-xl border border-gold/30 p-2 text-left text-xs"><p className="label text-gold">{t("s4.house.declarations")}</p>{Object.entries(a.holdingDeclarations ?? {}).map(([id, lotId]) => <p key={id} className="mt-1">{g.players[id]?.nickname} · {auctionLotText(locale, lotId).name}</p>)}</div>}
        {a.houseRule === "transparentTrade" && !!a.publicTrades?.length && <div className="mb-3 rounded-xl border border-gold/30 p-2 text-left text-xs"><p className="label text-gold">{t("s4.house.trades")}</p>{a.publicTrades.map((trade, index) => <p key={index} className="mt-1">{g.players[trade.from]?.nickname} ⇄ {g.players[trade.to]?.nickname} · {trade.chips} / {trade.receiveChips} {t("s4.final.blackChips")} · {trade.giveItem ? auctionLotText(locale, trade.giveItem).name : "—"} / {trade.forItem ? auctionLotText(locale, trade.forItem).name : "—"}</p>)}</div>}
        {g.round === 9 && a.preliminarySettlement && <div data-s4-preliminary className="mb-3 rounded-xl border border-gold/50 bg-gold/10 p-3 text-left text-sm"><p className="label text-gold">{t("s4.house.preliminary")}</p><div className="mt-2 grid grid-cols-2 gap-1 text-xs text-moon sm:grid-cols-3"><p>{t("s4.final.blackChips")} {a.preliminarySettlement.blackChips}</p><p>{t("s4.house.preliminaryItems")} +{a.preliminarySettlement.itemValue}</p><p>{t("s4.final.sanity")} +{a.preliminarySettlement.sanity}</p><p>{t("s4.final.fate")} +{a.preliminarySettlement.fate}</p><p>{t("s4.final.ap")} +{a.preliminarySettlement.ap}</p><p>{t("s4.table.debt", { n: a.players[g.viewerId].debt })} −{a.preliminarySettlement.debtPenalty}</p>{a.preliminarySettlement.finalModifier !== 0 && <p>{t("s4.house.preliminaryModifier")} +{a.preliminarySettlement.finalModifier}</p>}</div><p className="mt-2 border-t border-gold/20 pt-2 font-bold text-gold-bright">{t("s4.house.preliminaryTotal", { n: a.preliminarySettlement.total })}</p></div>}
        <article data-s4-lot-card className="relative mx-auto mt-1 max-w-md overflow-hidden rounded-2xl border border-gold/50 bg-[linear-gradient(165deg,#241812,#100a07)] px-3 pb-3 pt-2 text-left shadow-[0_0_30px_#d7ae5124]">
          <p className="label text-[10px] text-signal">{t("s4.lot.number", { n: String(Math.max(1, g.round)).padStart(2, "0") })} · {t("s4.table.lot")}</p>
          <div className="mt-1.5 flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/40 bg-gold/10 text-gold-bright" aria-hidden="true"><Icon name={LOT_ICON04[a.currentLot] ?? "USE_LOT"} size={26} /></div>
            <div className="min-w-0">
              <h1 className="break-words font-display text-xl leading-tight text-gold-bright sm:text-2xl">{lot.name}</h1>
              <p className="mt-0.5 text-xs italic text-mist">{lot.description}</p>
            </div>
          </div>
          <p className="mt-1 text-[10px] text-ash">{t("s4.lot.sealed")}</p>
          <AnimatePresence>{!reduce && a.currentBid > 0 && <motion.span key={`chip-${a.currentBid}`} data-s4-bid-chip aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10 -ml-4 size-8 rounded-full border-2 border-gold-bright bg-[#05060d] shadow-lg shadow-gold/30" initial={{ y: 110, x: 0, opacity: 0.95, scale: 0.7 }} animate={{ y: -6, opacity: 0, scale: 1.15 }} transition={{ duration: 0.75, ease: "easeOut" }} />}</AnimatePresence>
          {!!a.publicIntel.length && <div className="mt-2 rounded-xl border border-signal/30 p-2 text-left text-xs text-signal"><p className="label">{t("s4.table.publicIntel")}</p>{a.publicIntel.map((id) => <p key={id} className="mt-1">{auctionIntelText(locale, id)}</p>)}</div>}
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-left sm:grid-cols-4">
            <Stat label={t(a.currentBid > 0 ? "s4.table.bid" : "s4.table.startingBid")} value={a.currentBid > 0 ? String(a.currentBid) : String(startingBid)} />
            <Stat label={t("s4.table.bidder")} value={a.houseRule === "anonymousSeat" && a.currentBid > 0 && !a.currentBidder ? t("s4.house.anonymous") : who(a.currentBidder)} />
            <Stat label={t("s4.table.turn")} value={who(a.turnPlayerId)} />
            <Stat label={t("s4.seat.inLabel")} value={t("s4.lot.stillIn", { n: stillIn, total: a.seatOrder.length })} />
          </div>
        </article>
        {a.currentBidder && a.currentBidReal !== a.currentBid && <p className="mt-2 text-xs text-gold">{t("s4.table.realBid", { n: a.currentBidReal })}</p>}
        <p className={`mt-3 font-mono text-xs font-bold tracking-widest ${state === "open" ? "text-signal" : "text-gold"}`}>{t(`s4.table.${state}`)}</p>
      </div>
      <p className="label relative mt-5 text-center text-gold">{t("s4.table.seats")}</p>
      <p className="relative mt-1 text-center text-xs text-mist">{t("s4.table.firstLap", { names: [...a.seatOrder.slice(a.seatOrder.indexOf(a.roundStartPlayerId)), ...a.seatOrder.slice(0, a.seatOrder.indexOf(a.roundStartPlayerId))].map((id) => g.players[id].nickname).join(" → ") })}</p>
      <ol data-guide="seats" className="relative mx-auto mt-2 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-between">
        {a.seatOrder.map((id, index) => {
          const p = g.players[id];
          const player = a.players[id];
          const active = a.turnPlayerId === id;
          const leading = a.currentBidder === id;
          return <li key={id} className={`min-w-0 rounded-xl border p-2 lg:min-w-40 ${active ? "border-signal bg-signal/10" : leading ? "border-gold bg-gold/10" : "border-indigo bg-night/80"} ${active && leading ? "ring-1 ring-gold" : ""}`}>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar zodiac={getCharacterById(p.characterId).zodiac} mbti={getCharacterById(p.characterId).mbti} size={28} />
              <span className="min-w-0"><span className="block truncate text-xs font-bold">{index + 1}. {p.nickname}</span>{debtTier04(player.debt) !== "none" && <span className="block text-[10px] text-ember">{t("s4.table.debt", { n: player.debt })} · {t(`s4.debt.${debtTier04(player.debt)}`)}</span>}</span>
            </div>
            <ChipStack own={id === g.viewerId} n={player.blackChips} />
            {(player.passed || leading || active) && <p className="mt-1 flex gap-1 font-mono text-[10px] text-signal">{player.passed ? t("s4.table.passed") : <>{active && <span>{t("s4.table.turn")}</span>}{leading && <span className="text-gold">{t("s4.table.leading")}</span>}</>}</p>}
          </li>;
        })}
      </ol>
    </div>
  </section>;
}

/** Chip counts are private: the viewer's own stack is true, everyone else's is a covered stack. */
function ChipStack({ own, n }: { own: boolean; n: number | null }) {
  const t = useT();
  const shown = own && n !== null ? Math.min(12, Math.max(0, n)) : 4;
  return <div data-s4-stack={own ? "own" : "hidden"} className="mt-1.5 flex items-end gap-2" title={own && n !== null ? t("s4.seat.chipsOwn", { n }) : t("s4.seat.chipsHidden")}>
    <span className="flex w-7 shrink-0 flex-col-reverse gap-px" aria-hidden="true">{Array.from({ length: shown }, (_, i) => <span key={i} className={`h-1 rounded-sm ${own ? "bg-gold-bright" : "border border-dashed border-ash/70 bg-transparent"}`} />)}</span>
    <span className="min-w-0 font-mono text-[10px] text-mist">{own && n !== null ? t("s4.seat.chipsOwn", { n }) : t("s4.seat.chipsHidden")}</span>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-indigo/70 px-2 py-1"><p className="label text-[9px] text-mist">{label}</p><p className="break-words font-mono text-xs text-moon">{value}</p></div>;
}
