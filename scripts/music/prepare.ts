// Rebuild the credited, normalized loop edits. No runtime/build dependency on ffmpeg.
// FFMPEG=/path/to/ffmpeg node scripts/music/prepare.ts [trackId ...]
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MUSIC_COMPOSER, MUSIC_LICENSE, MUSIC_TRACKS } from "../../src/client/audio/catalog.ts";

const cache = join(tmpdir(), "fate-music-masters");
const output = "public/audio/music";
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
const selected = process.argv.slice(2);
for (const id of selected) if (!(id in MUSIC_TRACKS)) throw new Error(`Unknown track: ${id}`);
const entries = Object.entries(MUSIC_TRACKS).filter(([id]) => !selected.length || selected.includes(id));
// Bound both downloads and encoders; this script never runs on the game server.
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < entries.length) {
    const [id, track] = entries[next++];
    const master = join(cache, `${id}.mp3`);
    if (!existsSync(master)) {
      await promisify(execFile)("curl", ["--fail", "--location", "--retry", "4", "--retry-all-errors", "--max-time", "180", "--silent", "--show-error", "--output", `${master}.part`, track.download]);
      const bytes = readFileSync(`${master}.part`);
      if (bytes.length < 50000 || bytes.subarray(0, 100).toString().includes("<html")) throw new Error(`${id}: not a recording`);
      renameSync(`${master}.part`, master);
    }
    const { start, duration: length, overlap: d } = track.edit;
    // Start at the body, then blend the tail into the head: loop boundary is
    // two adjacent source samples rather than a fade to silence or a hard cut.
    const end = Math.round(length * 44100), joinSamples = Math.round(d * 44100);
    const filter = `[0:a]aresample=44100,asetpts=PTS-STARTPTS,asplit=3[m][t][h];[m]atrim=start_sample=${joinSamples}:end_sample=${end - joinSamples},asetpts=PTS-STARTPTS[mid];[t]atrim=start_sample=${end - joinSamples}:end_sample=${end},asetpts=PTS-STARTPTS[tail];[h]atrim=end_sample=${joinSamples},asetpts=PTS-STARTPTS[head];[tail]afade=t=out:st=0:d=${d}:curve=qsin[fadeout];[head]afade=t=in:st=0:d=${d}:curve=qsin[fadein];[fadeout][fadein]amix=inputs=2:duration=shortest:normalize=0[seam];[mid][seam]concat=n=2:v=0:a=1,loudnorm=I=-18:TP=-2:LRA=9,aresample=44100[out]`;
    execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(start), "-t", String(length + 1), "-i", master, "-filter_complex", filter, "-map", "[out]", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "112k", "-map_metadata", "-1", "-metadata", `title=${track.title}`, "-metadata", `artist=${MUSIC_COMPOSER}`, "-metadata", `copyright=CC BY 4.0 ${MUSIC_LICENSE}`, join(output, `${id}.mp3`)], { stdio: "pipe" });
    console.log(`${id}: ${(length - d).toFixed(2)}s loop`);
  }
}));
const attribution = ["Fate Instance — Music credits", "", `${MUSIC_COMPOSER} (incompetech.com)`, "Licensed under Creative Commons: By Attribution 4.0", MUSIC_LICENSE, "", "Edits: excerpts, tail-to-head crossfades, loudness normalization and MP3 encoding.", "Recordings/compositions: Kevin MacLeod. Game integration and edits: this project.", "", ...Object.values(MUSIC_TRACKS).flatMap((track) => [track.title, `ISRC: ${track.isrc}`, track.source, `Asset: ${track.file}`, ""])].join("\n");
writeFileSync(join(output, "CREDITS.txt"), attribution);
const hashes = Object.fromEntries(Object.entries(MUSIC_TRACKS).filter(([id]) => existsSync(join(output, `${id}.mp3`))).map(([id]) => [id, createHash("sha256").update(readFileSync(join(output, `${id}.mp3`))).digest("hex")]));
writeFileSync(join(output, "SHA256.json"), `${JSON.stringify(hashes, null, 2)}\n`);
