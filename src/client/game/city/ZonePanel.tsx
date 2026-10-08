// The selected zone (your own unless you tapped another): what it is, how
// high, whether the water has it or will, what works there, who is there and
// who is waiting for rescue.
import { ZONES } from "../../../shared/game/scenario02/map.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useScenario02Text, useT } from "../../i18n/index.ts";

const JOB_AT: Record<string, "POWER_STATION" | "PUMP_STATION" | "HARBOUR_GATE"> = { POWER_STATION: "POWER_STATION", PUMP_STATION: "PUMP_STATION", HARBOUR: "HARBOUR_GATE" };

export function ZonePanel({ g, zone, onBack }: { g: PlayerView; zone: number; onBack: () => void }) {
  const t = useT();
  const text = useScenario02Text();
  const city = g.city!;
  const z = city.zones[zone];
  const def = ZONES[zone];
  const mine = g.players[g.viewerId]?.carriageIndex === zone;
  const job = def.facility ? JOB_AT[def.facility] : undefined;
  const fac = job ? city.facilities[job] : undefined;
  const people = g.turnOrder.map((id) => g.players[id]).filter((p) => p.carriageIndex === zone);
  const waiting = city.npcs.filter((n) => n.zone === zone && n.state === "WAITING");
  const sep = t("common.listSep");
  return (
    <section className="mx-auto w-full max-w-6xl px-3 sm:px-4" aria-label={t("s2.panel.aria")}>
      <div className="rounded-xl border border-gold/20 bg-[#0b1028]/80 px-3 py-2 text-xs">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="label shrink-0 text-[10px] text-signal">{t(mine ? "s2.panel.here" : "s2.panel.selected")}</span>
          <span className="min-w-0 font-display text-base text-moon">{text.zones[def.id].name}</span>
          <span className="font-mono text-[10px] text-mist">
            {t(`s2.height.${def.elevation}`)} · {t(`s2.status.${z.status}`)} · {t(z.searched ? "s2.panel.searched" : "s2.panel.unsearched")}
          </span>
          {z.warning && <span className="rounded-full bg-ember/20 px-2 py-0.5 font-bold text-ember">{t("s2.zone.warning")}</span>}
        </div>
        <p className="mt-0.5 text-mist">{text.zones[def.id].text}</p>
        {fac && (
          <p className="mt-0.5 text-gold">
            {fac.done ? t("s2.panel.facilityDone", { name: t(`s2.facility.${job!}`) }) : t("s2.panel.facility", { name: t(`s2.facility.${job!}`), progress: fac.progress, required: fac.required })}
          </p>
        )}
        {def.facility === "HARBOUR" && city.officePasses !== null && <p className="mt-0.5 text-gold">{city.officePasses === 1 ? t("s2.panel.office.one") : t("s2.panel.office.other", { n: city.officePasses })}</p>}
        <p className="mt-0.5 text-mist">{people.length ? t("s2.panel.people", { names: people.map((p) => p.nickname).join(sep) }) : t("s2.panel.nobody")}</p>
        {waiting.length > 0 && <p className="mt-0.5 font-semibold text-gold-bright">{t("s2.panel.waiting", { names: waiting.map((n) => text.npcs[n.id].name).join(sep) })}</p>}
        {!mine && (
          <button className="btn btn-ghost mt-1 min-h-12 text-xs" onClick={onBack}>
            {t("s2.panel.back")}
          </button>
        )}
      </div>
    </section>
  );
}
