import { getCharacterById } from "../../../shared/characters/roster/index.ts";
import { lotForRound04 } from "../../../shared/game/scenario04/lots.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionIntelText, auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { Avatar } from "../../components/Avatar.tsx";
import { useLocale, useT } from "../../i18n/index.ts";

export function AuctionTable04({ g }: { g: PlayerView }) {
  const a = g.auction!;
  const t = useT();
  const locale = useLocale();
  const lot = auctionLotText(locale, a.currentLot);
  const last = a.auctionHistory.at(-1);
  const state = a.auctionOpen ? "open" : last?.winnerId ? "sold" : "unsold";
  const who = (id: string | null) => id ? g.players[id]?.nickname ?? t("s4.table.none") : t("s4.table.none");
  const startingBid = lotForRound04(Math.max(1, g.round)).startingBid;
  return <section aria-label={t("s4.table.aria")} className="mx-auto w-full max-w-6xl min-w-0 px-3 sm:px-4">
    <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-[#0b1028]/90 px-4 py-5 shadow-[inset_0_0_60px_#05060d] sm:px-8">
      <div className="pointer-events-none absolute inset-x-[14%] top-8 bottom-5 hidden rounded-[50%] border border-gold/15 lg:block" aria-hidden="true" />
      <div className="relative mx-auto max-w-xl rounded-2xl border border-gold/30 bg-[#05060d]/80 p-4 text-center">
        <p className="label text-signal">{t("s4.top.round", { n: Math.max(1, g.round) })} · {t("s4.table.lot")}</p>
        <h1 className="mt-1 font-display text-3xl text-gold-bright sm:text-4xl">{lot.name}</h1>
        <p className="mt-2 text-sm text-mist">{lot.description}</p>
        {!!a.publicIntel.length && <div className="mt-3 rounded-xl border border-signal/30 p-2 text-left text-xs text-signal"><p className="label">{t("s4.table.publicIntel")}</p>{a.publicIntel.map((id) => <p key={id} className="mt-1">{auctionIntelText(locale, id)}</p>)}</div>}
        {g.round === 7 && a.connectedPlayerId && <p className="mt-2 text-xs text-signal">{t("s4.table.connection", { name: who(a.connectedPlayerId) })}</p>}
        {g.round === 9 && <div className="mt-2 space-y-1 text-xs text-signal">
          <p>{t("s4.table.record")}</p>
          <p>{t("s4.table.statistics", { bid: a.stats.highestBid, debt: Math.max(...Object.values(a.players).map((player) => player.debt)), challenges: Object.values(a.stats.challengesWon).reduce((sum, n) => sum + n, 0), investigations: Object.values(a.stats.investigations).reduce((sum, n) => sum + n, 0), deals: a.stats.deals, borrows: Object.values(a.stats.borrows).reduce((sum, n) => sum + n, 0) })}</p>
        </div>}
        <div className="mt-4 grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
          <Stat label={t("s4.table.bid")} value={a.currentBidder ? String(a.currentBid) : String(startingBid)} />
          <Stat label={t("s4.table.bidder")} value={who(a.currentBidder)} />
          <Stat label={t("s4.table.turn")} value={who(a.turnPlayerId)} />
        </div>
        <p className={`mt-3 font-mono text-xs font-bold tracking-widest ${state === "open" ? "text-signal" : "text-gold"}`}>{t(`s4.table.${state}`)}</p>
      </div>
      <p className="label relative mt-5 text-center text-gold">{t("s4.table.seats")}</p>
      <p className="relative mt-1 text-center text-xs text-mist">{t("s4.table.firstLap", { names: [...a.seatOrder.slice(a.seatOrder.indexOf(a.roundStartPlayerId)), ...a.seatOrder.slice(0, a.seatOrder.indexOf(a.roundStartPlayerId))].map((id) => g.players[id].nickname).join(" → ") })}</p>
      <ol className="relative mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-center">
        {a.seatOrder.map((id, index) => {
          const p = g.players[id];
          const player = a.players[id];
          const active = a.turnPlayerId === id;
          const leading = a.currentBidder === id;
          return <li key={id} className={`min-w-0 rounded-xl border p-2 ${active ? "border-signal bg-signal/10" : leading ? "border-gold bg-gold/10" : "border-indigo bg-night/80"}`}>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar zodiac={getCharacterById(p.characterId).zodiac} mbti={getCharacterById(p.characterId).mbti} size={28} />
              <span className="min-w-0"><span className="block truncate text-xs font-bold">{index + 1}. {p.nickname}</span><span className="block text-[10px] text-mist">{t("s4.table.debt", { n: player.debt })}</span></span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-signal">{player.passed ? t("s4.table.passed") : leading ? t("s4.table.leading") : active ? t("s4.table.turn") : "·"}</p>
          </li>;
        })}
      </ol>
    </div>
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-indigo/70 px-2 py-1.5"><p className="label text-[9px] text-mist">{label}</p><p className="truncate font-mono text-sm text-moon">{value}</p></div>;
}
