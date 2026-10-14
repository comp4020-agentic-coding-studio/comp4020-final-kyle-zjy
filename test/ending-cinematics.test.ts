import { describe, expect, it } from "vitest";
import { ENDING_FILMS, ENDING_IDS, endingFacts, endingFor, endingKey, endingWatched, rememberEnding, reducedScenes } from "../src/client/game/ending/cinematics.ts";
import { MUSIC_CUES } from "../src/client/audio/catalog.ts";
import { CATALOGS } from "../src/client/i18n/index.ts";
import { CHECK_PRESETS, type CheckPresetId } from "../src/shared/developer.ts";
import { CHECK_SEED, prepareCheckpoint } from "../src/server/developer/fixtures.ts";
import { createGame } from "../src/server/engine/create.ts";
import { project } from "../src/server/engine/project.ts";
import { applyGameAction } from "../src/server/engine/engine.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { seatsFor, T0 } from "./helpers.ts";

const checkpoint = (id: CheckPresetId): GameState => prepareCheckpoint(createGame(`end-${id}`, seatsFor(3), CHECK_SEED, T0, CHECK_PRESETS.find((p) => p.id === id)!.scenarioId), id, T0);
const filmsFor = (s: GameState) => Object.fromEntries(s.turnOrder.map((id) => [id, endingFor(project(s, id))]));
const seconds = (id: (typeof ENDING_IDS)[number]) => ENDING_FILMS[id].scenes.reduce((n, s) => n + s.duration, 0);

describe("ending cinematics: which film a finished run shows", () => {
  it("maps the shared endings of scenarios 01 and 03, and gives the delete ending and failures none", () => {
    const at = (outcome: GameState["outcome"]) => endingFor({ outcome, viewerId: "a", results: null, auction: null });
    expect(at("NORMAL")).toBe("s01_normal_escape");
    expect(at("TRUE_TICKET")).toBe("s01_ticket_true_end");
    expect(at("TRUE_DELETE")).toBeNull();
    expect(at("FAILED")).toBeNull();
    expect(at("S03_OFFICIAL_HISTORY")).toBe("s03_official_history");
    expect(at("S03_NO_TOMORROW")).toBe("s03_no_tomorrow");
    expect(at("S03_DECEIVE_HISTORY")).toBe("s03_deceive_history");
    // the real ticket ending reached through play, the same film for every seat
    const ticket = checkpoint("s1.ending");
    expect(ticket.outcome).toBe("TRUE_TICKET");
    expect(new Set(Object.values(filmsFor(ticket)))).toEqual(new Set(["s01_ticket_true_end"]));
    const deceive = checkpoint("s3.deceive");
    expect(new Set(Object.values(filmsFor(deceive)))).toEqual(new Set(["s03_deceive_history"]));
  });

  it("splits scenario 02 by each player's own fate in the same run", () => {
    const s = checkpoint("s2.ending");
    expect(s.outcome).toBe("S02_EVACUATED");
    const films = filmsFor(s);
    const b = s.city!.boat;
    for (const id of s.turnOrder) expect(films[id]).toBe(b.aboard.includes(id) ? "s02_escaped" : b.engineer === id ? "s02_last_light" : "s02_left_behind");
    expect(new Set(Object.values(films)).size).toBeGreaterThan(1);
    expect(Object.values(films)).toContain("s02_last_light");
  });

  it("splits scenario 04 into the winner's exit (with or without debt) and everyone else's no exit", () => {
    // the same final round played to the end: seat a bids 1, the others 0; only a's debt differs
    const debt = checkpoint("s4.debt");
    const clean = checkpoint("s4.final-bid");
    let now = T0;
    for (const p of clean.turnOrder) Object.assign(clean, applyGameAction(clean, p, { type: "FINAL_BID", amount: p === "a" ? 1 : 0 }, ++now).state);
    for (const p of clean.turnOrder) Object.assign(clean, applyGameAction(clean, p, { type: "FINAL_CONTINUE" }, ++now).state);
    expect([debt.outcome, clean.outcome]).toEqual(["S04_DEBT", "S04_EXIT"]);
    for (const [s, winnerFilm] of [[debt, "s04_debt_follows"], [clean, "s04_normal_exit"]] as const) {
      const films = filmsFor(s);
      expect(films.a).toBe(winnerFilm);
      for (const id of s.turnOrder.filter((p) => p !== "a")) expect(films[id]).toBe("s04_no_exit");
    }
  });

  it("reads only what the viewer may see: another player's debt never reaches their film", () => {
    const s = checkpoint("s4.debt");
    const winner = s.auction!.final!.winnerId!;
    const other = s.turnOrder.find((id) => id !== winner)!;
    s.auction!.players[winner].debt = 9;
    s.auction!.players[other].debt = 2;
    expect(endingFacts(project(s, other)).debt).toBe(2);
    expect(endingFacts(project(s, winner)).debt).toBe(9);
  });
});

describe("ending cinematics: content", () => {
  it("every film runs 25–50 s (always under 60), ends on its card, and has real music and copy in both locales", () => {
    for (const id of ENDING_IDS) {
      const film = ENDING_FILMS[id];
      expect(seconds(id), id).toBeGreaterThanOrEqual(25);
      expect(seconds(id), id).toBeLessThanOrEqual(50);
      expect(film.scenes.at(-1)!.id).toBe("card");
      expect(new Set(film.scenes.map((s) => s.id)).size, `${id} scene ids`).toBe(film.scenes.length);
      expect(film.scenes.some((s) => s.theme !== "silence"), `${id} has a score`).toBe(true);
      for (const scene of film.scenes) if (scene.theme !== "silence") expect(MUSIC_CUES[scene.theme], `${id}/${scene.id}`).toBeTruthy();
      const keys = [film.label, film.card.kicker, film.card.title, ...film.card.lines, ...(film.card.tag ? [film.card.tag] : []), ...film.scenes.flatMap((s) => s.captions.map(([, k]) => k))];
      for (const key of keys) for (const locale of ["en", "zh-CN"] as const) expect(CATALOGS[locale][key], `${locale} ${key}`).toBeTruthy();
      // reduced motion keeps every scene and the card's full time, just shorter stills
      const still = reducedScenes(film.scenes);
      expect(still.map((s) => s.id)).toEqual(film.scenes.map((s) => s.id));
      expect(still.at(-1)!.duration).toBe(film.scenes.at(-1)!.duration);
    }
  });

  it("the no-exit ending lets the auction motif stop, then start again after the gavel", () => {
    const scenes = ENDING_FILMS.s04_no_exit.scenes;
    const gavel = scenes.findIndex((s) => s.sounds?.some(([, cue]) => cue === "auction_gavel") && s.theme === "silence");
    expect(gavel).toBeGreaterThan(0);
    expect(scenes[gavel - 1].theme).toBe("silence");
    expect(scenes[gavel + 1].theme).toBe("s04_auction_ambient");
  });
});

describe("ending cinematics: once per run", () => {
  it("remembers a watched film for this run and viewer only", () => {
    const run = { sessionId: "run-1", viewerId: "p1" };
    const key = endingKey(run, "s02_last_light");
    expect(endingWatched(key)).toBe(false);
    rememberEnding(key);
    expect(endingWatched(key)).toBe(true);
    expect(endingWatched(endingKey({ ...run, sessionId: "run-2" }, "s02_last_light"))).toBe(false);
    expect(endingWatched(endingKey({ ...run, viewerId: "p2" }, "s02_last_light"))).toBe(false);
  });
});
