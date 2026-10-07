import { describe, expect, it } from "vitest";
import type { JoinResponse } from "../src/shared/protocol.ts";
import { MAX_PLAYERS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../src/shared/protocol.ts";

// Promises the lobby makes, checked against the running app over HTTP and
// WebSocket: real rooms, a 10-seat cap, one seat per person however often they
// join or refresh, and changes pushed to everyone within a second.
import { connect, create, join, post, welcome, baseUrl, PUSH_MS } from "./client.ts";

describe("rooms over HTTP", () => {
  it("creates a room with a 6-character code and seats the creator as host", async () => {
    const host = await create("Host");
    expect(host.roomCode).toHaveLength(ROOM_CODE_LENGTH);
    expect([...host.roomCode].every((ch) => ROOM_CODE_ALPHABET.includes(ch))).toBe(true);
    const c = await connect(host.roomCode, host.sessionToken);
    const { snapshot, playerId } = await welcome(c);
    expect(playerId).toBe(host.playerId);
    expect(snapshot.room.members).toHaveLength(1);
    expect(snapshot.room.members[0]).toMatchObject({ seat: 0, isHost: true, nickname: "Host", connected: true });
    c.ws.close();
  });

  it("accepts lower-case codes and rejects unknown rooms and empty nicknames", async () => {
    const host = await create("Host");
    expect((await join(host.roomCode.toLowerCase(), "Guest")).status).toBe(200);
    expect((await join("ZZZZZZ", "Guest")).status).toBe(404);
    expect((await join(host.roomCode, "   ")).status).toBe(400);
    expect((await post("/api/rooms", { nickname: "x".repeat(17) })).status).toBe(400);
  });

  it(`caps a room at ${MAX_PLAYERS} players`, async () => {
    const host = await create("P0");
    for (let i = 1; i < MAX_PLAYERS; i++) expect((await join(host.roomCode, `P${i}`)).status).toBe(200);
    const extra = await join(host.roomCode, "Eleven");
    expect(extra.status).toBe(409);
    expect(extra.json.code).toBe("ROOM_FULL");
  });

  it("joining again with the same session returns the same seat, not a second player", async () => {
    const host = await create("Host");
    const first = (await join(host.roomCode, "Guest")).json as JoinResponse;
    const again = (await join(host.roomCode, "Guest again", first.sessionToken)).json as JoinResponse;
    expect(again.playerId).toBe(first.playerId);
    const info = await (await fetch(new URL(`/api/rooms/${host.roomCode}`, baseUrl))).json();
    expect(info.players).toBe(2);
  });

  it("rejects duplicate nicknames in one room, case-insensitively", async () => {
    const host = await create("Moon");
    const dup = await join(host.roomCode, "moon");
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe("NICKNAME_TAKEN");
  });
});

describe("realtime lobby", () => {
  it(`pushes a new player to everyone already in the room within ${PUSH_MS}ms`, async () => {
    const host = await create("Host");
    const a = await connect(host.roomCode, host.sessionToken);
    await welcome(a);
    await join(host.roomCode, "Guest");
    const s = await a.snapshot((s) => s.room.members.length === 2);
    expect(s.room.members.map((m) => m.nickname)).toEqual(["Host", "Guest"]);
    a.ws.close();
  });

  it("refresh: reconnecting with the stored session resumes the same seat", async () => {
    const host = await create("Host");
    const guest = (await join(host.roomCode, "Guest")).json as JoinResponse;
    const a = await connect(host.roomCode, host.sessionToken);
    await welcome(a);
    let b = await connect(host.roomCode, guest.sessionToken);
    await welcome(b);
    await a.snapshot((s) => s.room.members.every((m) => m.connected));

    b.ws.close();
    await a.snapshot((s) => s.room.members.find((m) => m.playerId === guest.playerId)?.connected === false);

    b = await connect(host.roomCode, guest.sessionToken);
    const back = await welcome(b);
    expect(back.playerId).toBe(guest.playerId);
    expect(back.snapshot.room.members).toHaveLength(2);
    expect(back.snapshot.room.members.find((m) => m.playerId === guest.playerId)?.seat).toBe(1);
    a.ws.close();
    b.ws.close();
  });

  it("a second tab with the same session takes over the seat", async () => {
    const host = await create("Host");
    const first = await connect(host.roomCode, host.sessionToken);
    await welcome(first);
    const second = await connect(host.roomCode, host.sessionToken);
    await welcome(second);
    await first.next((m) => m.t === "SESSION_REPLACED");
    expect(await first.closed).toBe(4001);
    const s = await second.snapshot(() => true);
    expect(s.room.members).toHaveLength(1);
    second.ws.close();
  });

  it("refuses a socket whose token isn't seated in the room", async () => {
    const host = await create("Host");
    const other = await create("Elsewhere");
    const c = await connect(host.roomCode, other.sessionToken);
    expect((await c.next((m) => m.t === "REJECTED")).t).toBe("REJECTED");
    expect(await c.closed).toBe(4003);
  });

  it("picks a character, readies up, and only the host can start once everyone is ready", async () => {
    const host = await create("Host");
    const guest = (await join(host.roomCode, "Guest")).json as JoinResponse;
    const a = await connect(host.roomCode, host.sessionToken);
    const b = await connect(host.roomCode, guest.sessionToken);
    await Promise.all([welcome(a), welcome(b)]);

    expect(await b.act({ type: "PICK_MBTI", mbti: "ENTP" })).toMatchObject({ t: "REJECTED", code: "INVALID" });
    expect(await b.act({ type: "SET_READY", ready: true })).toMatchObject({ t: "REJECTED" });
    expect(await b.act({ type: "PICK_ZODIAC", zodiac: "scorpio" })).toMatchObject({ t: "ACK" });
    expect(await b.act({ type: "PICK_MBTI", mbti: "ENTP" })).toMatchObject({ t: "ACK" });
    expect(await b.act({ type: "SET_READY", ready: true })).toMatchObject({ t: "ACK" });
    await a.snapshot((s) => s.room.members[1]?.stage === "READY" && s.room.members[1]?.zodiac === "scorpio");

    expect(await a.act({ type: "START_GAME" })).toMatchObject({ t: "REJECTED", code: "NOT_ALL_READY" });
    expect(await b.act({ type: "START_GAME" })).toMatchObject({ t: "REJECTED", code: "NOT_HOST" });

    await a.act({ type: "PICK_ZODIAC", zodiac: "pisces" });
    await a.act({ type: "PICK_MBTI", mbti: "INFJ" });
    await a.act({ type: "SET_READY", ready: true });
    expect(await a.act({ type: "START_GAME" })).toMatchObject({ t: "ACK" });
    await b.snapshot((s) => s.room.phase === "INTRO");

    const late = await join(host.roomCode, "Late");
    expect(late.json.code).toBe("GAME_IN_PROGRESS");
    a.ws.close();
    b.ws.close();
  });

  it("the host can start only with at least 2 players", async () => {
    const host = await create("Solo");
    const a = await connect(host.roomCode, host.sessionToken);
    await welcome(a);
    await a.act({ type: "PICK_ZODIAC", zodiac: "leo" });
    await a.act({ type: "PICK_MBTI", mbti: "ESFP" });
    await a.act({ type: "SET_READY", ready: true });
    expect(await a.act({ type: "START_GAME" })).toMatchObject({ t: "REJECTED", code: "NOT_ENOUGH_PLAYERS" });
    a.ws.close();
  });

  it("the host can kick in the lobby, and the kicked session can't rejoin", async () => {
    const host = await create("Host");
    const guest = (await join(host.roomCode, "Guest")).json as JoinResponse;
    const a = await connect(host.roomCode, host.sessionToken);
    const b = await connect(host.roomCode, guest.sessionToken);
    await Promise.all([welcome(a), welcome(b)]);
    expect(await a.act({ type: "KICK", playerId: guest.playerId })).toMatchObject({ t: "ACK" });
    await b.next((m) => m.t === "KICKED");
    expect(await b.closed).toBe(4002);
    await a.snapshot((s) => s.room.members.length === 1);
    expect((await join(host.roomCode, "Guest", guest.sessionToken)).status).toBe(403);
    a.ws.close();
  });

  it("when the host leaves, the next seat becomes host", async () => {
    const host = await create("Host");
    const g1 = (await join(host.roomCode, "First")).json as JoinResponse;
    const a = await connect(host.roomCode, host.sessionToken);
    const b = await connect(host.roomCode, g1.sessionToken);
    await Promise.all([welcome(a), welcome(b)]);
    expect(await a.act({ type: "LEAVE" })).toMatchObject({ t: "ACK" });
    const s = await b.snapshot((s) => s.room.members.length === 1);
    expect(s.room.members[0]).toMatchObject({ playerId: g1.playerId, isHost: true });
    b.ws.close();
  });
});
