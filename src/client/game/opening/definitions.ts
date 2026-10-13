import type { ScenarioId } from "../../../shared/game/state.ts";
import { OPENING_SCENES } from "../scenario03/opening/timeline.ts";
import type { OpeningDefinition, Scene } from "./timeline.ts";

const train = [
  { id: "time", duration: 6, captions: [[0, "o1.n.time"]], sounds: [[.2, "station_announcement"], [.7, "fluorescent_hum"]] },
  { id: "phones", duration: 8, captions: [[0, "o1.n.notice"]], sounds: [[0, "phone_notification"], [1.1, "phone_notification"], [2.6, "phone_notification"]] },
  { id: "arrival", duration: 8, captions: [[0, "o1.n.driver"], [3.5, "o1.n.map"]], sounds: [[0, "train_arrival"], [4.5, "train_door"]] },
  { id: "tickets", duration: 9, captions: [[0, "o1.n.ticket"], [4, "o1.ticketBack"]], sounds: [[3, "ticket_flip"], [4, "low_impact"]] },
  { id: "manifest", duration: 10, captions: [[0, "o1.n.knows"], [4, "o1.n.howMany"]], sounds: [[4, "record_glitch"]] },
  { id: "memory", duration: 8, captions: [[0, "o1.n.forgotten"], [4, "o1.n.someone"]], sounds: [[0, "memory_whisper"]] },
  { id: "protocol", duration: 7, captions: [[0, "o1.n.evidence"]] },
  { id: "title", duration: 10, captions: [[2, "o1.tagline"]], sounds: [[0, "ticket_punch"]] },
  { id: "handoff", duration: 2, captions: [] },
] as const satisfies readonly Scene[];
const flood = [
  { id: "siren", duration: 6, captions: [[0, "o2.n.alarm"], [3, "o2.n.sea"]], sounds: [[.2, "emergency_broadcast"], [1.5, "radio_static"]] },
  { id: "city", duration: 8, captions: [[0, "o2.n.coast"], [3.5, "o2.n.high"]], sounds: [[2, "map_alert"], [5, "road_collapse"]] },
  { id: "boat", duration: 8, captions: [[0, "o2.n.ship"], [4, "o2.n.nowhere"]], sounds: [[0, "ship_horn_distant"]] },
  { id: "distress", duration: 8, captions: [[0, "o2.n.people"], [1.6, "o2.n.floor"], [3.2, "o2.n.power"], [4.8, "o2.n.time"]], sounds: [[0, "distress_signal"], [1.6, "radio_static"], [3.2, "distress_signal"]] },
  { id: "water", duration: 7, captions: [[0, "o2.n.smaller"]], sounds: [[1, "water_rise"], [4, "road_collapse"]] },
  { id: "capacity", duration: 6, captions: [[0, "o2.n.capacity"]], sounds: [[0, "radio_static"]] },
  { id: "route", duration: 6, captions: [[0, "o2.task.leave"]] },
  { id: "title", duration: 9, captions: [[0, "o2.n.survivors"], [2.5, "o2.tagline1"], [5.5, "o2.tagline2"]], sounds: [[1.5, "radio_static"]] },
  { id: "handoff", duration: 2, captions: [] },
] as const satisfies readonly Scene[];
const auction = [
  { id: "invitation", duration: 7, captions: [[2, "o4.bring"]], sounds: [[.5, "invitation_open"]] },
  { id: "entrance", duration: 7, captions: [[0, "o4.n.chosen"], [3.5, "o4.n.you"]], sounds: [[2, "door_unlock"], [5, "door_close"]] },
  { id: "catalogue", duration: 9, captions: [[0, "o4.n.ten"], [5, "o4.n.exit"]], sounds: [[0, "lot_reveal"]] },
  { id: "chips", duration: 7, captions: [[0, "o4.n.chips"], [3.5, "o4.n.debt"]], sounds: [[.3, "chip_drop"], [.9, "chip_drop"], [1.5, "chip_drop"], [2.1, "chip_drop"], [2.7, "chip_drop"], [3.3, "chip_drop"], [3.9, "chip_drop"], [4.5, "chip_drop"]] },
  { id: "lots", duration: 7, captions: [[0, "o4.n.real"]], sounds: [[0, "lot_reveal"], [3, "lot_reveal"]] },
  { id: "seats", duration: 7, captions: [[0, "o4.n.price"], [3.5, "o4.n.intel"]], sounds: [[2, "card_flip"], [4, "chip_slide"]] },
  { id: "auctioneer", duration: 6, captions: [[0, "o4.n.look"], [3, "o4.n.opposite"]], sounds: [[0, "auction_gavel"]] },
  { id: "title", duration: 9, captions: [[0, "o4.tagline1"], [4, "o4.tagline2"]], sounds: [[0, "auction_gavel"]] },
  { id: "handoff", duration: 2, captions: [] },
] as const satisfies readonly Scene[];

const temporalSounds: Record<string, Scene["sounds"]> = {
  sync: [[2, "temporal_sync_error"]], lockdown: [[1.4, "security_lock"], [2.8, "security_lock"], [4.2, "security_lock"], [5.6, "security_lock"]],
  archive: [[0, "archive_scan"], [7, "low_impact"]], dual: [[0, "crt_noise"], [5, "crt_noise"]], jump: [[1, "timeline_rewind"]],
  causal: [[1.3, "timeline_shift"], [4.9, "timeline_shift"], [8.5, "timeline_shift"]], records: [[0, "record_corruption"], [4.5, "record_corruption"]], title: [[0, "title_reveal"]],
};
export const OPENINGS: Record<ScenarioId, OpeningDefinition> = {
  S01_LAST_TRAIN: {
    variant: "train", scenes: train, introTheme: "intro_train", ambientTheme: "s01_ambient", label: "o1.aria", hint: "o1.hint",
    mix: (id) => ({ level: .65, theme: ["time", "phones", "arrival"].includes(id) ? "silence" : "intro_train" }),
  },
  S02_SUNKEN_CITY: {
    variant: "flood", scenes: flood, introTheme: "intro_flood", ambientTheme: "s02_city_ambient", label: "o2.aria", hint: "o2.hint",
    mix: (id) => ({ level: id === "title" ? .75 : id === "distress" ? .48 : .65, theme: ["water", "capacity", "route", "title"].includes(id) ? "s02_rising" : "intro_flood" }),
  },
  S03_INCIDENT_ZERO: {
    variant: "temporal", scenes: OPENING_SCENES.map((scene) => ({ ...scene, sounds: temporalSounds[scene.id] })), introTheme: "scenario03_intro", ambientTheme: "scenario03_2026_ambient", label: "s3.open.aria", hint: "s3.open.hint",
    mix: (id, elapsed) => ({ level: id === "records" ? (elapsed >= 9.5 ? 0 : .9) : id === "sync" ? .4 : .65, theme: ["mission", "title"].includes(id) ? "s03_resolution" : "scenario03_intro" }),
  },
  S04_UNDERGROUND_AUCTION: {
    variant: "auction", scenes: auction, introTheme: "intro_auction", ambientTheme: "s04_auction_ambient", label: "o4.aria", hint: "o4.hint",
    mix: (id, elapsed) => ({ level: id === "auctioneer" && elapsed < 1.2 ? 0 : .65, theme: id === "invitation" && elapsed < 3 ? "silence" : ["seats", "auctioneer", "title"].includes(id) ? "s04_auction_ambient" : "intro_auction" }),
  },
};
