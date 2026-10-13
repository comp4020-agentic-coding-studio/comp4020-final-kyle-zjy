// Checkpoints are prepared on the server. Existing handlers construct actions,
// pending decisions, rolls and endings. Placement/resources are explicit fixtures.
import type { CheckPresetId } from "../../shared/developer.ts";
import type { GameState, AnchorId } from "../../shared/game/state.ts";
import type { GameAction } from "../../shared/game/actions.ts";
import { KEY_FOR_ANCHOR, LOCK_AT } from "../../shared/game/scenario01/content.ts";
import { lotForAuctionRound04 } from "../../shared/game/scenario04/lots.ts";
import { zoneIndex } from "../../shared/game/scenario02/map.ts";
import { placeKey03, type RoomId03, type Year03 } from "../../shared/game/scenario03/map.ts";
import { NODES03, type CausalNodeId03 } from "../../shared/game/scenario03/nodes.ts";
import type { EndingRoute03 } from "../../shared/game/scenario03/story.ts";
import { repairTarget } from "../engine/outcomes.ts";
import { activePlayerId } from "../engine/context.ts";
import { applyGameAction, hostSkip, startGame, tickGame } from "../engine/engine.ts";
import { changeCollapse } from "../engine/effects.ts";
import { checkReveal, departureStep, startCountdown } from "../engine/scenario02/boat.ts";
import { rigNextDie, successfulAction03 } from "../testing/steps.ts";
import { m } from "../../shared/i18n/msg.ts";

export const CHECK_SEED = "0123456789abcdef0123456789abcdef";

class Checkpoint {
  state: GameState;
  now: number;
  constructor(state: GameState, now: number) {
    this.now = now;
    this.state = startGame(state, now).state;
    for (const id of this.state.turnOrder) this.act(id, { type: "ACK_SEQUENCE" });
  }
  get active() { return activePlayerId(this.state)!; }
  act(id: string, action: GameAction) { this.state = applyGameAction(this.state, id, action, ++this.now).state; }
  defaults() {
    const s = this.state, w = s.pending.at(-1);
    if (w) {
      const id = w.addressees.find((id) => w.answers[id] === undefined)!;
      const optionId = w.options.find((o) => ["CONTAIN", "SEAL", "SKIP"].includes(o.id))?.id ?? w.defaultOptionId;
      this.act(id, { type: "RESPOND", windowId: w.id, optionId });
    } else if (s.sequence) this.state = hostSkip(s, ++this.now).state;
    else if (s.auction?.auctionOpen && s.round < 10) this.state = hostSkip(s, ++this.now).state;
    else if (this.active) this.act(this.active, { type: "END_TURN" });
    else this.state = tickGame(s, ++this.now).state;
  }
  until(done: (s: GameState) => boolean) {
    for (let i = 0; !done(this.state) && i < 800; i++) {
      if (this.state.outcome) throw new Error("Checkpoint ended before its target");
      // Fixture-only resource preparation keeps an unrelated random disaster
      // from preventing a later checkpoint. Gameplay after launch uses normal rules.
      if (this.state.scenarioId !== "S04_UNDERGROUND_AUCTION") {
        this.state.collapse = Math.min(this.state.collapse, 3);
        for (const p of Object.values(this.state.players)) { p.sanity = 5; p.lost = false; p.fate = 8; p.shields = 2; }
      }
      this.defaults();
    }
    if (!done(this.state)) throw new Error("Checkpoint target was not reached");
  }
  round(n: number) { this.until((s) => s.round >= n && !s.pending.length && !s.sequence); }
  settle() { for (let i = 0; this.state.pending.length && i < 100; i++) this.defaults(); if (this.state.pending.length) throw new Error("Unsettled fixture action"); }
  ready(id = this.active) {
    const s = this.state;
    s.activeIndex = s.turnOrder.indexOf(id);
    s.step = "PLAYER_TURNS";
    s.turnDeadline = null;
    s.players[id].ap = 3;
    s.players[id].lost = false;
    s.players[id].sanity = 5;
    s.players[id].fate = 8;
    s.players[id].statuses = [];
  }
  success(action: GameAction, id = this.active) { rigNextDie(this.state, 4); this.act(id, action); this.settle(); }
  place(id: string, room: RoomId03, year: Year03) {
    this.state.temporal!.locations[id] = { roomId: room, year };
    this.state.players[id].carriageIndex = placeKey03(room, year);
    this.ready(id);
  }
  intervene(node: CausalNodeId03, choice: string) {
    const id = this.active;
    this.place(id, NODES03[node].roomId, "Y1996");
    this.state = successfulAction03(this.state, id, { type: "INTERVENE", nodeId: node, choiceId: choice }, ++this.now).state;
  }
}

