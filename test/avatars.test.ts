import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { portrait, type Features } from "../scripts/avatars/portrait.ts";
import { ROSTER } from "../src/shared/characters/roster/index.ts";

// 192 characters ↔ 192 portrait files, each its own person: no shared image,
// at least three visible features different from every other portrait.
const dir = join(import.meta.dirname, "../public/avatars");
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".svg")) : [];
const read = (f: string) => readFileSync(join(dir, f), "utf8");
const featuresOf = (svg: string): Features => JSON.parse(svg.match(/<metadata>(.*?)<\/metadata>/)![1]).features;

describe("avatars", () => {
  it("has exactly one file per character: 192 characters = 192 avatar files", () => {
    expect(files).toHaveLength(192);
    expect(files.sort()).toEqual(ROSTER.map((c) => c.avatar.replace("/avatars/", "")).sort());
  });

  it("files are up to date with the generator (run `pnpm avatars` after changing it)", () => {
    const stale = ROSTER.filter((c) => read(`${c.id}.svg`) !== portrait(c.zodiac, c.mbti).svg).map((c) => c.id);
    expect(stale).toEqual([]);
  });

  it("no two characters share an image", () => {
    const hashes = files.map((f) => createHash("sha256").update(read(f)).digest("hex"));
    expect(new Set(hashes).size).toBe(192);
  });

  it("every pair of portraits differs in at least 3 visible features", () => {
    const all = files.map((f) => ({ f, feat: featuresOf(read(f)) }));
    let closest = Infinity;
    const tooClose: string[] = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const keys = Object.keys(all[i].feat) as (keyof Features)[];
        const diff = keys.filter((k) => all[i].feat[k] !== all[j].feat[k]).length;
        closest = Math.min(closest, diff);
        if (diff < 3) tooClose.push(`${all[i].f} ~ ${all[j].f} (${diff})`);
      }
    }
    expect(tooClose).toEqual([]);
    expect(closest).toBeGreaterThanOrEqual(3);
  });

  it("each file is a small, self-contained SVG (no scripts, no external requests)", () => {
    for (const f of files) {
      const svg = read(f);
      expect(svg.startsWith("<svg "), f).toBe(true);
      expect(svg).toContain('viewBox="0 0 200 200"');
      expect(svg).not.toMatch(/<script|<image|<foreignObject|href="http|url\(http|var\(--/i);
      expect(svg.length, f).toBeLessThan(16 * 1024);
    }
  });
});
