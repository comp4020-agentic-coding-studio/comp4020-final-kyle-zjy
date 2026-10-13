// Validate mastered loops after rebuilding them; not part of the game runtime.
// FFMPEG=/path/to/ffmpeg node scripts/music/verify.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { MUSIC_TRACKS } from "../../src/client/audio/catalog.ts";

const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const hashes = JSON.parse(readFileSync("public/audio/music/SHA256.json", "utf8"));
const report: Record<string, unknown> = {};
for (const [id, track] of Object.entries(MUSIC_TRACKS)) {
  const file = `public${track.file}`;
  assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), hashes[id], `${id}: asset changed outside the mastering script`);
  const buffer = execFileSync(ffmpeg, ["-v", "error", "-i", file, "-f", "f32le", "-ac", "2", "-ar", "11025", "pipe:1"], { maxBuffer: 10 * 1024 * 1024 });
  const pcm = new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const rms = (a: number, b: number) => Math.sqrt(pcm.slice(a, b).reduce((sum, value) => sum + value * value, 0) / (b - a));
  const duration = pcm.length / 22050;
  const head = rms(0, 5512), tail = rms(pcm.length - 5512, pcm.length);
  const seam = Math.max(Math.abs(pcm[pcm.length - 2] - pcm[0]), Math.abs(pcm[pcm.length - 1] - pcm[1]));
  assert(Math.abs(duration - (track.edit.duration - track.edit.overlap)) < .1, `${id}: truncated recording`);
  assert(head > .001 && tail > .001, `${id}: silent loop boundary`);
  assert(seam < .15, `${id}: audible discontinuity at loop boundary (${seam})`);
  let peak = 0;
  for (const sample of pcm) { assert(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); }
  assert(peak < .99, `${id}: clipping`);
  report[id] = { seconds: Number(duration.toFixed(3)), headRms: Number(head.toFixed(4)), tailRms: Number(tail.toFixed(4)), seamDelta: Number(seam.toFixed(5)), peak: Number(peak.toFixed(4)) };
  console.log(`${id}: decoded, non-silent seam, no clipping (${duration.toFixed(1)}s)`);
}
writeFileSync("docs/music-validation.json", `${JSON.stringify(report, null, 2)}\n`);
