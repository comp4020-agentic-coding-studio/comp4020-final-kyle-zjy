import { ADJACENT, ZONES } from "../../../shared/game/scenario02/map.ts";
import { useScenario02Text, useT } from "../../i18n/index.ts";
import { bounds, center, corners } from "../city/geometry.ts";
import { OpeningTitle } from "./OpeningTitle.tsx";

const RESCUE_ZONES = ["HOSPITAL", "ESTATE", "POWER_STATION", "OLD_HARBOUR", "PUMP_STATION"];

/** The actual city's topology, with an explicitly illustrative forecast.
 * No seeded thresholds, NPC positions, capacity or contribution state is read. */
function FloodMap({ elapsed = 0, distress = false }: { elapsed?: number; distress?: boolean }) {
  const t = useT();
  const content = useScenario02Text();
  const count = Math.min(5, Math.floor(elapsed / 1.2) + 1);
  const flooded = (i: number) => ZONES[i].elevation === "LOW" && elapsed > 2 || ZONES[i].r >= 1 && elapsed > 5;
  return <div className="opening-city-chart">
    <div className="chart-heading"><p>{t("o2.map")}</p><span>{t("o2.illustration")}</span></div>
    <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} aria-hidden="true">
      {ZONES.map((zone, i) => <g key={zone.id}><polygon points={corners(center(i).x, center(i).y, 26)} className={flooded(i) ? "chart-flooded" : "chart-dry"} />
        {zone.facility && <circle cx={center(i).x} cy={center(i).y} r="4" className="chart-facility" />}
        {distress && RESCUE_ZONES.slice(0, count).includes(zone.id) && <g className="chart-distress"><circle cx={center(i).x} cy={center(i).y} r="15" /><path d={`M${center(i).x} ${center(i).y - 7}v9m0 4v1`} /></g>}
      </g>)}
      {ADJACENT.map(([a, b]) => <line key={`${a}-${b}`} x1={center(a).x} y1={center(a).y} x2={center(b).x} y2={center(b).y} className={flooded(a) && flooded(b) ? "chart-broken" : ""} />)}
    </svg>
    {distress ? <div className="distress-ledger"><p>{t("o2.distress")}</p>{RESCUE_ZONES.slice(0, count).map((id) => <span key={id}><i aria-hidden="true" />{content.zones[id].name}</span>)}</div>
      : <div className="chart-legend"><span>{t("o2.normal")}</span><span className="is-flooded">{t("o2.flooded")}</span><span className="is-lost">{t("o2.lost")}</span></div>}
  </div>;
}

function Boat() {
  return <svg className="opening-boat" viewBox="0 0 600 240" aria-hidden="true">
    <path className="boat-water" d="M0 183q35-15 70 0t70 0 70 0 70 0 70 0 70 0 70 0 70 0 70 0V240H0Z" />
    <g className="boat-hull"><path d="M100 142H490L450 188H155Z" /><path d="M180 142V108H270V65H383V142M271 111H383" /><path d="M274 65V42H316M300 42V20M183 94H253M398 120H453V141" />
      <rect x="285" y="80" width="28" height="20" /><rect x="326" y="80" width="28" height="20" /><path d="M115 157H478M100 141 58 180" /></g>
    <path className="boat-pier" d="M0 145H73V165H0M20 165V222M60 165V228M34 126V146" />
  </svg>;
}

export function FloodOpening({ id, elapsed }: { id: string; elapsed: number }) {
  const t = useT();
  switch (id) {
    case "siren": return <div className="flood-broadcast"><div className="radio-aerial" aria-hidden="true" /><p className="opening-kicker">{t("o2.broadcast")}</p><div className={`radio-wave ${elapsed > 1.5 ? "is-cut" : ""}`} aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} style={{ height: `${12 + (i * 17 % 45)}px` }} />)}</div><h2 className={elapsed < 1.5 ? "film-concealed" : ""}>{t("o2.signalLost")}</h2></div>;
    case "city": return <FloodMap elapsed={elapsed} />;
    case "boat": return <div className="opening-boat-panel"><div><p className="opening-kicker">{t("o2.harbour")}</p><Boat /><h2>{t("o2.ship")}</h2></div><ul>{(["engine", "fuel", "nav", "power", "gate"] as const).map((part, i) => <li key={part} className={elapsed < i * .65 ? "film-concealed" : ""}><span aria-hidden="true">×</span>{t(`o2.${part}`)}</li>)}</ul></div>;
    case "distress": return <FloodMap elapsed={elapsed} distress />;
    case "water": {
      const n = Math.min(4, 2 + Math.floor(elapsed / 2));
      return <div className="opening-water"><div className="water-fill" style={{ height: `${n * 18}%` }} aria-hidden="true" /><div className="water-ruler" aria-hidden="true" /><div className="water-reading"><p className="opening-kicker">{t("o2.illustration")}</p><h2>{t("o2.water", { n })}</h2><p>{t(n === 2 ? "o2.accessible" : n === 3 ? "o2.risk" : "o2.lost")}</p><div className="flood-road" aria-hidden="true"><i /><i className={n > 2 ? "road-gone" : ""} /><i className={n > 3 ? "road-gone" : ""} /></div></div></div>;
    }
    case "capacity": return <div className="opening-capacity"><div className="ship-cabin" aria-hidden="true"><i /><i /></div><div className="capacity-terminal"><p>{t("o2.capacity")}</p><h2>{t("o2.pending")}</h2><span aria-hidden="true">— — —</span></div></div>;
    case "route": return <div className="flood-route"><p className="opening-kicker">{t("o2.route")}</p><ol>{(["engine", "fuel", "nav", "gate", "leave"] as const).map((task, i) => <li key={task} className={elapsed < i * .8 ? "film-concealed" : ""}><span>0{i + 1}</span>{t(`o2.task.${task}`)}</li>)}</ol></div>;
    case "title": return <OpeningTitle number="02" title="o2.title" subtitle="o2.subtitle"><div className="flood-title-horizon"><Boat /></div></OpeningTitle>;
    default: return null;
  }
}
