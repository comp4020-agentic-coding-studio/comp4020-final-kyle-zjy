import type { RoomService } from "../rooms/service.ts";
import { transaction } from "../db/db.ts";
import { newSeed, seedState, d6 } from "../engine/rng.ts";
import type { Toolbox, ToolboxView, ToolAction } from "../../shared/toolbox/types.ts";
import { T } from "../../shared/toolbox/text.ts";
import { actPoker, demand, emptyPoker } from "./poker.ts";
export class ToolStore {
  rooms: RoomService;
  constructor(rooms: RoomService) { this.rooms = rooms; }
  private load(code: string): Toolbox {
    const row = this.rooms.db.prepare("SELECT state_json FROM toolbox_rooms WHERE room_code = ?").get(code);
    return row ? JSON.parse(String(row.state_json)) as Toolbox : { version: 0, tool: "chips", poker: emptyPoker(), dice: {}, rng: seedState(newSeed()), rngCalls: 0, requests: [] };
  }
  view(code: string, token: unknown): ToolboxView {
    const id = this.rooms.authenticate(code, token);
    const room = this.rooms.roomState(code, new Set())!;
    const s = this.load(room.code);
    // Explicit allowlist: no other player's dice, RNG, or request tokens leave the server.
    return { version: s.version, tool: s.tool, poker: s.poker, mine: s.dice[id] ?? [], viewer: id, members: room.members.map(({ playerId, nickname, isHost }) => ({ playerId, nickname, isHost })) };
  }
  action(rawCode: string, token: unknown, version: unknown, requestId: unknown, action: unknown): ToolboxView {
    const id = this.rooms.authenticate(rawCode, token);
    const room = this.rooms.roomState(rawCode, new Set())!;
    demand(typeof requestId === "string" && requestId.length >= 8 && requestId.length <= 100, T.invalid);
    demand(action && typeof action === "object" && "type" in action, T.invalid);
    const a = action as ToolAction;
    transaction(this.rooms.db, () => {
      const s = this.load(room.code);
      const key = `${id}:${requestId}`;
      if (s.requests.includes(key)) return;
      // Private rolls do not invalidate another player's simultaneous table intent.
      if (a.type !== "ROLL") demand(version === s.version, T.stale);
      const host = room.members.some(m => m.playerId === id && m.isHost);
      if (a.type === "SWITCH") { demand(host, T.host); demand(a.tool === "dice" || a.tool === "chips", T.invalid); s.tool = a.tool; s.version++; }
      else if (a.type === "ROLL") {
        demand(s.tool === "dice", T.stage);
        const history = s.dice[id] ?? [];
        demand(!history[0] || Date.now() - history[0].at >= 500, T.stage);
        s.dice[id] = [{ values: Array.from({ length: 5 }, () => d6(s)), at: Date.now() }, ...history].slice(0, 10);
      } else { demand(s.tool === "chips", T.stage); actPoker(s.poker, id, a, host, room.members.map(m => m.playerId)); s.version++; }
      s.requests.push(key); s.requests = s.requests.slice(-200);
      this.rooms.db.prepare("INSERT INTO toolbox_rooms(room_code,state_json) VALUES (?,?) ON CONFLICT(room_code) DO UPDATE SET state_json=excluded.state_json").run(room.code, JSON.stringify(s));
      this.rooms.db.prepare("UPDATE rooms SET updated_at=? WHERE code=?").run(Date.now(), room.code);
    });
    return this.view(room.code, token);
  }
}
