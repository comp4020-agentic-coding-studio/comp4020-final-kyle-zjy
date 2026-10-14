import { R, center, corners, bounds } from "./geometry.ts";
// Scenario 02's map: the city as hexes, north (the hills) at the top. Height
// shades each zone; water lies over flooded zones and swallows drowned ones;
// a zone that goes under at the next rise pulses red; roads join the centres
// (broken ones are gone, tunnels and low bridges are dashed). Players, people
// waiting for rescue and working facilities sit on their zone. Tapping a zone
// selects it (ZonePanel); in move mode, tapping a highlighted zone moves there.
// On a phone the map keeps a minimum width and scrolls inside its own frame,
// so every zone stays big enough to tap.
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { getCharacterById } from "../../../shared/characters/roster/index.ts";
import { ZONES, type FacilityId } from "../../../shared/game/scenario02/map.ts";
import type { PlayerView, PublicZone } from "../../../shared/game/state.ts";
import { useScenario02Text, useT } from "../../i18n/index.ts";
import { useStore } from "../../store.ts";

const GROUND = { HIGH: "#3b4a3a", MEDIUM: "#2c3546", LOW: "#232838" } as const;
// plain marks every font has (no emoji)
const FACILITY_MARK: Partial<Record<FacilityId, string>> = { POWER_STATION: "⚡", PUMP_STATION: "≈", HARBOUR: "⚓", BROADCAST_TOWER: "Ψ", HOSPITAL: "✚", FIRE_STATION: "▲", CONTROL_CENTRE: "◉", SHIPYARD: "⚙" };

type Props = { g: PlayerView; selected: number; onSelect: (zone: number) => void; moveTargets?: number[]; onMove?: (zone: number) => void };

export function HexCityMap({ g, selected, onSelect, moveTargets = [], onMove }: Props) {
  const t = useT();
  const text = useScenario02Text();
  const city = g.city!;
  const me = g.players[g.viewerId];
  const here = (i: number) => g.turnOrder.map((id) => g.players[id]).filter((p) => p.carriageIndex === i);
  const statusWord = (z: PublicZone) => t(`s2.status.${z.status}`);
  const active = g.step === "PLAYER_TURNS" ? g.turnOrder[g.activeIndex] : null;
  const sunkNow = useJustSunk();

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

        {/* broken roads: a jagged red crack where the link used to be */}
        {city.edges.filter((e) => e.broken).map((e) => {
          const a = center(e.a), b = center(e.b);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = (b.x - a.x) / 6, dy = (b.y - a.y) / 6;
          const nx = -dy * 0.7, ny = dx * 0.7;
          return <polyline key={`x-${e.a}-${e.b}`} data-testid="cracked-road" points={`${mx - dx * 1.2},${my - dy * 1.2} ${mx - dx * 0.5 + nx},${my - dy * 0.5 + ny} ${mx - nx * 0.4},${my - ny * 0.4} ${mx + dx * 0.5 + nx * 0.6},${my + dy * 0.5 + ny * 0.6} ${mx + dx * 1.2},${my + dy * 1.2}`} fill="none" stroke="#e2563f" strokeOpacity=".75" strokeWidth="1.4" strokeLinejoin="bevel" pointerEvents="none" />;
        })}

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
              {(z.status === "FLOODED" || sunk) && <motion.polygon points={corners(x, y, R - 2)} fill={sunk ? "#0b2d63" : "#1d4f8a"} initial={false} animate={{ fillOpacity: sunk ? 0.8 : 0.42 }} transition={{ duration: 1.4 }} pointerEvents="none" />}
              {sunkNow.has(i) && <motion.polygon points={corners(x, y, R - 1)} fill="none" stroke="#9fd0ff" strokeWidth="3" initial={{ opacity: 1 }} animate={{ opacity: [1, 0.15, 1, 0] }} transition={{ duration: 3.2 }} pointerEvents="none" />}
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
            </g>
          );
        })}

        {/* players: one layer on top so a token glides from zone to zone */}
        {g.turnOrder.map((id) => {
          const p = g.players[id];
          const zone = p.carriageIndex;
          const group = here(zone);
          const k = group.findIndex((q) => q.playerId === id);
          const { x, y } = center(zone);
          const px = x - 12 + (k % 2) * 13 + (group.length === 1 ? 6 : 0);
          const py = y + 8 + Math.floor(k / 2) * 9;
          if (k > 3) return null;
          const ch = getCharacterById(p.characterId);
          const aboard = city.boat.aboard.includes(id);
          const isActive = id === active;
          return (
            <motion.g key={id} initial={false} animate={{ x: px, y: py }} transition={{ type: "spring", stiffness: 140, damping: 20 }} pointerEvents="none" data-testid="map-token">
              <clipPath id={`clip-${id}`}>
                <circle cx="5" cy="5" r="5" />
              </clipPath>
              {isActive && <motion.circle cx="5" cy="5" r="7.5" fill="none" stroke="#e8c97f" strokeWidth="1.2" animate={{ opacity: [0.3, 1, 0.3], r: [6.5, 8, 6.5] }} transition={{ duration: 1.4, repeat: Infinity }} />}
              <image href={ch.avatar} width="10" height="10" clipPath={`url(#clip-${id})`} opacity={p.lost || p.away ? 0.45 : 1} />
              <circle cx="5" cy="5" r="5.5" fill="none" stroke={id === g.viewerId ? "#e8c97f" : aboard ? "#5ce1e6" : "#ffffff55"} strokeWidth="1" />
            </motion.g>
          );
        })}
        {city.zones.map((_, i) => {
          const n = here(i).length;
          if (n <= 4) return null;
          const { x, y } = center(i);
          return (
            <text key={`more-${i}`} x={x + 13} y={y + 24} fontSize="6" fill="#cfd6f2" pointerEvents="none" aria-hidden="true">
              +{n - 4}
            </text>
          );
        })}
      </svg>
    </section>
  );
}

/** Zones that went under in the last few seconds (the SUNK cue), so the map can flash them. */
function useJustSunk(): Set<number> {
  const cues = useStore((st) => st.cues);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const live = cues.some((c) => c.kind === "SUNK" && Date.now() - c.at < 3400);
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 600);
    const stop = setTimeout(() => clearInterval(id), 3600);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [cues]);
  const out = new Set<number>();
  for (const c of cues) if (c.kind === "SUNK" && now - c.at < 3200) for (const z of (c.payload.zones as number[]) ?? []) out.add(z);
  return out;
}
