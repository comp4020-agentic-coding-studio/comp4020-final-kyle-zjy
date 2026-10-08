// Scenario 02's top bar: the act and round, the water (Collapse 0–12, in
// numbers and a gauge), the boat (parts, power, gate, seats once known) and
// the viewer's own passes. Log and secrets drawers sit on the right.
import type { PlayerView } from "../../../shared/game/state.ts";
import { useScenario02Text, useT } from "../../i18n/index.ts";
import { BOAT_PARTS } from "../../../shared/game/scenario02/items.ts";
import { ObjectiveLine, RunTopBar } from "../RunTopBar.tsx";

export function CityTopBar({ g, onLog, onSecrets, secretsCount }: { g: PlayerView; onLog: () => void; onSecrets: () => void; secretsCount: number }) {
  const t = useT();
  const city = g.city!;
  const b = city.boat;
  const parts = b.installed.filter((p) => p !== "CHIP").length;
  const power = city.facilities.POWER_STATION.done || b.batteryPower;
  const gate = city.facilities.HARBOUR_GATE.done;
  const passes = city.holdings[g.viewerId]?.passes ?? 0;
  const ready = parts === 3 && power && gate;
  const flag = (on: boolean, label: string) => (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${on ? "border-moss/60 text-moss" : "border-ash/50 text-ash"}`}>
      {label} {on ? "✓" : "·"}
    </span>
  );
  return (
    <RunTopBar
      act={t(`s2.top.act.${Math.min(g.act, 3) as 1 | 2 | 3}`)}
      round={t("s2.top.round", { n: Math.max(1, g.round) })}
      gauge={{ label: t("s2.top.water"), value: g.collapse, max: g.collapseMax, fill: (i) => (i >= 8 ? "bg-ember" : "bg-[#3a7bd5]") }}
      onLog={onLog}
      onSecrets={onSecrets}
      secretsCount={secretsCount}
      logLabel={t("s2.top.log")}
    >
      <span className="label text-[10px] text-mist">{t("s2.top.boat")}</span>
      {flag(parts === 3, t("s2.top.parts", { n: parts }))}
      {flag(power, t("s2.top.power"))}
      {flag(gate, t("s2.top.gate"))}
      <span className="font-mono text-[10px] text-gold">{b.capacity === null ? t("s2.top.seatsUnknown") : t("s2.top.seats", { n: b.capacity })}</span>
      {ready && <span className="rounded-full bg-moss/20 px-1.5 py-0.5 text-[10px] font-bold text-moss">{t("s2.top.ready")}</span>}
      <span className="font-mono text-[10px] text-gold-bright">{t("s2.top.passes", { n: passes })}</span>
      {city.officePasses !== null && <span className="font-mono text-[10px] text-mist">{city.officePasses === 1 ? t("s2.top.office.one") : t("s2.top.office.other", { n: city.officePasses })}</span>}
    </RunTopBar>
  );
}

/** What the table is working toward now, in one line. */
export function CityObjective({ g }: { g: PlayerView }) {
  const t = useT();
  const text = useScenario02Text();
  const city = g.city!;
  const b = city.boat;
  const ready = BOAT_PARTS.every((p) => b.installed.includes(p)) && (city.facilities.POWER_STATION.done || b.batteryPower) && city.facilities.HARBOUR_GATE.done;
  const missing = BOAT_PARTS.filter((p) => !b.installed.includes(p)).map((p) => text.parts[p].name).join(t("common.listSep"));
  const line =
    b.aboard.length && !b.launched
      ? t("s2.objective.awaitStart")
      : b.readyRound !== null
        ? t("s2.objective.ready")
      : ready && g.act === 1
        ? t("s2.objective.readyEarly")
        : g.act === 3
        ? t("s2.objective.3")
        : missing
          ? t(g.act === 1 ? "s2.objective.1" : "s2.objective.2", { parts: missing })
          : t(g.act === 1 ? "s2.objective.1done" : "s2.objective.2done");
  return <ObjectiveLine>{line}</ObjectiveLine>;
}
