import type { RoomId03, Year03 } from "./map.ts";

// An official claim is an archive assertion; an observed fact is narrower.
// Finding a discrepancy does not by itself prove an ending route is complete.
export const FACTS03 = {
  FOUNDER: { roomId: "DIRECTOR_OFFICE", year: "Y2026" },
  STAFF: { roomId: "MAIN_LAB", year: "Y2026" },
  PROTOTYPE: { roomId: "PROTOTYPE_ROOM", year: "Y2026" },
} as const satisfies Record<string, { roomId: RoomId03; year: Year03 }>;

export type FactId03 = keyof typeof FACTS03;
