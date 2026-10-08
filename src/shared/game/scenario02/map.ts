// The sinking city of scenario 02: 31 hexes in axial coordinates (q, r),
// pointy-top, north (the hills) at the top and the sea to the south. The
// layout and elevations are fixed; when each zone floods and goes under, which
// tunnels and low bridges give way, and where the parts are hidden are drawn
// per run (src/server/engine/scenario02/city.ts).
import type { Elevation } from "../state.ts";

export type FacilityId = "BROADCAST_TOWER" | "HOSPITAL" | "FIRE_STATION" | "CONTROL_CENTRE" | "POWER_STATION" | "PUMP_STATION" | "SHIPYARD" | "HARBOUR";

export type ZoneDef = {
  id: string;
  name: string;
  /** One line on the zone panel. */
  text: string;
  q: number;
  r: number;
  elevation: Elevation;
  facility?: FacilityId;
};

export const ZONES: ZoneDef[] = [
  // the hills
  { id: "BROADCAST_TOWER", name: "Hilltop Broadcast Tower", text: "The mast still hums. Somebody keeps reading out names.", q: 1, r: -3, elevation: "HIGH", facility: "BROADCAST_TOWER" },
  { id: "RESERVOIR", name: "Hill Reservoir", text: "Full to the brim, and the water in it is perfectly still.", q: 2, r: -3, elevation: "HIGH" },
  { id: "OBSERVATORY", name: "Old Observatory", text: "Star charts, a sextant, a logbook of coastlines that moved.", q: -1, r: -2, elevation: "HIGH" },
  { id: "HOSPITAL", name: "St Agnes Hospital", text: "The generators are holding. The patients are not all where they should be.", q: 0, r: -2, elevation: "HIGH", facility: "HOSPITAL" },
  { id: "SCHOOL", name: "Hillside School", text: "Desks stacked against the doors. A lesson is still on the board.", q: 1, r: -2, elevation: "HIGH" },
  { id: "CEMETERY", name: "Ridge Cemetery", text: "The newest headstones have no names yet.", q: 2, r: -2, elevation: "HIGH" },
  { id: "QUARRY", name: "Quarry Road", text: "Diesel drums and a crane nobody has climbed in years.", q: 3, r: -2, elevation: "MEDIUM" },
  { id: "TERRACES", name: "Upper Terraces", text: "Washing still hangs between the balconies.", q: -2, r: -1, elevation: "HIGH" },
  // the city centre
  { id: "FIRE_STATION", name: "Fire Station 9", text: "One engine left behind, its tank half full.", q: -1, r: -1, elevation: "MEDIUM", facility: "FIRE_STATION" },
  { id: "CITY_HALL", name: "City Hall Control Centre", text: "Every screen shows the same tide chart, a day ahead of the sea.", q: 0, r: -1, elevation: "MEDIUM", facility: "CONTROL_CENTRE" },
  { id: "MALL", name: "Arcade Mall", text: "The escalators run for nobody.", q: 1, r: -1, elevation: "MEDIUM" },
  { id: "POWER_STATION", name: "Power Station", text: "Two turbines, one of them still turning.", q: 2, r: -1, elevation: "MEDIUM", facility: "POWER_STATION" },
  { id: "RAIL_YARD", name: "Rail Yard", text: "Freight cars of machine parts, sealed and labelled for a port.", q: 3, r: -1, elevation: "MEDIUM" },
  { id: "ESTATE", name: "Willow Estate", text: "Front doors left open. The street lights blink in sequence.", q: -2, r: 0, elevation: "MEDIUM" },
  { id: "PARK", name: "Memorial Park", text: "The fountain runs backwards.", q: -1, r: 0, elevation: "MEDIUM" },
  { id: "CIVIC_SQUARE", name: "Civic Square", text: "Where the evacuation sirens started. Where everyone met.", q: 0, r: 0, elevation: "MEDIUM" },
  { id: "METRO", name: "Central Metro", text: "The stairs go down into black water that doesn't ripple.", q: 1, r: 0, elevation: "LOW" },
  { id: "WAREHOUSES", name: "Bonded Warehouses", text: "A raised dock of fuel cans and tinned food, stacked to the roof.", q: 2, r: 0, elevation: "MEDIUM" },
  // the lowlands
  { id: "WEST_MARINA", name: "West Marina", text: "Yachts tied to moorings that are now underwater.", q: -3, r: 1, elevation: "LOW" },
  { id: "NIGHT_MARKET", name: "Night Market", text: "Lanterns still lit over empty stalls.", q: -2, r: 1, elevation: "LOW" },
  { id: "RIVERSIDE", name: "Riverside Flats", text: "The river came up the stairwells first.", q: -1, r: 1, elevation: "LOW" },
  { id: "VIADUCT", name: "Elevated Viaduct", text: "A high road over the lowlands, straight to the harbour.", q: 0, r: 1, elevation: "HIGH" },
  { id: "INDUSTRIAL", name: "Industrial Park", text: "Workshops, engine blocks on pallets, a forklift with the keys in.", q: 1, r: 1, elevation: "LOW" },
  { id: "PUMP_STATION", name: "Pump Station", text: "Six great pumps. One still answers its lever.", q: 2, r: 1, elevation: "MEDIUM", facility: "PUMP_STATION" },
  { id: "SEA_WALL", name: "Sea Wall Promenade", text: "The wall is still standing. The sea is on both sides of it.", q: -3, r: 2, elevation: "LOW" },
  { id: "FISH_MARKET", name: "Fish Market", text: "Ice melting in the crates. Something moves under the stalls.", q: -2, r: 2, elevation: "LOW" },
  { id: "OLD_HARBOUR", name: "Old Harbour", text: "Rotten piers and an old lifeboat shed.", q: -1, r: 2, elevation: "LOW" },
  { id: "HARBOUR", name: "Evacuation Pier", text: "The last pier with a working gate. The boat is moored here.", q: 0, r: 2, elevation: "MEDIUM", facility: "HARBOUR" },
  { id: "SHIPYARD", name: "Shipyard", text: "Dry docks, cranes, and engines waiting for hulls.", q: 1, r: 2, elevation: "LOW", facility: "SHIPYARD" },
  { id: "LIGHTHOUSE", name: "Breakwater Lighthouse", text: "The lamp turns, and its beam lands on things that aren't there.", q: -2, r: 3, elevation: "MEDIUM" },
  { id: "BREAKWATER", name: "Breakwater", text: "A stone arm into the sea, half under already.", q: -1, r: 3, elevation: "LOW" },
];

