// Scenario 02's top bar: the act and round, the water (Collapse 0–12, in
// numbers and a gauge), the boat (parts, power, gate, seats once known) and
// the viewer's own passes. Log and secrets drawers sit on the right.
import type { PlayerView } from "../../../shared/game/state.ts";
import { useScenario02Text, useT } from "../../i18n/index.ts";
import { BOAT_PARTS } from "../../../shared/game/scenario02/items.ts";
import { Icon } from "../Icon.tsx";

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
    <header className="safe-top relative z-20 border-b border-gold/15 bg-[#05060d]/85 px-3 py-2 backdrop-blur-md sm:px-4">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 max-w-[30%] shrink">
          <p className="label truncate text-[10px] text-signal">{t(`s2.top.act.${Math.min(g.act, 3) as 1 | 2 | 3}`)}</p>
          <p className="font-mono text-lg leading-tight text-moon">{t("s2.top.round", { n: Math.max(1, g.round) })}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label text-[10px] text-mist">{t("s2.top.water")}</span>
            <span className="font-mono text-sm text-moon">
              {g.collapse} / {g.collapseMax}
            </span>
          </div>
          <div className="mt-1 grid grid-cols-12 gap-0.5" aria-hidden="true">
            {Array.from({ length: g.collapseMax }, (_, i) => (
              <span key={i} className={`h-1.5 rounded-sm ${i < g.collapse ? (i >= 8 ? "bg-ember" : "bg-[#3a7bd5]") : "bg-indigo"}`} />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="label text-[10px] text-mist">{t("s2.top.boat")}</span>
            {flag(parts === 3, t("s2.top.parts", { n: parts }))}
            {flag(power, t("s2.top.power"))}
            {flag(gate, t("s2.top.gate"))}
            <span className="font-mono text-[10px] text-gold">{b.capacity === null ? t("s2.top.seatsUnknown") : t("s2.top.seats", { n: b.capacity })}</span>
            {ready && <span className="rounded-full bg-moss/20 px-1.5 py-0.5 text-[10px] font-bold text-moss">{t("s2.top.ready")}</span>}
            <span className="font-mono text-[10px] text-gold-bright">{t("s2.top.passes", { n: passes })}</span>
            {city.officePasses !== null && <span className="font-mono text-[10px] text-mist">{city.officePasses === 1 ? t("s2.top.office.one") : t("s2.top.office.other", { n: city.officePasses })}</span>}
          </div>
        </div>
        <button className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/30 text-mist hover:text-moon" onClick={onSecrets} aria-label={t("game.secretsAria", { n: secretsCount })}>
          <Icon name="SECRET" size={20} />
          {secretsCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet px-1 font-mono text-[10px] text-white">{secretsCount}</span>}
        </button>
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/30 text-mist hover:text-moon" onClick={onLog} aria-label={t("s2.top.log")}>
          <Icon name="LOG" size={20} />
        </button>
      </div>
    </header>
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
  return (
    <p className="mx-auto mt-1 flex max-w-6xl items-baseline gap-2 px-3 text-xs sm:px-4">
      <span className="label shrink-0 text-[10px] text-signal">{t("objective.label")}</span>
      <span className="min-w-0 flex-1 text-mist">{line}</span>
    </p>
  );
}