function train(t: Checkpoint, id: CheckPresetId) {
  if (id === "s1.start") return;
  if (id === "s1.blackout") { t.round(4); t.state.sequence = { kind: "BLACKOUT", acks: [] }; return; }
  if (id === "s1.brake") { t.round(6); t.until((s) => s.pending.some((w) => w.resume.kind === "BRAKE_VOTE")); return; }
  if (id === "s1.fold") { t.until((s) => s.sequence?.kind === "FOLD"); return; }
  if (id === "s1.trade") {
    const from = t.active, to = t.state.turnOrder.find((p) => p !== from)!;
    t.state.players[to].carriageIndex = t.state.players[from].carriageIndex;
    t.act(from, { type: "TRADE", targetId: to, give: { items: [], fate: 1 }, want: { items: [], fate: 0 } });
    return;
  }
  t.round(4);
  for (const anchorId of ["POWER", "IDENTITY", "MEMORY"] as AnchorId[]) {
    const carriage = t.state.carriages.findIndex((c) => { const target = repairTarget({ s: t.state, now: t.now, events: [] }, c.index); return target?.kind === "ANCHOR" && target.anchor === anchorId; });
    t.ready(); t.state.players[t.active].carriageIndex = carriage;
    t.success({ type: "REPAIR" });
  }
  if (id === "s1.anchors") return;
  t.round(8); t.state.collapse = 6;
  t.state.fragments = ["ROUTE", "DRIVER", "MANIFEST"];
  const actor = t.active;
  for (const anchor of Object.values(t.state.anchors)) {
    const key = KEY_FOR_ANCHOR[anchor.id];
    for (const p of Object.values(t.state.players)) p.items = p.items.filter((item) => item !== key);
    t.state.players[actor].items.push(key);
  }
  t.state.coreMemories = id === "s1.locks" ? 0 : 6;
  for (const lock of ["power", "identity"] as const) {
    t.ready(actor);
    t.state.players[actor].carriageIndex = t.state.carriages.findIndex((c) => c.identity === LOCK_AT[lock]);
    t.success({ type: "REPAIR" });
  }
  t.ready(actor); t.state.players[actor].carriageIndex = t.state.carriages.findIndex((c) => c.identity === "CAB");
  if (id === "s1.locks") return;
  rigNextDie(t.state, 4);
  t.act(actor, { type: "REPAIR" });
  while (t.state.pending.length && t.state.pending.at(-1)!.kind !== "ENDING_CHOICE") t.defaults();
  if (id === "s1.ending") {
    const w = t.state.pending.at(-1)!;
    for (const recipient of w.addressees) t.act(recipient, { type: "RESPOND", windowId: w.id, optionId: "TICKET" });
  }
}

