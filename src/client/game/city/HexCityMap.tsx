// Scenario 02's map: the city as hexes, north (the hills) at the top. Height
// shades each zone; water lies over flooded zones and swallows drowned ones;
// a zone that goes under at the next rise pulses red; roads join the centres
// (broken ones are gone, tunnels and low bridges are dashed). Players, people
// waiting for rescue and working facilities sit on their zone. Tapping a zone
// selects it (ZonePanel); in move mode, tapping a highlighted zone moves there.
// On a phone the map keeps a minimum width and scrolls inside its own frame,
// so every zone stays big enough to tap.
import { motion } from "motion/react";
import { getCharacterById } from "../../../shared/characters/roster/index.ts";
import { ZONES, type FacilityId } from "../../../shared/game/scenario02/map.ts";
import type { PlayerView, PublicZone } from "../../../shared/game/state.ts";
import { useScenario02Text, useT } from "../../i18n/index.ts";

const R = 30;
const W = Math.sqrt(3) * R;
const center = (i: number) => ({ x: W * (ZONES[i].q + ZONES[i].r / 2), y: 1.5 * R * ZONES[i].r });
const corners = (cx: number, cy: number, r = R) => Array.from({ length: 6 }, (_, k) => `${cx + r * Math.cos(((60 * k - 30) * Math.PI) / 180)},${cy + r * Math.sin(((60 * k - 30) * Math.PI) / 180)}`).join(" ");

const GROUND = { HIGH: "#3b4a3a", MEDIUM: "#2c3546", LOW: "#232838" } as const;
// plain marks every font has (no emoji)
const FACILITY_MARK: Partial<Record<FacilityId, string>> = { POWER_STATION: "⚡", PUMP_STATION: "≈", HARBOUR: "⚓", BROADCAST_TOWER: "Ψ", HOSPITAL: "✚", FIRE_STATION: "▲", CONTROL_CENTRE: "◉", SHIPYARD: "⚙" };

const bounds = (() => {
  const pts = ZONES.map((_, i) => center(i));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: Math.min(...xs) - W / 2 - 4, y: Math.min(...ys) - R - 4, w: Math.max(...xs) - Math.min(...xs) + W + 8, h: Math.max(...ys) - Math.min(...ys) + 2 * R + 8 };
})();

type Props = { g: PlayerView; selected: number; onSelect: (zone: number) => void; moveTargets?: number[]; onMove?: (zone: number) => void };

