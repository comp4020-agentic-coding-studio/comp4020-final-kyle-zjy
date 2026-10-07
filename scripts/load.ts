// Load check against a running app: many full rooms at once, to see the one
// 256 MB machine copes. Every room fills to 10, starts, boards, and plays one
// full round of turns (and its event) with every socket receiving every push.
//
//   node scripts/load.ts [--rooms 10] [--pid <server pid>]
//
// Prints the server's resident memory before and after (read from /proc when
// a pid is given) and how long the rounds took.
import { readFileSync } from "node:fs";
import WebSocket from "ws";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = process.env.APP_URL ?? "http://localhost:8080";
const ROOMS = Number(arg("rooms", "10"));
const pid = arg("pid", "");
const rss = () => (pid ? Number(readFileSync(`/proc/${pid}/status`, "utf8").match(/VmRSS:\s+(\d+)/)![1]) / 1024 : NaN);

type Msg = { t: string; actionId?: string; snapshot?: { game?: Game | null } };
type Game = { phase: string; round: number; step: string; turnOrder: string[]; activeIndex: number; sequence: { acks: string[] } | null; pending: { id: string; addressees: string[]; answeredBy: string[]; defaultOptionId: string }[] };

async function post(path: string, body: unknown) {
  const res = await fetch(new URL(path, base), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as { roomCode: string; playerId: string; sessionToken: string };
}

/** A player socket that keeps the latest game view and can send intents. */
function player(code: string, token: string) {
  const ws = new WebSocket(new URL("/ws", base.replace(/^http/, "ws")));
  let game: Game | null = null;
  let seq = 0;
  const waiting = new Map<string, () => void>();
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw)) as Msg;
    if (m.snapshot) game = m.snapshot.game ?? null;
    if ((m.t === "ACK" || m.t === "REJECTED") && m.actionId) waiting.get(m.actionId)?.();
  });
  const ready = new Promise<void>((r) => ws.on("open", () => (ws.send(JSON.stringify({ t: "HELLO", roomCode: code, sessionToken: token })), r())));
  const send = (t: string, action: unknown, version = true) =>
    new Promise<void>((r) => {
      const actionId = `l${++seq}`;
      waiting.set(actionId, r);
      ws.send(JSON.stringify({ t, actionId, stateVersion: version ? ((game as unknown as { version?: number })?.version ?? 0) : undefined, action }));
    });
  return { ws, ready, view: () => game, lobby: (a: unknown) => send("LOBBY_ACTION", a, false), play: (a: unknown) => send("GAME_ACTION", a) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SIGNS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn"];

async function room(i: number) {
  const host = await post("/api/rooms", { nickname: `H${i}` });
  const joins = [host];
  for (let k = 1; k < 10; k++) joins.push(await post(`/api/rooms/${host.roomCode}/join`, { nickname: `P${k}` }));
  const ps = joins.map((j) => ({ id: j.playerId, ...player(host.roomCode, j.sessionToken) }));
  await Promise.all(ps.map((p) => p.ready));
  await sleep(200);
  for (const [k, p] of ps.entries()) {
    await p.lobby({ type: "PICK_ZODIAC", zodiac: SIGNS[k] });
    await p.lobby({ type: "PICK_MBTI", mbti: "ENFP" });
    await p.lobby({ type: "SET_READY", ready: true });
  }
  await ps[0].lobby({ type: "START_GAME" });
  await sleep(300);
  await Promise.all(ps.map((p) => p.play({ type: "ACK_SEQUENCE" })));
  // one full round: turns in order, then whatever the event asks, until round 2
  for (let guard = 0; guard < 400; guard++) {
    const g = ps[0].view();
    if (!g || (g.round >= 2 && g.step === "PLAYER_TURNS")) break;
    const w = g.pending.at(-1);
    if (w) await Promise.all(ps.filter((p) => w.addressees.includes(p.id) && !w.answeredBy.includes(p.id)).map((p) => p.play({ type: "RESPOND", windowId: w.id, optionId: w.defaultOptionId })));
    else if (g.sequence) await Promise.all(ps.filter((p) => !g.sequence!.acks.includes(p.id)).map((p) => p.play({ type: "ACK_SEQUENCE" })));
    else if (g.step === "PLAYER_TURNS") await ps.find((p) => p.id === g.turnOrder[g.activeIndex])?.play({ type: "END_TURN" });
    else await sleep(50);
    await sleep(20);
  }
  return ps;
}

const before = rss();
const t0 = Date.now();
const all = await Promise.all(Array.from({ length: ROOMS }, (_, i) => room(i)));
const took = Date.now() - t0;
const reached = all.filter((ps) => (ps[0].view()?.round ?? 0) >= 2).length;
await sleep(500);
const after = rss();
console.log(`${ROOMS} rooms × 10 players: ${reached}/${ROOMS} reached round 2 in ${(took / 1000).toFixed(1)} s; server RSS ${before.toFixed(0)} MB → ${after.toFixed(0)} MB`);
for (const ps of all) for (const p of ps) p.ws.close();
process.exit(reached === ROOMS ? 0 : 1);