function fitBoat(t: Checkpoint) {
  const s = t.state, city = s.city!;
  city.boat.installed = ["ENGINE", "FUEL", "NAV"];
  for (const zone of city.zones) zone.caches = zone.caches.filter((item) => !["ENGINE", "FUEL", "NAV", "CHIP"].includes(item));
  for (const holding of Object.values(city.holdings)) holding.parts = [];
  city.boat.autoStart = false;
  for (const name of ["POWER_STATION", "HARBOUR_GATE"] as const) {
    const f = city.facilities[name]; f.progress = f.required; f.done = true;
  }
  for (const p of Object.values(s.players)) { p.carriageIndex = zoneIndex("HARBOUR"); city.holdings[p.playerId].passes = 1; }
  changeCollapse({ s, now: t.now, events: [] }, 5 - s.collapse, m`the water rises`);
  // Capacity is a separate replay checkpoint; all other prepared city states
  // acknowledge its existing scene before presenting the next operation.
  if (s.sequence) t.state = hostSkip(s, ++t.now).state;
  startCountdown({ s: t.state, now: t.now, events: [] });
}
function city(t: Checkpoint, id: CheckPresetId) {
  if (id === "s2.start") return;
  const s = t.state, a = t.active;
  if (id === "s2.water" || id === "s2.parts" || id === "s2.capacity") {
    s.city!.boat.installed = ["ENGINE", "FUEL"];
    for (const zone of s.city!.zones) zone.caches = zone.caches.filter((item) => !["ENGINE", "FUEL", "NAV"].includes(item));
    s.city!.holdings[a].parts = ["NAV"];
    s.players[a].carriageIndex = zoneIndex("HARBOUR");
    changeCollapse({ s, now: t.now, events: [] }, (id === "s2.water" ? 9 : 5) - s.collapse, m`the water rises`);
    if (id === "s2.capacity") { s.sequence = null; s.city!.boat.revealed = false; checkReveal({ s, now: t.now, events: [] }, true); }
    if (id === "s2.parts" && s.sequence) t.state = hostSkip(s, ++t.now).state;
    return;
  }
  fitBoat(t);
  if (t.state.sequence) t.state = hostSkip(t.state, ++t.now).state;
  // The countdown is complete; the world step opens the same boarding vote
  // used during normal play, with real passes and a seeded capacity.
  t.state.city!.boat.readyRound = t.state.round - 1;
  departureStep({ s: t.state, now: t.now, events: [] });
  if (id === "s2.boarding") return;
  const board = t.state.pending.at(-1)!;
  for (const p of board.addressees) t.act(p, { type: "RESPOND", windowId: board.id, optionId: p === a ? "BOARD" : "STAY" });
  t.settle();
  const engineer = t.state.turnOrder.find((p) => !t.state.city!.boat.aboard.includes(p))!;
  t.ready(engineer); t.state.players[engineer].carriageIndex = zoneIndex("POWER_STATION");
  if (id === "s2.generator") return;
  t.success({ type: "RESTART_GENERATOR" }, engineer);
}

function closeLoops(t: Checkpoint, leaveLast = false) {
  const obligations = [...t.state.temporal!.bootstrap];
  for (const [index, obligation] of obligations.entries()) {
    const holder = obligation.assignedTo;
    const item = t.state.temporal!.storedItems[obligation.instanceId];
    t.place(holder, item.roomId, "Y2026");
    t.act(holder, { type: "PICK_UP", instanceId: item.instanceId });
    t.ready(holder); t.act(holder, { type: "TIME_JUMP" }); t.settle();
    t.place(holder, obligation.storageRoom, "Y1996");
    if (leaveLast && index === obligations.length - 1) return;
    t.act(holder, { type: "STORE_ITEM", instanceId: item.instanceId });
  }
}
function temporal(t: Checkpoint, id: CheckPresetId) {
  if (id === "s3.start") return;
  t.round(id === "s3.jump" || id === "s3.shift" || id === "s3.dice" ? 2 : id === "s3.bootstrap" ? 4 : id === "s3.echo" ? 6 : id === "s3.recap" ? 7 : 10);
  if (id === "s3.jump") { t.place(t.active, "CENTRAL_HALL", "Y2026"); return; }
  if (id === "s3.shift") { t.place(t.active, "ARCHIVES", "Y1996"); return; }
  if (id === "s3.bootstrap") { closeLoops(t, true); return; }
  if (id === "s3.echo" || id === "s3.recap") return;
  if (id === "s3.dice") { t.place(t.active, "ARCHIVES", "Y2026"); t.act(t.active, { type: "INVESTIGATE" }); return; }
  const route: EndingRoute03 = id === "s3.erased" ? "NO_TOMORROW" : id === "s3.deceive" ? "DECEIVE_HISTORY" : "OFFICIAL_HISTORY";
  if (route === "NO_TOMORROW") { t.intervene("PROTOTYPE_CORE", "SHUT_DOWN"); t.intervene("ACCIDENT_RECORD", "ERASED"); }
  else {
    closeLoops(t);
    t.intervene("ACCIDENT_RECORD", route === "DECEIVE_HISTORY" ? "CONTROLLED" : "OFFICIAL");
    if (route === "DECEIVE_HISTORY") {
      t.intervene("STAFF_EVACUATION", "EVACUATE"); t.intervene("JI_RECORD", "STAGE_DEATH"); t.intervene("PROTOTYPE_FATE", "HIDE");
    }
  }
  t.place(t.active, "ARCHIVES", "Y1996");
  if (id === "s3.archive") return;
  t.act(t.active, { type: "RESOLVE_HISTORY", route });
}

