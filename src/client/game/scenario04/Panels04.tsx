import type { PlayerView } from "../../../shared/game/state.ts";
import { useT } from "../../i18n/index.ts";
import { ObjectiveLine, PlacePanel, RunTopBar } from "../RunTopBar.tsx";
import { Icon } from "../Icon.tsx";

export function TopBar04({ g, onLog, onSecrets, secretsCount }: { g: PlayerView; onLog: () => void; onSecrets: () => void; secretsCount: number }) {
  const t = useT();
  if (g.round === 10 && g.auction?.final) return <header className="safe-top border-b border-gold/20 bg-[#05060d]/90 px-3 py-2 text-moon">
    <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-2">
      <div className="min-w-0"><p className="label truncate text-[10px] text-signal">{t("s4.top.act")}</p><p className="font-mono text-sm font-bold text-gold-bright">{t("s4.top.round", { n: 10 })}</p></div>
      <div className="flex shrink-0 gap-2">
        <button className="relative flex h-12 w-12 items-center justify-center rounded-full border border-gold/30" onClick={onSecrets} aria-label={t("game.secretsAria", { n: secretsCount })}><Icon name="SECRET" size={20} />{secretsCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet text-[10px] text-white">{secretsCount}</span>}</button>
        <button className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30" onClick={onLog} aria-label={t("s4.top.log")}><Icon name="LOG" size={20} /></button>
      </div>
    </div>
  </header>;
  return <>
    <header className="safe-top border-b border-gold/20 bg-[#05060d]/90 px-3 py-2 text-moon sm:hidden">
      <div className="flex min-w-0 items-center justify-between gap-2"><p className="label min-w-0 truncate text-[10px] text-signal">{t("s4.top.act")}</p><div className="flex shrink-0 gap-2">
        <button className="relative flex h-12 w-12 items-center justify-center rounded-full border border-gold/30" onClick={onSecrets} aria-label={t("game.secretsAria", { n: secretsCount })}><Icon name="SECRET" size={20} />{secretsCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet text-[10px] text-white">{secretsCount}</span>}</button>
        <button className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30" onClick={onLog} aria-label={t("s4.top.log")}><Icon name="LOG" size={20} /></button>
      </div></div>
      <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3"><p className="min-w-0 font-mono text-sm font-bold text-gold-bright">{t("s4.top.round", { n: Math.max(1, g.round) })}</p><div className="min-w-0"><p className="flex justify-between gap-1 font-mono text-[10px] text-mist"><span className="truncate">{t("s4.top.progress")}</span><span className="shrink-0">{g.round} / 10</span></p><div className="mt-1 grid grid-cols-10 gap-0.5" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index} className={`h-1.5 rounded-sm ${index < g.round ? "bg-gold" : "bg-indigo"}`} />)}</div></div></div>
      <p className="mt-1 font-mono text-[10px] text-mist">{t("s4.place.table")}</p>
    </header>
    <div className="hidden sm:block"><RunTopBar
      act={t("s4.top.act")}
      round={t("s4.top.round", { n: Math.max(1, g.round) })}
      gauge={{ label: t("s4.top.progress"), value: g.round, max: 10, fill: () => "bg-gold" }}
      onLog={onLog} onSecrets={onSecrets} secretsCount={secretsCount} logLabel={t("s4.top.log")}
    >
      <span className="font-mono text-[10px] text-gold-bright">{t("s4.place.table")}</span>
    </RunTopBar></div>
  </>;
}

export function Objective04() {
  return <ObjectiveLine>{useT()("s4.objective")}</ObjectiveLine>;
}

export function CollapseMeter04({ g }: { g: PlayerView }) {
  const t = useT();
  return <section data-s4-collapse role="meter" aria-label={t("s4.top.collapse")} aria-valuenow={g.collapse} aria-valuemin={0} aria-valuemax={g.collapseMax} className="mx-auto mt-2 w-full max-w-6xl min-w-0 px-3 sm:px-4">
    <div className="rounded-xl border border-ember/40 bg-[#1d1020]/85 px-3 py-2">
      <div className="flex min-w-0 items-baseline justify-between gap-2"><span className="label text-[10px] text-ember">{t("s4.top.collapse")}</span><span className="shrink-0 font-mono text-sm font-bold text-moon">{g.collapse} / {g.collapseMax}</span></div>
      <div className="mt-1 grid grid-cols-10 gap-1" aria-hidden="true">{Array.from({ length: g.collapseMax }, (_, index) => <span key={index} className={`h-1.5 rounded-sm ${index < g.collapse ? index >= 7 ? "bg-ember" : "bg-gold" : "bg-indigo"}`} />)}</div>
      <p className="mt-1.5 text-xs leading-snug text-mist">{t("s4.collapse.hint")}</p>
    </div>
  </section>;
}

export function PlacePanel04({ g }: { g: PlayerView }) {
  const t = useT();
  const a = g.auction!;
  const state = a.auctionOpen ? "open" : a.auctionHistory.at(-1)?.winnerId ? "sold" : "unsold";
  return <PlacePanel ariaLabel={t("s4.place.aria")} kicker={t("s4.place.kicker")} name={t("s4.place.name")} meta={t("s4.place.table")} flag={<span className="text-signal">{t("s4.place.roundState", { round: g.round, state: t(`s4.table.${state}`), actor: a.turnPlayerId ? g.players[a.turnPlayerId].nickname : t("s4.table.none") })}</span>}><span className="text-mist">{t("s4.place.atmosphere")}</span></PlacePanel>;
}
