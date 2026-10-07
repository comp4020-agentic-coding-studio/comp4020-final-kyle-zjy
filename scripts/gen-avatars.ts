// Writes the 192 portraits to public/avatars/<zodiac>-<mbti>.svg, and (with
// --sheet <file>) an HTML contact sheet of all of them for review.
//
//   node scripts/gen-avatars.ts [--sheet /tmp/avatars.html]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ZODIAC_INFO } from "../src/shared/characters/signs.ts";
import { characterId, MBTIS, ZODIACS } from "../src/shared/characters/types.ts";
import { portrait } from "./avatars/portrait.ts";

const outDir = resolve(import.meta.dirname, "../public/avatars");
mkdirSync(outDir, { recursive: true });

let bytes = 0;
for (const z of ZODIACS) {
  for (const m of MBTIS) {
    const { svg } = portrait(z, m);
    writeFileSync(join(outDir, `${characterId(z, m)}.svg`), svg);
    bytes += svg.length;
  }
}
console.log(`wrote ${ZODIACS.length * MBTIS.length} portraits to ${outDir} (${Math.round(bytes / 1024)} KB)`);

const sheetAt = process.argv.indexOf("--sheet");
if (sheetAt > 0) {
  const file = process.argv[sheetAt + 1];
  const rows = ZODIACS.map(
    (z) =>
      `<h2>${ZODIAC_INFO[z].name}</h2><div class="row">${MBTIS.map(
        (m) => `<figure><img src="file://${outDir}/${characterId(z, m)}.svg"><figcaption>${m}</figcaption></figure>`,
      ).join("")}</div>`,
  ).join("");
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><style>body{background:#05060d;color:#ccc;font:12px sans-serif;margin:12px}h2{margin:10px 0 4px;font-size:14px}.row{display:grid;grid-template-columns:repeat(16,1fr);gap:6px}figure{margin:0;text-align:center}img{width:100%;border-radius:50%;display:block}</style>${rows}`,
  );
  console.log(`contact sheet: ${file}`);
}
