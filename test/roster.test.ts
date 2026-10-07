import { describe, expect, it } from "vitest";
import { getCharacter, getCharacterById, ROSTER, ROSTER_BY_ZODIAC } from "../src/shared/characters/roster/index.ts";
import { characterId, MBTIS, ZODIACS, type CharacterId } from "../src/shared/characters/types.ts";
import { validateCharacter } from "../src/shared/characters/validate.ts";

// The roster contract: 12 signs × 16 types = 192 characters, each pair exactly
// once, every one with well-formed English data and a usable skill definition.
describe("roster", () => {
  it("has exactly 12 × 16 = 192 characters", () => {
    expect(ZODIACS).toHaveLength(12);
    expect(MBTIS).toHaveLength(16);
    expect(ROSTER).toHaveLength(192);
  });

  it("lists all 16 types once per sign, in the canonical order", () => {
    for (const z of ZODIACS) {
      expect(ROSTER_BY_ZODIAC[z].map((e) => e.mbti), z).toEqual([...MBTIS]);
    }
  });

  it("has every (zodiac, MBTI) pair exactly once: no duplicates, none missing", () => {
    const seen = new Map<string, number>();
    for (const c of ROSTER) seen.set(`${c.zodiac}/${c.mbti}`, (seen.get(`${c.zodiac}/${c.mbti}`) ?? 0) + 1);
    const missing: string[] = [];
    for (const z of ZODIACS) for (const m of MBTIS) if (seen.get(`${z}/${m}`) !== 1) missing.push(`${z}/${m}`);
    expect(missing).toEqual([]);
  });

  it("has unique ids that match the sign and type", () => {
    expect(new Set(ROSTER.map((c) => c.id)).size).toBe(192);
    for (const c of ROSTER) expect(c.id).toBe(characterId(c.zodiac, c.mbti));
  });

  it("matches every sign + type to the right character", () => {
    for (const z of ZODIACS) {
      for (const m of MBTIS) {
        const c = getCharacter(z, m);
        expect([c.zodiac, c.mbti]).toEqual([z, m]);
      }
    }
    expect(() => getCharacterById("ophiuchus-intj" as CharacterId)).toThrow();
  });

  it("gives every character a distinct title", () => {
    const titles = ROSTER.map((c) => c.nickname.toLowerCase());
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  it("gives every skill a distinct name, so the log is never ambiguous", () => {
    const names = ROSTER.map((c) => c.skill.name.toLowerCase());
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it("points every avatar at /avatars/<id>.svg", () => {
    for (const c of ROSTER) expect(c.avatar).toBe(`/avatars/${c.id}.svg`);
  });

  it("passes the static skill checks for all 192", () => {
    expect(ROSTER.flatMap(validateCharacter)).toEqual([]);
  });

  it("uses all three skill types", () => {
    const types = new Set(ROSTER.map((c) => c.skill.type));
    expect([...types].sort()).toEqual(["ACTIVE", "PASSIVE", "REACTION"]);
  });

  it("keeps the brief's example: Scorpio + ENTP is the Venom-Tongued Schemer with Backbite", () => {
    const c = getCharacter("scorpio", "ENTP");
    expect(c.nickname).toBe("The Venom-Tongued Schemer");
    expect(c.skill.name).toBe("Backbite");
    expect(c.skill.type).toBe("REACTION");
  });
});
