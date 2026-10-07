import { expect, inject, it } from "vitest";
import { ROSTER } from "../src/shared/characters/roster/index.ts";

// The deployed app serves a portrait for every one of the 192 characters.
const baseUrl = inject("baseUrl");

it("serves all 192 character portraits as SVG", async () => {
  const missing: string[] = [];
  await Promise.all(
    ROSTER.map(async (c) => {
      const res = await fetch(new URL(c.avatar, baseUrl));
      const type = res.headers.get("content-type") ?? "";
      if (res.status !== 200 || !type.includes("image/svg+xml")) missing.push(`${c.avatar} → ${res.status} ${type}`);
      await res.arrayBuffer();
    }),
  );
  expect(missing).toEqual([]);
});