export const ZONE_INDEX: Record<string, number> = Object.fromEntries(ZONES.map((z, i) => [z.id, i]));
export const zoneIndex = (id: string): number => {
  const i = ZONE_INDEX[id];
  if (i === undefined) throw new Error(`no zone ${id}`);
  return i;
};

export const START_ZONE = "CIVIC_SQUARE";
export const HARBOUR_ZONE = "HARBOUR";

const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Pairs of zone indexes that share a side (each pair once, lower index first). */
export const ADJACENT: [number, number][] = ZONES.flatMap((z, i) =>
  DIRS.map(([dq, dr]) => ZONES.findIndex((o) => o.q === z.q + dq && o.r === z.r + dr)).filter((j) => j > i).map((j): [number, number] => [i, j]),
);

/** Tunnels and low bridges: they give way as the water rises (Collapse 5–6). */
export const FRAGILE: { a: string; b: string; kind: "TUNNEL" | "LOW_BRIDGE" }[] = [
  { a: "CIVIC_SQUARE", b: "METRO", kind: "TUNNEL" },
  { a: "METRO", b: "WAREHOUSES", kind: "TUNNEL" },
  { a: "METRO", b: "INDUSTRIAL", kind: "TUNNEL" },
  { a: "PARK", b: "RIVERSIDE", kind: "LOW_BRIDGE" },
  { a: "ESTATE", b: "NIGHT_MARKET", kind: "LOW_BRIDGE" },
  { a: "PUMP_STATION", b: "SHIPYARD", kind: "LOW_BRIDGE" },
];

/** Hex steps between two zones, ignoring water. */
export function hexDistance(a: number, b: number): number {
  const x = ZONES[a], y = ZONES[b];
  const dq = x.q - y.q, dr = x.r - y.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Where each boat part can be hidden; one site per part is drawn each run. */
export const PART_SITES: Record<"ENGINE" | "FUEL" | "NAV", string[]> = {
  ENGINE: ["SHIPYARD", "INDUSTRIAL", "RAIL_YARD"],
  FUEL: ["WAREHOUSES", "FIRE_STATION", "QUARRY", "INDUSTRIAL"],
  NAV: ["BROADCAST_TOWER", "LIGHTHOUSE", "CITY_HALL", "OBSERVATORY"],
};
