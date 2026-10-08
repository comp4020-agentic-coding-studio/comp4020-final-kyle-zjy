import { readdirSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { messageKeys } from "../scripts/i18n/message-keys.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { project } from "../src/server/engine/project.ts";
import { ROSTER, getCharacterById } from "../src/shared/characters/roster/index.ts";
import type { CharacterId } from "../src/shared/characters/types.ts";
import type { GameState } from "../src/shared/game/state.ts";
import { EN_CHARACTERS, EN_SCENARIO } from "../src/shared/i18n/en.ts";
import { format } from "../src/shared/i18n/format.ts";
import { list, m, ref } from "../src/shared/i18n/msg.ts";
import { isMsg, type Msg } from "../src/shared/i18n/types.ts";
import { ZH_CHARACTERS } from "../src/shared/i18n/zh-CN/characters/index.ts";
import { ZH_MESSAGES } from "../src/shared/i18n/zh-CN/messages.ts";
import { ZH_SCENARIO } from "../src/shared/i18n/zh-CN/scenario.ts";
import { EN_SCENARIO02 } from "../src/shared/i18n/scenario02.ts";
import { ZH_SCENARIO02 } from "../src/shared/i18n/zh-CN/scenario02.ts";
import { ZH_S02_SKILL_TEXT } from "../src/shared/i18n/zh-CN/skills02.ts";
import { S02_SKILL_TEXT } from "../src/shared/game/scenario02/skill-adapters.ts";
import type { RunInput } from "./bot.ts";
import type { ScenarioId } from "../src/shared/game/state.ts";

// English is canonical; zh-CN must cover all of it with the same placeholders,
// the locale is a per-browser choice locked for the run, and translated text
// never carries anything the projection would hide.

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
// a number may be a digit in one language and a word in the other ("one shield" / "1 层护盾")
const NUM: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", 一: "1", 两: "2", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6" };
const digits = (s: string) => new Set(s.match(/\d+/g) ?? []);
const numbers = (s: string) => new Set(s.replace(/\b(one|two|three|four|five|six)\b|[一两二三四五六]/gi, (w) => NUM[w.toLowerCase()]).match(/\d+/g) ?? []);
const HAN = /[一-鿿]/;

describe("the locale choice", () => {
  // the client module reads localStorage on import, so give it one first
  const store = new Map<string, string>();
  let i18n: typeof import("../src/client/i18n/index.ts");
  let useStore: typeof import("../src/client/store.ts").useStore;
  beforeAll(async () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    i18n = await import("../src/client/i18n/index.ts");
    useStore = (await import("../src/client/store.ts")).useStore;
  });
  const inRoom = (phase: string) => useStore.setState({ roomCode: "ABCDEF", snapshot: { room: { phase } } } as never);

  it("is English when nothing (or nonsense) is stored, or storage is blocked", () => {
    expect(i18n.readLocale({ getItem: () => null })).toBe("en");
    expect(i18n.readLocale({ getItem: () => "fr" })).toBe("en");
    expect(i18n.readLocale({ getItem: () => { throw new Error("blocked"); } })).toBe("en");
    expect(i18n.getLocale()).toBe("en");
  });

  it("can change in the lobby and survives a reload", () => {
    inRoom("LOBBY");
    expect(i18n.setLocale("zh-CN")).toBe(true);
    expect(i18n.getLocale()).toBe("zh-CN");
    expect(i18n.readLocale(localStorage)).toBe("zh-CN"); // what the next page load reads
  });

  it("is locked once the run departs, and free again back in the lobby", () => {
    for (const phase of ["INTRO", "PLAYING", "ENDING", "RESULTS"]) {
      inRoom(phase);
      expect(i18n.canChangeLocale(phase)).toBe(false);
      expect(i18n.setLocale("en")).toBe(false);
      expect(i18n.getLocale()).toBe("zh-CN");
    }
    inRoom("LOBBY");
    expect(i18n.setLocale("en")).toBe(true);
    expect(i18n.readLocale(localStorage)).toBe("en");
  });
});

