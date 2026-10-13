import { checkPreset, type CheckRun } from "../../shared/developer.ts";
import { rememberOpening, openingKey } from "../game/opening/memory.ts";

const KEY = "fate:developer:runs";
let memory: CheckRun[] = [];
export function savedChecks(): CheckRun[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(data)) memory = data.filter((value): value is CheckRun => !!value && !!checkPreset(value.presetId) && typeof value.sessionId === "string" && Array.isArray(value.seats) && value.seats.length === 3 && value.seats.every((s: CheckRun["seats"][number]) => typeof s.sessionToken === "string" && /^[A-Z0-9]{6}$/.test(s.roomCode))).slice(-8);
  } catch { /* In-memory credentials remain usable if storage is unavailable. */ }
  return memory;
}
export function rememberCheck(run: CheckRun) {
  const previous = savedChecks();
  memory = [...previous.filter((p) => p.seats[0].roomCode !== run.seats[0].roomCode), run].slice(-8);
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* current tab retains its test identities */ }
  if (!run.presetId.endsWith(".start")) for (const seat of run.seats) rememberOpening(openingKey({ scenarioId: run.scenarioId, sessionId: run.sessionId, viewerId: seat.playerId }));
}
export const checkPath = (run: CheckRun, seat = run.initialSeat) => `/developer/room/${run.seats[0].roomCode}/${seat}`;
export async function launchCheck(presetId: CheckRun["presetId"]): Promise<CheckRun> {
  const response = await fetch("/api/developer/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ presetId }) });
  if (!response.ok) throw new Error("Checkpoint preparation failed");
  const run: CheckRun = await response.json();
  rememberCheck(run);
  return run;
}
