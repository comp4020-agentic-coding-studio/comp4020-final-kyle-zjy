// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { TrainOpening } from "../src/client/game/opening/TrainOpening.tsx";
import { FloodOpening } from "../src/client/game/opening/FloodOpening.tsx";
import { AuctionOpening } from "../src/client/game/opening/AuctionOpening.tsx";
import { OPENINGS } from "../src/client/game/opening/definitions.ts";
import { durationOf } from "../src/client/game/opening/timeline.ts";
import { openingKey, openingSeen } from "../src/client/game/opening/memory.ts";
import { openingEn } from "../src/client/i18n/opening-en.ts";
import { openingZhCN } from "../src/client/i18n/opening-zh-CN.ts";
import { t } from "../src/client/i18n/index.ts";
import { createGame } from "../src/server/engine/create.ts";
import { seatsFor, SEED, T0 } from "./helpers.ts";

const reading = vi.hoisted(() => ({ locale: "en" as "en" | "zh-CN" }));
// Server rendering intentionally reads Zustand's initial snapshot. Supply an
// explicit locale for these content audits; real switching runs in browsers.
vi.mock("../src/client/i18n/index.ts", async (original) => {
  const actual = await original<typeof import("../src/client/i18n/index.ts")>();
  const { scenario02Text } = await import("../src/shared/i18n/scenario02.ts");
  return { ...actual, useLocale: () => reading.locale, useT: () => (key: Parameters<typeof actual.t>[1], params?: Parameters<typeof actual.t>[2]) => actual.t(reading.locale, key, params), useScenario02Text: () => scenario02Text(reading.locale) };
});

function text(markup: string) { const host = document.createElement("div"); host.innerHTML = markup; return host.textContent ?? ""; }

it("keeps all opening copy bilingual with matching placeholders and valid subtitle references", () => {
  expect(Object.keys(openingZhCN).sort()).toEqual(Object.keys(openingEn).sort());
  for (const key of Object.keys(openingEn) as (keyof typeof openingEn)[]) expect(openingZhCN[key].match(/\{\w+\}/g) ?? []).toEqual(openingEn[key].match(/\{\w+\}/g) ?? []);
  for (const definition of Object.values(OPENINGS)) for (const scene of definition.scenes) for (const [, key] of scene.captions) {
    expect(t("en", key)).not.toBe(key);
    expect(t("zh-CN", key)).not.toBe(key);
  }
});

it("uses quiet train opening beats and suggests memory errors without revealing the late story", () => {
  reading.locale = "en";
  const definition = OPENINGS.S01_LAST_TRAIN;
  expect(durationOf(definition.scenes)).toBeGreaterThanOrEqual(55);
  expect(durationOf(definition.scenes)).toBeLessThanOrEqual(70);
  expect(definition.mix("time", 0).theme).toBe("silence");
  expect(definition.mix("arrival", 6).theme).toBe("silence");
  expect(definition.mix("tickets", 4).theme).toBe("intro_train");
  const rendered = definition.scenes.map((scene) => text(renderToStaticMarkup(createElement(TrainOpening, { id: scene.id, elapsed: scene.duration - .1 })))).join(" ");
  expect(rendered).toContain("Prove you exist");
  expect(rendered).toContain("MEMORY FRAGMENT");
  expect(rendered).not.toMatch(/Nameless Passenger|six core memories|round 7|true ending|forgotten player/i);
});

it("leaves boat capacity and contribution ranking unknown in both locales", () => {
  for (const locale of ["en", "zh-CN"] as const) {
    reading.locale = locale;
    const rendered = OPENINGS.S02_SUNKEN_CITY.scenes.map((scene) => text(renderToStaticMarkup(createElement(FloodOpening, { id: scene.id, elapsed: scene.duration - .1 })))).join(" ");
    expect(rendered).toContain(t(locale, "o2.pending"));
    expect(rendered).not.toMatch(/(?:capacity|seats?|船位|容量)\s*[:：=]?\s*\d|contribution|ranking|排名|贡献|船位少于/i);
  }
});

it("shows the actual opening chip allocation and Exit Rights, with names but no lot mechanics or authenticity", () => {
  reading.locale = "en";
  const s = createGame("opening-start-chips", seatsFor(2), SEED, T0, "S04_UNDERGROUND_AUCTION");
  const amount = s.auction!.players.a.blackChips;
  expect(amount).toBe(8);
  const chips = text(renderToStaticMarkup(createElement(AuctionOpening, { id: "chips", elapsed: 6, names: [] })));
  expect(chips).toContain(`${amount} BLACK CHIPS`);
  const rendered = OPENINGS.S04_UNDERGROUND_AUCTION.scenes.map((scene) => text(renderToStaticMarkup(createElement(AuctionOpening, { id: scene.id, elapsed: scene.duration - .1, names: ["A", "B"] })))).join(" ");
  expect(rendered).toContain("LOT 10");
  expect(rendered).toContain("Exit Rights");
  expect(rendered).toContain("The Black Die");
  expect(rendered).not.toMatch(/counterfeit|sealed bid|Final Chips|effective bid|sanity at|Perfect|2 starting AP|blind card/i);
});

it("honors the previously shipped Scenario 03 storage marker", () => {
  localStorage.setItem("fate:s03:openings", JSON.stringify([JSON.stringify(["legacy-session", "legacy-player"])]));
  expect(openingSeen(openingKey({ scenarioId: "S03_INCIDENT_ZERO", sessionId: "legacy-session", viewerId: "legacy-player" }))).toBe(true);
  expect(openingSeen(openingKey({ scenarioId: "S01_LAST_TRAIN", sessionId: "legacy-session", viewerId: "legacy-player" }))).toBe(false);
});
