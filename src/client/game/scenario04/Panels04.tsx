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
  return <RunTopBar
    act={t("s4.top.act")}
    round={t("s4.top.round", { n: Math.max(1, g.round) })}
    gauge={{ label: t("s4.top.progress"), value: g.round, max: 10, fill: () => "bg-gold" }}
    onLog={onLog} onSecrets={onSecrets} secretsCount={secretsCount} logLabel={t("s4.top.log")}
  >
    <span className="font-mono text-[10px] text-gold-bright">{t("s4.place.table")}</span>
  </RunTopBar>;
}

export function Objective04() {
  return <ObjectiveLine>{useT()("s4.objective")}</ObjectiveLine>;
}

export function PlacePanel04({ g }: { g: PlayerView }) {
  const t = useT();
  const a = g.auction!;
  const state = a.auctionOpen ? "open" : a.auctionHistory.at(-1)?.winnerId ? "sold" : "unsold";
  return <PlacePanel ariaLabel={t("s4.place.aria")} kicker={t("s4.place.kicker")} name={t("s4.place.name")} meta={t("s4.place.table")} flag={<span className="text-signal">{t("s4.place.roundState", { round: g.round, state: t(`s4.table.${state}`), actor: a.turnPlayerId ? g.players[a.turnPlayerId].nickname : t("s4.table.none") })}</span>}><span className="text-mist">{t("s4.place.atmosphere")}</span></PlacePanel>;
}
