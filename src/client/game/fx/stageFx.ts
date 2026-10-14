// Which sound a server cue makes. One table for every scenario so a beat sounds
// the same wherever it happens; cues the viewer shouldn't react to (another
// player's private intel) stay silent rather than hint that something happened.
import type { OpeningSfx } from "../../audio/manager.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import type { GameEvent } from "../../../shared/protocol.ts";

const TIER_SFX: Record<string, OpeningSfx> = { PERFECT: "roll_perfect", SUCCESS: "roll_success", FAIL: "roll_fail", DISASTER: "roll_disaster" };

export function sfxFor(e: GameEvent, g: PlayerView): OpeningSfx | null {
  const p = e.payload;
  const mine = p.playerId === g.viewerId;
  switch (e.kind) {
    case "ROLL": return "dice_roll";
    case "ROLL_DONE": return TIER_SFX[String(p.tier)] ?? null;
    case "TURN": return p.playerId === g.viewerId ? "turn_start" : null;
    case "ITEM": case "KEY": case "PART": case "S3_ITEM_PICKUP": return mine ? "item_gain" : null;
    case "ITEM_USED": case "S4_ITEM_USED": return "item_use";
    case "HELP": return "help_link";
    case "TRADE": case "S4_DEAL": case "S3_ITEM_TRADE": return "trade_done";
    case "COLLAPSE": return Number(p.to) > Number(p.from) ? "danger_rise" : "ui_confirm";
    case "SECRET": return p.all || mine ? "private_message" : null;
    case "S4_PRIVATE_INTEL": case "S4_PRIVATE_READ": case "S3_ARCHIVE_LEAD": case "PASS": return mine ? "private_message" : null;
    case "ANCHOR_DONE": case "FACILITY": return "ui_lock";
    case "LOCK": return "door_unlock";
    case "INSPECTOR_APPEARS": return "ticket_punch";
    case "SUNK": case "ROAD": return "road_collapse";
    case "FLOOD_STAGE": return "water_rise";
    case "ROUND": return g.scenarioId === "S02_SUNKEN_CITY" && Number(p.round) > 1 ? "radio_static" : null;
    case "BOARDING_OPEN": return "ship_horn_distant";
    case "CAPACITY": return "emergency_broadcast";
    case "BOAT_READY": return "ship_horn_distant";
    case "LAUNCH": return "ship_horn_distant";
    case "TIME_JUMP": return mine ? "timeline_rewind" : null;
    case "S3_CAUSAL_REWRITE": return "timeline_shift";
    case "S4_BID": return "chip_drop";
    case "S4_SOLD": return "auction_gavel";
    case "S4_BLACKJACK_CARD": case "S4_FINAL_SHOWDOWN_REVEAL": return "card_flip";
    case "ENDING": return "fanfare";
    default: return null;
  }
}