export function HexCityMap({ g, selected, onSelect, moveTargets = [], onMove }: Props) {
  const t = useT();
  const text = useScenario02Text();
  const city = g.city!;
  const me = g.players[g.viewerId];
  const here = (i: number) => g.turnOrder.map((id) => g.players[id]).filter((p) => p.carriageIndex === i);
  const statusWord = (z: PublicZone) => t(`s2.status.${z.status}`);

  return (
    <section aria-label={t("s2.map.aria")} className="no-scrollbar overflow-x-auto overscroll-x-contain px-2">
      <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} className="mx-auto block h-auto max-h-[52vh] w-full max-w-3xl min-w-[360px]" role="group">
        <defs>
          <pattern id="waves" width="12" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 5q3-4 6 0t6 0" fill="none" stroke="#5ce1e6" strokeOpacity=".45" strokeWidth="1" />
          </pattern>
          <pattern id="debris" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0v8" stroke="#e2563f" strokeOpacity=".5" strokeWidth="2" />
          </pattern>
        </defs>

        {/* roads under the zones' edges: standing ones only; tunnels and low bridges dashed */}
        {city.edges.map((e) =>
          e.broken ? null : (
            <line
              key={`${e.a}-${e.b}`}
              x1={center(e.a).x}
              y1={center(e.a).y}
              x2={center(e.b).x}
              y2={center(e.b).y}
              stroke={e.kind === "ROAD" ? "#c9a55a" : "#5ce1e6"}
              strokeOpacity={city.zones[e.a].status === "SUBMERGED" || city.zones[e.b].status === "SUBMERGED" ? 0.08 : 0.35}
              strokeWidth={e.kind === "ROAD" ? 2 : 1.5}
              strokeDasharray={e.kind === "ROAD" ? undefined : "3 3"}
            />
          ),
        )}

        {city.zones.map((z, i) => {
          const { x, y } = center(i);
          const def = ZONES[i];
          const sunk = z.status === "SUBMERGED";
          const target = moveTargets.includes(i);
          const mine = me?.carriageIndex === i;
          const people = here(i);
          const waiting = city.npcs.filter((n) => n.zone === i && n.state === "WAITING");
          const label = t("s2.zone.aria", {
            name: text.zones[def.id].name,
            height: t(`s2.height.${def.elevation}`),
            status: statusWord(z),
            warning: z.warning ? t("s2.zone.warningAria") : "",
            you: mine ? t("s2.zone.you") : "",
            count: people.length,
          });
          return (
            <g
              key={def.id}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selected === i}
              className="cursor-pointer outline-none"
              onClick={() => (target && onMove ? onMove(i) : onSelect(i))}
              onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (target && onMove ? onMove(i) : onSelect(i))}
            >
              <motion.polygon
                points={corners(x, y, R - 1)}
                fill={sunk ? "#071225" : GROUND[def.elevation]}
                stroke={target ? "#5ce1e6" : selected === i ? "#e8c97f" : "#0b0f20"}
                strokeWidth={target || selected === i ? 2.5 : 1}
                initial={false}
                animate={{ fill: sunk ? "#071225" : GROUND[def.elevation], opacity: sunk ? 0.55 : 1 }}
                transition={{ duration: 1.2 }}
              />
              {z.status === "FLOODED" && <polygon points={corners(x, y, R - 2)} fill="#1d4f8a" fillOpacity=".45" pointerEvents="none" />}
              {(z.status === "FLOODED" || sunk) && <polygon points={corners(x, y, R - 2)} fill="url(#waves)" pointerEvents="none" />}
              {z.status === "BLOCKED" && <polygon points={corners(x, y, R - 2)} fill="url(#debris)" pointerEvents="none" />}
              {z.warning && (
                <motion.polygon points={corners(x, y, R - 3)} fill="none" stroke="#e2563f" strokeWidth="2" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.6, repeat: Infinity }} pointerEvents="none" />
              )}
              {target && <motion.polygon points={corners(x, y, R - 5)} fill="#5ce1e6" fillOpacity=".12" animate={{ fillOpacity: [0.05, 0.2, 0.05] }} transition={{ duration: 1.4, repeat: Infinity }} pointerEvents="none" />}
              {def.facility && !sunk && (
                <text x={x} y={y - 11} textAnchor="middle" fontSize="11" fill={z.powered ? "#e8c97f" : "#9aa3c7"} pointerEvents="none" aria-hidden="true">
                  {FACILITY_MARK[def.facility]}
                </text>
              )}
              {!sunk && (
                <text x={x} y={y + 2} textAnchor="middle" fontSize="6.5" fill="#cfd6f2" pointerEvents="none" aria-hidden="true">
                  {text.zones[def.id].name.length > 14 ? `${text.zones[def.id].name.slice(0, 13)}…` : text.zones[def.id].name}
                </text>
              )}
              {waiting.length > 0 && (
                <motion.circle cx={x + 13} cy={y - 10} r="4" fill="#e8c97f" animate={{ r: [3, 5, 3] }} transition={{ duration: 1.2, repeat: Infinity }} pointerEvents="none">
                  <title>{waiting.map((n) => text.npcs[n.id].name).join(", ")}</title>
                </motion.circle>
              )}
              {people.slice(0, 4).map((p, k) => {
                const ch = getCharacterById(p.characterId);
                const px = x - 12 + (k % 2) * 13 + (people.length === 1 ? 6 : 0);
                const py = y + 8 + Math.floor(k / 2) * 9;
                return (
                  <g key={p.playerId} pointerEvents="none">
                    <clipPath id={`clip-${p.playerId}`}>
                      <circle cx={px + 5} cy={py + 5} r="5" />
                    </clipPath>
                    <image href={ch.avatar} x={px} y={py} width="10" height="10" clipPath={`url(#clip-${p.playerId})`} opacity={p.lost || p.away ? 0.45 : 1} />
                    <circle cx={px + 5} cy={py + 5} r="5.5" fill="none" stroke={p.playerId === g.viewerId ? "#e8c97f" : city.boat.aboard.includes(p.playerId) ? "#5ce1e6" : "#ffffff55"} strokeWidth="1" />
                  </g>
                );
              })}
              {people.length > 4 && (
                <text x={x + 13} y={y + 24} fontSize="6" fill="#cfd6f2" pointerEvents="none" aria-hidden="true">
                  +{people.length - 4}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
