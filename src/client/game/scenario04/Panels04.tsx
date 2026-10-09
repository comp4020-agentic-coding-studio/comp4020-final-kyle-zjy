import type { PlayerView } from "../../../shared/game/state.ts";
import { useT } from "../../i18n/index.ts";
import { ObjectiveLine, PlacePanel, RunTopBar } from "../RunTopBar.tsx";

export function TopBar04({ g, onLog, onSecrets, secretsCount }: { g: PlayerView; onLog: () => void; onSecrets: () => void; secretsCount: number }) {
  const t = useT();
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

export function PlacePanel04() {
  const t = useT();
  return <PlacePanel ariaLabel={t("s4.place.aria")} kicker={t("s4.place.kicker")} name={t("s4.place.name")} meta={t("s4.place.table")}><span /></PlacePanel>;
}
