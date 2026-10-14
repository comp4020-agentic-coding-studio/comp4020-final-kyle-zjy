// The run's story, kept as it happens for the end-of-run recap. Entries are
// derived from the cues a step already broadcast, so no rule code writes them,
// and they hold ids and numbers only: each client words them in its locale.
// Actor names can be secret mid-run (scenario 03's intruders), so the
// projection sends the chronicle only once the run has ended.
import type { ChronicleEntry, GameState, PlayerId } from "../../shared/game/state.ts";
import type { GameEvent } from "../../shared/protocol.ts";

const LIMIT = 80;

const str = (x: unknown) => (typeof x === "string" ? x : null);

function entryFor(s: GameState, e: GameEvent): Omit<ChronicleEntry, "round"> | null {
  const p = e.payload;
  const one = (id: unknown): PlayerId[] => (typeof id === "string" ? [id] : []);
  switch (e.kind) {
    // scenario 01
    case "BLACKOUT":
    case "FOLD":
    case "CAB_OPEN":
    case "INSPECTOR_APPEARS":
    case "INSPECTOR_BANISHED":
      return { kind: e.kind, actors: [], data: {} };
    case "ANCHOR_DONE": {
      const id = String(p.anchor) as keyof GameState["anchors"];
      return { kind: e.kind, actors: one(s.anchors[id]?.lastRepairedBy), data: { anchor: id } };
    }
    case "KEY":
      return { kind: e.kind, actors: one(p.playerId), data: { item: String(p.item) } };
    case "LOCK": {
      const lock = String(p.lock) as "power" | "identity" | "memory";
      return { kind: e.kind, actors: one(s.escape.by[lock]), data: { lock } };
    }
    case "VOTE_RESULT":
      // ordinary round-event votes cue this too; only the emergency brake is a story beat
      return p.winner === "BRAKE" || p.winner === "CONTINUE" ? { kind: "BRAKE_VOTE", actors: [], data: { winner: String(p.winner) } } : null;
    case "CORE_MEMORY":
      return Number(p.total) === 6 ? { kind: e.kind, actors: [], data: { total: 6 } } : null;
    // scenario 02
    case "FACILITY":
      return { kind: e.kind, actors: [], data: { facility: String(p.facility) } };
    case "PART":
    case "RESCUE":
      return { kind: e.kind, actors: one(p.playerId), data: p.npc ? { npc: String(p.npc) } : {} };
    case "CAPACITY":
      return { kind: e.kind, actors: [], data: { capacity: Number(p.capacity) } };
    case "FLOOD_STAGE":
      return { kind: e.kind, actors: [], data: { act: Number(p.act) } };
    case "BOAT_READY":
    case "LAUNCH":
      return { kind: e.kind, actors: [], data: {} };
    case "BOARD":
      return { kind: e.kind, actors: Array.isArray(p.aboard) ? (p.aboard as PlayerId[]) : [], data: {} };
    case "TRADE":
    case "S4_DEAL":
      return { kind: "TRADE", actors: [...one(p.from), ...one(p.to)], data: {} };
    // scenario 03
    case "S3_CAUSAL_REWRITE": {
      const last = s.temporal?.interventions.at(-1);
      return { kind: e.kind, actors: one(last?.actorId), data: { node: String(p.nodeId), choice: last?.choiceId ?? "" } };
    }
    case "S3_ITEM_STORED": {
      const closed = s.temporal?.bootstrap.some((b) => b.instanceId === p.instanceId && b.placedBy === p.playerId);
      return closed ? { kind: "S3_LOOP_CLOSED", actors: one(p.playerId), data: { instance: String(p.instanceId) } } : null;
    }
    case "S3_IDENTITY":
    case "S3_THIRD_ROUTE":
      return { kind: e.kind, actors: [], data: {} };
    case "S3_HISTORY_RESOLVED":
      return { kind: e.kind, actors: [], data: { route: String(p.route) } };
    // scenario 04
    case "S4_SOLD":
      return { kind: e.kind, actors: one(p.winnerId), data: { lot: String(p.lotId), price: Number(p.price) } };
    case "S4_BORROW":
      return { kind: e.kind, actors: one(p.playerId), data: {} };
    case "S4_CHALLENGE_END":
      return { kind: e.kind, actors: one(p.winnerId), data: { pot: Number(p.pot) } };
    case "S4_FINAL_REVEAL":
      return { kind: e.kind, actors: Array.isArray(p.tiedPlayerIds) && p.tiedPlayerIds.length > 1 ? (p.tiedPlayerIds as PlayerId[]) : one(p.winnerId), data: { tie: Array.isArray(p.tiedPlayerIds) && p.tiedPlayerIds.length > 1 } };
    case "S4_FINAL_SHOWDOWN_REVEAL":
      return str(p.winnerId) ? { kind: e.kind, actors: one(p.winnerId), data: {} } : null;
    // every scenario
    case "LOST":
      return { kind: e.kind, actors: one(p.playerId), data: {} };
    case "ENDING":
      return { kind: e.kind, actors: [], data: { outcome: String(p.outcome) } };
    default:
      return null;
  }
}

/** Appends this step's story-worthy cues. Deterministic: a replay builds the same chronicle. */
export function recordChronicle(s: GameState, events: GameEvent[]): void {
  for (const e of events) {
    const entry = entryFor(s, e);
    if (!entry) continue;
    const list = (s.chronicle ??= []);
    list.push({ round: Math.max(1, s.round), ...entry });
    if (list.length > LIMIT) list.splice(0, list.length - LIMIT);
  }
}
