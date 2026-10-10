import { getCharacterById } from "../../../shared/characters/roster/index.ts";
import { lotForRound04 } from "../../../shared/game/scenario04/lots.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionIntelText, auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { Avatar } from "../../components/Avatar.tsx";
import { useLocale, useT } from "../../i18n/index.ts";
import { debtTier04 } from "../../../shared/game/scenario04/debt.ts";
import { Icon } from "../Icon.tsx";

const LOT_ICON04: Record<string, string> = {
  LOT_01: "DICE", LOT_02: "SECRET", LOT_03: "S4_COIN", LOT_04: "CHALLENGE", LOT_05: "KEY",
  LOT_06: "S4_CREDIT", LOT_07: "REGISTER", LOT_08: "S4_CROWN", LOT_09: "S4_DEVIL_KEY", LOT_10: "S4_EXIT",
};

export function AuctionTable04({ g }: { g: PlayerView }) {
  const a = g.auction!;
  const t = useT();
  const locale = useLocale();
  const lot = auctionLotText(locale, a.currentLot);
  const last = a.auctionHistory.at(-1);
  const state = a.auctionOpen ? "open" : last?.winnerId ? "sold" : "unsold";
  const who = (id: string | null) => id ? g.players[id]?.nickname ?? t("s4.table.none") : t("s4.table.none");
  const startingBid = lotForRound04(Math.max(1, g.round)).startingBid;
  const hostLines = ["s4.host.round1", "s4.host.round2", "s4.host.round3", "s4.host.round4", "s4.host.round5", "s4.host.round6", "s4.host.round7", "s4.host.round8", "s4.host.round9"] as const;
  return <section aria-label={t("s4.table.aria")} className="mx-auto w-full max-w-6xl min-w-0 px-3 sm:px-4">
    <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-[#0b1028]/90 px-4 py-5 shadow-[inset_0_0_60px_#05060d] sm:px-8">
      <div className="pointer-events-none absolute inset-x-[14%] top-8 bottom-5 hidden rounded-[50%] border border-gold/15 lg:block" aria-hidden="true" />
      <div className="relative mx-auto max-w-xl rounded-2xl border border-gold/30 bg-[#05060d]/80 p-4 text-center">
        <div data-s4-transition={g.round} className="mb-3 border-b border-gold/20 pb-3 text-left" aria-live="polite">
          <p className="label text-[10px] text-gold">{t("s4.host.label")}</p>
          {last?.round === g.round - 1 && <p className="mt-1 text-xs text-mist">{t(last.winnerId ? "s4.host.lastSold" : "s4.host.lastUnsold")}</p>}
          <p className="mt-1 text-sm text-moon">{t(hostLines[Math.min(8, Math.max(0, g.round - 1))])}</p>
        </div>
        <p className="label text-signal">{t("s4.top.round", { n: Math.max(1, g.round) })} · {t("s4.table.lot")}</p>
        <div className="mx-auto mt-3 flex size-16 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10 text-gold-bright" aria-hidden="true"><Icon name={LOT_ICON04[a.currentLot] ?? "USE_LOT"} size={36} /></div>
        <h1 className="mt-1 font-display text-3xl text-gold-bright sm:text-4xl">{lot.name}</h1>
        {!!a.publicIntel.length && <div className="mt-3 rounded-xl border border-signal/30 p-2 text-left text-xs text-signal"><p className="label">{t("s4.table.publicIntel")}</p>{a.publicIntel.map((id) => <p key={id} className="mt-1">{auctionIntelText(locale, id)}</p>)}</div>}
        <div className="mt-4 grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
          <Stat label={t(a.currentBidder ? "s4.table.bid" : "s4.table.startingBid")} value={a.currentBidder ? String(a.currentBid) : String(startingBid)} />
          <Stat label={t("s4.table.bidder")} value={who(a.currentBidder)} />
          <Stat label={t("s4.table.turn")} value={who(a.turnPlayerId)} />
        </div>
        {a.currentBidder && a.currentBidReal !== a.currentBid && <p className="mt-2 text-xs text-gold">{t("s4.table.realBid", { n: a.currentBidReal })}</p>}
        <p className={`mt-3 font-mono text-xs font-bold tracking-widest ${state === "open" ? "text-signal" : "text-gold"}`}>{t(`s4.table.${state}`)}</p>
      </div>
      <p className="label relative mt-5 text-center text-gold">{t("s4.table.seats")}</p>
      <p className="relative mt-1 text-center text-xs text-mist">{t("s4.table.firstLap", { names: [...a.seatOrder.slice(a.seatOrder.indexOf(a.roundStartPlayerId)), ...a.seatOrder.slice(0, a.seatOrder.indexOf(a.roundStartPlayerId))].map((id) => g.players[id].nickname).join(" → ") })}</p>
      <ol className="relative mx-auto mt-2 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-between">
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
            {(player.passed || leading || active) && <p className="mt-1 flex gap-1 font-mono text-[10px] text-signal">{player.passed ? t("s4.table.passed") : <>{active && <span>{t("s4.table.turn")}</span>}{leading && <span className="text-gold">{t("s4.table.leading")}</span>}</>}</p>}
          </li>;
        })}
      </ol>
    </div>
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-indigo/70 px-2 py-1.5"><p className="label text-[9px] text-mist">{label}</p><p className="truncate font-mono text-sm text-moon">{value}</p></div>;
}
