// The ending cinematics: which one a finished run shows this viewer, and each
// one's scenes, captions, foley and score. Pure data over the projected view:
// the server has already decided the outcome, so nothing here judges a run.
// Scenarios 01 and 03 end the same way for the whole table; 02 and 04 play the
// viewer's own fate, read from their projected result and the public winner.
import type { PlayerView } from "../../../shared/game/state.ts";
import type { AudioTheme, OpeningSfx } from "../../audio/manager.ts";
import type { MessageKey } from "../../i18n/index.ts";
import type { Scene } from "../opening/timeline.ts";

export const ENDING_IDS = [
  "s01_normal_escape", "s01_ticket_true_end",
  "s02_escaped", "s02_last_light", "s02_left_behind",
  "s03_official_history", "s03_no_tomorrow", "s03_deceive_history",
  "s04_normal_exit", "s04_debt_follows", "s04_no_exit",
] as const;
export type EndingId = (typeof ENDING_IDS)[number];

/** `theme`/`level`: the score from this scene on; `fade`: seconds to reach `level`. */
export type EndingScene = Scene & { theme: AudioTheme; level: number; fade?: number };
export type EndingFilm = {
  variant: "train" | "flood" | "temporal" | "auction";
  label: MessageKey;
  card: { kicker: MessageKey; title: MessageKey; lines: readonly MessageKey[]; tag?: MessageKey };
  scenes: readonly EndingScene[];
};

/** The cinematic for this viewer, or null when the outcome has none (failures, the delete ending). */
export function endingFor(g: Pick<PlayerView, "outcome" | "viewerId" | "results" | "auction">): EndingId | null {
  switch (g.outcome) {
    case "NORMAL": return "s01_normal_escape";
    case "TRUE_TICKET": return "s01_ticket_true_end";
    case "S02_EVACUATED": {
      const fate = g.results?.find((r) => r.playerId === g.viewerId)?.escape;
      return fate === "ESCAPED" ? "s02_escaped" : fate === "ENGINEER" ? "s02_last_light" : fate === "LEFT_BEHIND" ? "s02_left_behind" : null;
    }
    case "S03_OFFICIAL_HISTORY": return "s03_official_history";
    case "S03_NO_TOMORROW": return "s03_no_tomorrow";
    case "S03_DECEIVE_HISTORY": return "s03_deceive_history";
    case "S04_EXIT":
    case "S04_DEBT":
    case "S04_UNSOLD":
      // the server's outcome already says whether the winner leaves with debt
      if (g.outcome === "S04_UNSOLD" || g.auction?.final?.winnerId !== g.viewerId) return "s04_no_exit";
      return g.outcome === "S04_DEBT" ? "s04_debt_follows" : "s04_normal_exit";
    default: return null;
  }
}

/** Only what this viewer may already see: their name, the public boat list, their seat, their own debt. */
export type EndingFacts = { me: string; names: readonly string[]; aboard: readonly string[]; seat: number; debt: number };
export function endingFacts(g: PlayerView): EndingFacts {
  const name = (id: string) => g.players[id]?.nickname ?? "";
  return {
    me: name(g.viewerId),
    names: g.turnOrder.map(name),
    aboard: (g.city?.boat.aboard ?? []).map(name),
    seat: Math.max(0, g.auction?.seatOrder.indexOf(g.viewerId) ?? 0) + 1,
    debt: g.auction?.players[g.viewerId]?.debt ?? 0,
  };
}

type Sfx = readonly (readonly [number, OpeningSfx])[];
const scene = (id: string, duration: number, captions: readonly MessageKey[], theme: AudioTheme, level: number, sounds: Sfx = [], fade?: number): EndingScene =>
  ({ id, duration, captions: captions.map((key, i) => [i * 3, key] as const), sounds, theme, level, fade });
const card = (theme: AudioTheme, level: number) => scene("card", 6, [], theme, level);

