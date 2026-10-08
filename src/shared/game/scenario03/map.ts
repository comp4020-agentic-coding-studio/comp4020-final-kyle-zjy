// Eight physical rooms, shared by 1996 and 2026. A year changes the room's
// state, never the building's topology.
export const ROOM_IDS = ["CENTRAL_HALL", "ARCHIVES", "DIRECTOR_OFFICE", "SECRET_ARCHIVE", "RESEARCH_WING", "MAIN_LAB", "PROTOTYPE_ROOM", "POWER_ROOM"] as const;
export type RoomId03 = (typeof ROOM_IDS)[number];
export const YEARS03 = ["Y1996", "Y2026"] as const;
export type Year03 = (typeof YEARS03)[number];

export const ADJACENT03: Record<RoomId03, RoomId03[]> = {
  CENTRAL_HALL: ["ARCHIVES", "RESEARCH_WING"],
  ARCHIVES: ["CENTRAL_HALL", "DIRECTOR_OFFICE", "SECRET_ARCHIVE"],
  DIRECTOR_OFFICE: ["ARCHIVES"],
  SECRET_ARCHIVE: ["ARCHIVES"],
  RESEARCH_WING: ["CENTRAL_HALL", "MAIN_LAB", "PROTOTYPE_ROOM", "POWER_ROOM"],
  MAIN_LAB: ["RESEARCH_WING"],
  PROTOTYPE_ROOM: ["RESEARCH_WING"],
  POWER_ROOM: ["RESEARCH_WING"],
};

// Access is a scenario rule. The map itself remains the same in both years.
export const OPENS_IN_ACT03: Record<RoomId03, 1 | 2 | 3> = {
  CENTRAL_HALL: 1,
  ARCHIVES: 1,
  RESEARCH_WING: 1,
  DIRECTOR_OFFICE: 2,
  MAIN_LAB: 2,
  SECRET_ARCHIVE: 3,
  PROTOTYPE_ROOM: 3,
  POWER_ROOM: 3,
};

export const roomIndex03 = (id: RoomId03): number => ROOM_IDS.indexOf(id);
export const placeKey03 = (id: RoomId03, year: Year03): number => roomIndex03(id) + (year === "Y2026" ? ROOM_IDS.length : 0);
export const placeFromKey03 = (key: number): { roomId: RoomId03; year: Year03 } | null =>
  Number.isInteger(key) && key >= 0 && key < ROOM_IDS.length * 2
    ? { roomId: ROOM_IDS[key % ROOM_IDS.length], year: key < ROOM_IDS.length ? "Y1996" : "Y2026" }
    : null;