describe("catalog coverage", () => {
  it("the UI catalogs have the same keys and placeholders in both directions", async () => {
    const { en } = await import("../src/client/i18n/en.ts");
    const { zhCN } = await import("../src/client/i18n/zh-CN.ts");
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(placeholders(zhCN[k]), k).toEqual(placeholders(en[k]));
    // scenario 02's own copy
    const { s2en } = await import("../src/client/i18n/s2-en.ts");
    const { s2zhCN } = await import("../src/client/i18n/s2-zh-CN.ts");
    expect(Object.keys(s2zhCN).sort()).toEqual(Object.keys(s2en).sort());
    for (const k of Object.keys(s2en) as (keyof typeof s2en)[]) {
      expect(placeholders(s2zhCN[k]), k).toEqual(placeholders(s2en[k]));
      // words in the English need words in the Chinese ("{name}: {progress} / {required}" has none)
      if (/[A-Za-z]{2}/.test(s2en[k].replace(/\{\w+\}/g, ""))) expect(s2zhCN[k], k).toMatch(HAN);
    }
  });

  it("every engine message template in src/ has a Chinese entry with the same placeholders, and none is stale", () => {
    const keys = messageKeys();
    for (const [k, where] of keys) {
      expect(ZH_MESSAGES[k], `${where}: ${k}`).toBeTruthy();
      expect(placeholders(ZH_MESSAGES[k]), k).toEqual(placeholders(k));
    }
    expect(Object.keys(ZH_MESSAGES).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("all 192 characters have a Chinese title, ability name and description, unique and with the same numbers", () => {
    expect(ROSTER).toHaveLength(192);
    for (const c of ROSTER) {
      const zh = ZH_CHARACTERS[c.id];
      expect(zh, c.id).toBeDefined();
      for (const f of ["title", "skillName", "skillDescription"] as const) expect(zh![f], `${c.id}.${f}`).toMatch(HAN);
      // amounts, rounds and thresholds carry over: the mechanic is the same
      const [zhText, enText] = [zh!.skillDescription, EN_CHARACTERS[c.id].skillDescription];
      for (const d of digits(zhText)) expect(numbers(enText).has(d), `${c.id}: ${d}`).toBe(true);
      for (const d of digits(enText)) expect(numbers(zhText).has(d), `${c.id}: ${d}`).toBe(true);
    }
    const all = Object.values(ZH_CHARACTERS);
    expect(new Set(all.map((x) => x!.title)).size).toBe(192);
    expect(new Set(all.map((x) => x!.skillName)).size).toBe(192);
  });

  it("every Scenario 01 content id has Chinese text", () => {
    const walk = (en: unknown, zh: unknown, path: string): void => {
      if (typeof en === "string") return void expect(typeof zh === "string" && (zh.length > 0 || en.length === 0), path).toBe(true);
      if (en == null || !Object.keys(en).length) return;
      expect(zh, path).toBeTypeOf("object");
      for (const k of Object.keys(en as object)) walk((en as Record<string, unknown>)[k], (zh as Record<string, unknown>)[k], `${path}.${k}`);
    };
    walk(EN_SCENARIO, ZH_SCENARIO, "scenario");
  });

  it("every Scenario 02 content id has Chinese text, and its re-worded abilities say the same in both", () => {
    const walk = (en: unknown, zh: unknown, path: string): void => {
      if (typeof en === "string") return void expect(typeof zh === "string" && HAN.test(zh), path).toBe(true);
      if (en == null || !Object.keys(en).length) return;
      expect(zh, path).toBeTypeOf("object");
      for (const k of Object.keys(en as object)) walk((en as Record<string, unknown>)[k], (zh as Record<string, unknown>)[k], `${path}.${k}`);
    };
    walk(EN_SCENARIO02, ZH_SCENARIO02, "scenario02");
    for (const [id, text] of Object.entries(S02_SKILL_TEXT)) {
      const zh = ZH_S02_SKILL_TEXT[id as keyof typeof ZH_S02_SKILL_TEXT]!;
      expect(zh.name, id).toMatch(HAN);
      for (const d of digits(zh.description)) expect(numbers(text!.description).has(d), `${id}: ${d}`).toBe(true);
      for (const d of digits(text!.description)) expect(numbers(zh.description).has(d), `${id}: ${d}`).toBe(true);
      expect(format("zh-CN", ref.skill(id as never, "S02_SUNKEN_CITY"))).toBe(zh.name);
    }
  });
});

describe("rendering", () => {
  it("fills parameters, content references and lists in both languages", async () => {
    const msg = m`${"Ann"} uses the ${ref.item("FLASHLIGHT")}.`;
    expect(format("en", msg)).toBe("Ann uses the Flashlight.");
    expect(format("zh-CN", msg)).toBe(`Ann 使用了${ZH_SCENARIO.items.FLASHLIGHT.name}。`);
    const offer = m`${"Ann"} and ${"Ben"} trade: ${list([ref.item("MEDKIT"), m`${2} Fate`])} for ${m`nothing`}.`;
    expect(format("en", offer)).toBe("Ann and Ben trade: Medkit, 2 Fate for nothing.");
    expect(format("zh-CN", offer)).toContain(`${ZH_SCENARIO.items.MEDKIT.name}、2 点命运`);
    const { t } = await import("../src/client/i18n/index.ts");
    expect(t("en", "gate.missing.body", { code: "QWERTY" })).toContain("QWERTY");
    expect(t("zh-CN", "gate.missing.body", { code: "QWERTY" })).toBe("房间 QWERTY 不存在或已关闭。");
  });

  // the kept simulations (docs/simulations) cover every act, ending and most effects
  const DIR = new URL("../docs/simulations/", import.meta.url);
  type Log = { scenario?: ScenarioId; seed: string; characters: CharacterId[]; inputs: RunInput[] };
  const runs = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const NAMES = "甲乙丙丁戊己庚辛壬癸";
  function* states(file: string): Generator<GameState> {
    const log = JSON.parse(readFileSync(new URL(file, DIR), "utf8")) as Log;
    const seats = log.characters.map((id, i) => ({ playerId: `p${i}`, nickname: NAMES[i], seat: i, zodiac: getCharacterById(id).zodiac, mbti: getCharacterById(id).mbti }));
    const t0 = 1_800_000_000_000;
    let s = startGame(createGame("run", seats, log.seed, t0, log.scenario), t0).state;
    yield s;
    for (const i of log.inputs) yield (s = i.kind === "TICK" ? tickGame(s, i.at).state : applyGameAction(s, i.actor!, i.action!, i.at).state);
  }
  const msgs = (v: unknown, out: Msg[] = []): Msg[] => {
    if (isMsg(v)) out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => msgs(x, out));
    else if (v && typeof v === "object") Object.values(v).forEach((x) => msgs(x, out));
    return out;
  };

  it.each(runs)("every message of a played run renders completely in both languages (%s)", (file) => {
    const broken = new Set<string>();
    for (const s of states(file))
      for (const msg of msgs(s)) {
        const [en, zh] = [format("en", msg), format("zh-CN", msg)];
        if (/\{\d+\}|\[object|undefined/.test(en + zh) || /[A-Za-z]{2}/.test(zh)) broken.add(`${msg.k} => ${zh}`);
      }
    expect([...broken]).toEqual([]);
  });

  it("references in what one player sees never name another player's obsession", () => {
    for (const s of states(runs[0])) {
      if (!s.phase.startsWith("ACT")) continue;
      for (const id of s.turnOrder) {
        const { mySecrets: _own, ...shared } = project(s, id);
        const leaked = msgs(shared).flatMap((x) => msgs(x.p ?? [])).concat(msgs(shared)).filter((x) => x.k === "@obsession");
        expect(leaked).toEqual([]);
      }
    }
  });
});
