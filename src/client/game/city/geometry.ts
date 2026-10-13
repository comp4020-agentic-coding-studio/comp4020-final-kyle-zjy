// Shared city topology geometry; rendering and forecast overlays do not own rules.
import { ZONES } from "../../../shared/game/scenario02/map.ts";
export const R = 30;
export const W = Math.sqrt(3) * R;
export const center = (i: number) => ({ x: W * (ZONES[i].q + ZONES[i].r / 2), y: 1.5 * R * ZONES[i].r });
export const corners = (cx: number, cy: number, r = R) => Array.from({ length: 6 }, (_, k) => `${cx + r * Math.cos(((60 * k - 30) * Math.PI) / 180)},${cy + r * Math.sin(((60 * k - 30) * Math.PI) / 180)}`).join(" ");

export const bounds = (() => {
  const pts = ZONES.map((_, i) => center(i));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: Math.min(...xs) - W / 2 - 4, y: Math.min(...ys) - R - 4, w: Math.max(...xs) - Math.min(...xs) + W + 8, h: Math.max(...ys) - Math.min(...ys) + 2 * R + 8 };
})();