export const ENDING_FILMS: Record<EndingId, EndingFilm> = {
  // 01: one theme (the train, 00:17, the ticket); the escape leaves it unresolved, the ticket resolves it
  s01_normal_escape: {
    variant: "train", label: "end.s1n.aria",
    card: { kicker: "end.s1n.kicker", title: "end.s1n.title", lines: ["end.s1n.l1", "end.s1n.l2"] },
    scenes: [
      scene("locks", 7, ["end.s1n.locks"], "s01_ambient", .55, [[.8, "door_unlock"], [2.2, "door_unlock"], [3.6, "door_unlock"], [5, "low_impact"]]),
      scene("slow", 7, ["end.s1n.slow"], "s01_ambient", .5, [[0, "train_arrival"]]),
      scene("clock", 7, [], "s01_ending", .6, [[4, "low_impact"]]),
      scene("doors", 8, ["end.s1n.terminal"], "s01_ending", .6, [[.3, "station_announcement"], [3, "train_door"]]),
      scene("lookback", 6, ["end.s1n.back"], "s01_ending", .5, [[2, "train_arrival"]]),
      card("s01_ending", .4),
    ],
  },
  s01_ticket_true_end: {
    variant: "train", label: "end.s1t.aria",
    card: { kicker: "end.s1t.kicker", title: "end.s1t.title", lines: ["end.s1t.l1", "end.s1t.l2"] },
    scenes: [
      scene("ticket", 7, ["end.s1t.ticket"], "intro_train", .5, [[.5, "ticket_flip"]]),
      scene("figure", 7, ["end.s1t.figure"], "intro_train", .55, [[0, "memory_whisper"]]),
      scene("punch", 8, ["end.s1t.inspector"], "s01_ending", .6, [[4, "ticket_punch"]]),
      scene("clock", 6, [], "s01_ending", .65, [[3, "low_impact"]]),
      scene("exit", 7, ["end.s1t.exit"], "s01_ending", .65, [[.5, "train_door"]]),
      scene("seat", 6, ["end.s1t.seat"], "s01_ending", .55, [[3, "door_close"], [4, "train_arrival"]]),
      card("s01_ending", .45),
    ],
  },
  // 02: water, radio and the generator; relief, sacrifice, abandonment
  s02_escaped: {
    variant: "flood", label: "end.s2e.aria",
    card: { kicker: "end.personal", title: "end.s2e.title", lines: ["end.s2e.l1", "end.s2e.l2"] },
    scenes: [
      scene("aboard", 6, ["end.s2e.aboard"], "s02_evacuation", .45, [[.5, "ship_horn_distant"]]),
      scene("pier", 7, ["end.s2e.pier"], "s02_evacuation", .5, [[1, "water_rise"]]),
      scene("radio", 7, ["end.s2e.radio"], "s02_ending", .55, [[0, "radio_static"], [3.5, "radio_static"]]),
      scene("city", 6, ["end.s2e.city"], "s02_ending", .6),
      scene("dawn", 5, ["end.s2e.dawn"], "s02_ending", .55),
      card("s02_ending", .4),
    ],
  },
  s02_last_light: {
    variant: "flood", label: "end.s2l.aria",
    card: { kicker: "end.personal", title: "end.s2l.title", lines: ["end.s2l.l1", "end.s2l.l2"], tag: "end.s2l.tag" },
    scenes: [
      scene("stay", 6, ["end.s2l.stay"], "s02_ending", .45, [[.5, "map_alert"]]),
      scene("dark", 8, ["end.s2l.dark"], "s02_ending", .5, [[2, "danger_rise"]]),
      scene("console", 7, ["end.s2l.console"], "s02_ending", .75, [[1.5, "ui_lock"], [3, "low_impact"], [3.2, "fluorescent_hum"]]),
      scene("harbour", 7, ["end.s2l.harbour"], "s02_ending", .7, [[2, "ship_horn_distant"]]),
      scene("water", 6, ["end.s2l.water"], "s02_ending", .45, [[0, "water_rise"], [3, "road_collapse"]]),
      scene("light", 6, ["end.s2l.light"], "s02_ending", 0, [], 5),
      scene("silence", 2, [], "s02_ending", 0),
      card("s02_ending", .35),
    ],
  },
  s02_left_behind: {
    variant: "flood", label: "end.s2b.aria",
    card: { kicker: "end.personal", title: "end.s2b.title", lines: ["end.s2b.l1", "end.s2b.l2"], tag: "end.s2b.tag" },
    scenes: [
      scene("arrive", 6, ["end.s2b.arrive"], "failure", .45, [[0, "radio_static"]]),
      scene("closed", 5, ["end.s2b.closed"], "failure", .45, [[.5, "ui_error"]]),
      scene("boat", 7, ["end.s2b.boat"], "failure", .5, [[1, "ship_horn_distant"]]),
      scene("back", 6, ["end.s2b.back"], "failure", .45, [[1, "water_rise"]]),
      card("failure", .35),
    ],
  },
  // 03: the clock motif (Echoes of Time) opens all three; order, erasure, a false calm
  s03_official_history: {
    variant: "temporal", label: "end.s3o.aria",
    card: { kicker: "end.route", title: "end.s3o.title", lines: ["end.s3o.l1", "end.s3o.l2"] },
    scenes: [
      scene("dual", 8, ["end.s3o.dual"], "scenario03_intro", .55, [[0, "crt_noise"], [4, "timeline_shift"]]),
      scene("archive", 8, ["end.s3o.archive"], "s03_resolution", .6, [[0, "archive_scan"], [4, "archive_scan"]]),
      scene("accident", 7, ["end.s3o.accident"], "s03_resolution", .6, [[2, "low_impact"]]),
      scene("bureau", 6, ["end.s3o.bureau"], "s03_resolution", .55, [[1, "security_lock"]]),
      scene("clock", 6, [], "s03_resolution", .6, [[3, "title_reveal"]]),
      card("s03_resolution", .4),
    ],
  },
  s03_no_tomorrow: {
    variant: "temporal", label: "end.s3n.aria",
    card: { kicker: "end.route", title: "end.s3n.title", lines: ["end.s3n.l1", "end.s3n.l2"] },
    scenes: [
      scene("core", 7, ["end.s3n.core"], "scenario03_intro", .55, [[0, "temporal_sync_error"]]),
      scene("records", 8, ["end.s3n.records"], "scenario03_intro", .4, [[1, "record_corruption"]], 4),
      scene("dissolve", 8, ["end.s3n.bureau"], "scenario03_intro", .25, [[1, "timeline_rewind"]], 4),
      scene("white", 6, ["end.s3n.white"], "scenario03_intro", 0, [], 4),
      card("failure", .35),
    ],
  },
  s03_deceive_history: {
    variant: "temporal", label: "end.s3d.aria",
    card: { kicker: "end.route", title: "end.s3d.title", lines: ["end.s3d.l1", "end.s3d.l2"] },
    scenes: [
      scene("alarm", 7, ["end.s3d.alarm"], "scenario03_intro", .55, [[.5, "security_lock"], [1.5, "security_lock"]]),
      scene("montage", 9, ["end.s3d.montage"], "scenario03_intro", .55, [[1.5, "ui_lock"], [3.5, "ui_lock"], [5.5, "ui_lock"], [7.5, "ui_lock"]]),
      scene("check", 8, ["end.s3d.check"], "s03_ending", .6, [[1, "archive_scan"], [5, "ui_confirm"]]),
      scene("hidden", 9, ["end.s3d.hidden"], "s03_ending", .45, [[3, "crt_noise"], [6, "low_impact"]]),
      card("s03_ending", .4),
    ],
  },
  // 04: the lounge motif (Covert Affair); release, release broken, the loop restarting
  s04_normal_exit: {
    variant: "auction", label: "end.s4n.aria",
    card: { kicker: "end.fate", title: "end.s4n.title", lines: ["end.s4n.l1", "end.s4n.l2"] },
    scenes: [
      scene("table", 7, ["end.s4n.table"], "s04_auction_ambient", .5, [[1, "chip_slide"]]),
      scene("gavel", 6, ["end.s4n.gavel"], "s04_auction_ambient", .5, [[.5, "auction_gavel"], [3, "door_unlock"]]),
      scene("stairs", 7, ["end.s4n.stairs"], "s04_ending", .6),
      scene("door", 6, ["end.s4n.door"], "s04_ending", .6, [[3, "door_close"]]),
      card("s04_ending", .45),
    ],
  },
  s04_debt_follows: {
    variant: "auction", label: "end.s4d.aria",
    card: { kicker: "end.fate", title: "end.s4d.title", lines: ["end.s4d.l1", "end.s4d.l2"] },
    scenes: [
      scene("table", 6, ["end.s4n.table"], "s04_auction_ambient", .5, [[1, "chip_slide"]]),
      scene("gavel", 6, ["end.s4d.door"], "s04_ending", .6, [[.3, "auction_gavel"], [2.5, "door_unlock"]]),
      scene("paper", 5, ["end.s4d.paper"], "s04_ending", .15, [[1, "invitation_open"]], 1),
      scene("figure", 7, ["end.s4d.figure"], "s04_reveal", .6, [[2, "card_flip"]]),
      scene("ledger", 8, ["end.s4d.ledger"], "s04_reveal", .6, [[5, "ui_lock"]]),
      scene("street", 6, ["end.s4d.street"], "s04_reveal", .5, [[1, "door_close"], [4, "invitation_open"]]),
      card("s04_reveal", .4),
    ],
  },
  s04_no_exit: {
    variant: "auction", label: "end.s4x.aria",
    card: { kicker: "end.fate", title: "end.s4x.title", lines: ["end.s4x.l1", "end.s4x.l2"] },
    scenes: [
      scene("leave", 6, ["end.s4x.door"], "s04_auction_ambient", .55, [[1, "door_unlock"], [4.5, "door_close"]]),
      scene("dim", 6, ["end.s4x.dim"], "s04_auction_ambient", .4),
      scene("reset", 7, ["end.s4x.reset"], "s04_auction_ambient", .3, [[1, "chip_slide"], [2.5, "chip_drop"], [4, "card_flip"], [4.6, "card_flip"]]),
      scene("bidder", 5, ["end.s4x.bidder"], "silence", 0),
      scene("lot", 2, [], "silence", 0, [[.8, "auction_gavel"]]),
      // the same motif starts over from its first bar: a fresh deck, not the faded one
      scene("again", 5, ["end.s4x.again"], "s04_auction_ambient", .6),
      card("s04_auction_ambient", .45),
    ],
  },
};

/** Reduced motion: every scene settles into its still frame for a moment; the card keeps its time. */
export const reducedScenes = (scenes: readonly EndingScene[]): EndingScene[] =>
  scenes.map((s) => s.id === "card" ? s : { ...s, duration: Math.min(s.duration, 2.5), sounds: s.sounds?.slice(0, 1).map(([, cue]) => [0, cue] as const) });

// Once per run and viewer: a refresh after the film doesn't force it again, a new run plays it.
const watched = new Set<string>();
export const endingKey = (g: Pick<PlayerView, "sessionId" | "viewerId">, id: EndingId) => `fate:ending:${g.sessionId}:${g.viewerId}:${id}`;
export function endingWatched(key: string): boolean {
  if (watched.has(key)) return true;
  try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
}
export function rememberEnding(key: string): void {
  watched.add(key);
  try { sessionStorage.setItem(key, "1"); } catch { /* this document still remembers */ }
}