function auction(t: Checkpoint, id: CheckPresetId) {
  if (id === "s4.start") return;
  if (id === "s4.auction") { t.round(4); return; }
  const a = t.active;
  if (id === "s4.counterfeit") {
    const lotId = "LOT_02";
    const order = t.state.auction!.lotOrder!;
    let index = order.indexOf(lotId);
    if (index < 0) { index = 1; order[index] = lotId; }
    t.state.auction!.counterfeitLots = [lotId, t.state.auction!.counterfeitLots.find((other) => other !== lotId) ?? "LOT_01"];
    if (index === 0) t.state.auction!.itemInstances[lotId].counterfeit = true;
    t.round(index + 1);
    const holder = t.active;
    t.act(holder, { type: "BID", amount: lotForAuctionRound04(t.state, t.state.round).startingBid });
    t.act(holder, { type: "END_TURN" });
    t.until((s) => s.auction!.players[holder].items.includes(lotId));
    t.state.activeIndex = t.state.turnOrder.indexOf(holder);
    t.state.turnDeadline = null; t.state.auction!.turnPlayerId = holder;
    return;
  }
  if (id === "s4.blackjack") {
    const target = t.state.turnOrder.find((p) => p !== a)!;
    t.act(a, { type: "CHALLENGE", targetId: target, wager: 1 });
    const w = t.state.pending.at(-1)!;
    t.act(target, { type: "RESPOND", windowId: w.id, optionId: "ACCEPT" });
    return;
  }
  if (id === "s4.private") { t.success({ type: "INVESTIGATE" }); return; }
  if (id === "s4.debt") t.state.auction!.players[a].debt = 6;
  t.round(10);
  if (id === "s4.exit") return;
  for (const p of t.state.turnOrder) { t.act(p, { type: "FINAL_CONVERT", resource: "BLACK_CHIPS" }); t.act(p, { type: "FINAL_READY" }); }
  if (id === "s4.final-bid") return;
  const ids = t.state.turnOrder;
  for (const [index, p] of ids.entries()) t.act(p, { type: "FINAL_BID", amount: id === "s4.showdown" ? (index < 2 ? 5 : 0) : p === a ? 1 : 0 });
  for (const p of ids) t.act(p, { type: "FINAL_CONTINUE" });
}

export function prepareCheckpoint(state: GameState, id: CheckPresetId, now: number): GameState {
  state.flags.developerCheck = 1;
  const t = new Checkpoint(state, now);
  if (id.startsWith("s1.")) train(t, id);
  else if (id.startsWith("s2.")) city(t, id);
  else if (id.startsWith("s3.")) temporal(t, id);
  else auction(t, id);
  t.state.flags.developerCheck = 1;
  t.state.turnVersion = t.state.version;
  t.state.turnDeadline = null;
  return t.state;
}
