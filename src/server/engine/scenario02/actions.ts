// Scenario 02's actions. Everything that can fail is a roll (Fate, help and
// abilities apply); what a roll does is in the onRollOutcome handlers below.
// Public work (repairs, rescues, pumping) counts toward a player's
// contribution; finding things and knowing things is private until shared.
//
//   MOVE         1 AP  a neighbouring zone; flooded = a wade (roll); a raft crosses one sunken zone
//   SEARCH       1 AP  roll; once per zone: parts, supplies or a little Fate
//   INVESTIGATE  1 AP  roll; true facts about the water and hidden parts, kept private
//   REPAIR       1 AP  roll at the power station or pumps; each other worker this round adds +1
//   OPERATE      1 AP  run what works here: pumps, broadcast, control centre, hospital, fire station
//   RESCUE       1 AP  an NPC here (roll) or a shaken player here (+1 Sanity)
//   SALVAGE      1 AP  roll in a flooded or doomed zone: better finds, worse falls
//   HELP / STABILIZE   as in every scenario
//   TRADE        0 AP  with someone in your zone: Fate, items, boat parts, passes (3 offers a round)
//   SHARE_INTEL  0 AP  read out something you learned, to everyone
//   INSTALL      1 AP  at the pier: fit a part to the boat, or wire two batteries for power
//   REGISTER     1 AP  at the pier: trade 3 Fate and an item for a pass, while the office has any
import type { GameAction, GameActionType, TradeOffer } from "../../../shared/game/actions.ts";
import { AP_COST } from "../../../shared/game/actions.ts";
import { MAX_HELP_BONUS } from "../../../shared/game/scenario01/content.ts";
import { ITEM_IDS02, ITEMS02, PART_IDS, type PartId, type S02ItemId } from "../../../shared/game/scenario02/items.ts";
import { hexDistance, ZONES } from "../../../shared/game/scenario02/map.ts";
import { NPCS } from "../../../shared/game/scenario02/npcs.ts";
import type { GameState, PlayerGameState, PlayerId } from "../../../shared/game/state.ts";
import { list, m, ref } from "../../../shared/i18n/msg.ts";
import type { Msg } from "../../../shared/i18n/types.ts";
import { END_TURN, fail, helped, STABILIZE, USE_SKILL, type Fail, type Spec } from "../actions.ts";
import { cue, log, newId, type Ctx } from "../context.ts";
import { onRollOutcome, startRoll } from "../dice.ts";
import { applyEffects, changeCollapse } from "../effects.ts";
import { gainFate, gainSanity, hasStatus, loseSanity, spendFate, useUpStatus } from "../players.ts";
import { measureRewards } from "../rewards.ts";
import { pick } from "../rng.ts";
import type { ActionSet } from "../scenario.ts";
import { onResume, openWindow } from "../windows.ts";
import { canMove, moveTargets, partSite, raftTargets } from "./city.ts";
import { awardPass, boatMissing, checkReveal, jobDone } from "./boat.ts";

const zoneRef = (i: number) => ref.zone(ZONES[i].id);
/** How much of the next rise one run of the pumps holds back. */
export const PUMP_HOLD = 2;
const facilityAt = (i: number) => ZONES[i].facility;
const others = (s: GameState, p: PlayerGameState) => Object.values(s.players).filter((o) => o.playerId !== p.playerId && !o.away);
const here = (s: GameState, p: PlayerGameState) => others(s, p).filter((o) => o.carriageIndex === p.carriageIndex);
const contribute = (ctx: Ctx, p: PlayerGameState, n = 1) => (ctx.s.city!.contrib[p.playerId] = (ctx.s.city!.contrib[p.playerId] ?? 0) + n);

/** A true fact for one player's eyes (shown in their secrets; theirs to share or not). */
function learn(ctx: Ctx, p: PlayerGameState, text: Msg): void {
  ctx.s.secrets[p.playerId].peeks.push({ id: newId(ctx, "intel"), text, round: ctx.s.round });
}

function arrive(ctx: Ctx, p: PlayerGameState, to: number): void {
  const from = p.carriageIndex;
  p.carriageIndex = to;
  cue(ctx, "MOVE", { playerId: p.playerId, from, to });
  if (!p.counters[`seen_${to}`]) {
    p.counters[`seen_${to}`] = 1;
    p.counters.zonesVisited = (p.counters.zonesVisited ?? 1) + 1;
  }
  checkReveal(ctx);
}

const aboard = (s: GameState, p: PlayerGameState) => s.city!.boat.aboard.includes(p.playerId);

// ---- moving -------------------------------------------------------------------

const hasRaft = (p: PlayerGameState) => p.items.includes("INFLATABLE_RAFT");

const MOVE: Spec<Extract<GameAction, { type: "MOVE" }>> = {
  targets: (s, p) => [...moveTargets(s.city!, p.carriageIndex), ...(hasRaft(p) ? raftTargets(s.city!, p.carriageIndex) : [])],
  check: (s, p, a) => {
    if (aboard(s, p)) return fail("ILLEGAL_TARGET", m`You're aboard the boat. Stepping off would give up your seat.`);
    const raft = hasRaft(p) ? raftTargets(s.city!, p.carriageIndex) : [];
    if (!moveTargets(s.city!, p.carriageIndex).length && !raft.length) return fail("ILLEGAL_TARGET", m`Every way out of here is under water or blocked.`);
    if (!a) return null;
    if (!Number.isInteger(a.toCarriage) || !ZONES[a.toCarriage]) return fail("INVALID", m`Choose a zone.`);
    if (raft.includes(a.toCarriage)) return null;
    const c = canMove(s.city!, p.carriageIndex, a.toCarriage);
    if (c.ok) return null;
    if (c.why === "NOT_ADJACENT") return fail("ILLEGAL_TARGET", m`You can only move to a zone next to yours, along a road that still stands.`);
    if (c.why === "SUBMERGED") return fail("ILLEGAL_TARGET", m`${zoneRef(a.toCarriage)} is under water. You can't walk there.`);
    return fail("ILLEGAL_TARGET", m`${zoneRef(a.toCarriage)} is blocked.`);
  },
  hint: () => m`One step to a zone next to yours. Flooded zones must be waded: a roll.`,
  apply: (ctx, p, a) => {
    const city = ctx.s.city!;
    if (hasRaft(p) && raftTargets(city, p.carriageIndex).includes(a.toCarriage) && !moveTargets(city, p.carriageIndex).includes(a.toCarriage)) {
      p.items.splice(p.items.indexOf("INFLATABLE_RAFT"), 1);
      log(ctx, m`${p.nickname} paddles a raft across the water to ${zoneRef(a.toCarriage)}. The raft doesn't survive the trip.`, "MOVE", p.playerId);
      return arrive(ctx, p, a.toCarriage);
    }
    const c = canMove(city, p.carriageIndex, a.toCarriage);
    if (c.ok && c.wade) {
      log(ctx, m`${p.nickname} wades toward ${zoneRef(a.toCarriage)}.`, "MOVE", p.playerId);
      startRoll(ctx, p, "S2_WADE", m`wading`, { kind: "S2_WADE", carriageIndex: a.toCarriage });
      return;
    }
    log(ctx, m`${p.nickname} moves to ${zoneRef(a.toCarriage)}.`, "MOVE", p.playerId);
    arrive(ctx, p, a.toCarriage);
  },
};

// the final result decides: a failure gets you there cold and shaken, a disaster turns you back; a life jacket saves either
onRollOutcome("S2_WADE", (ctx, p, roll, rc) => {
  const to = rc.carriageIndex;
  const floating = roll.tier !== "SUCCESS" && roll.tier !== "PERFECT" && hasStatus(p, "BUOYANT");
  if (floating) useUpStatus(ctx, p, "BUOYANT");
  if (roll.tier === "DISASTER" && !floating) {
    log(ctx, m`The current turns ${p.nickname} back.`, "MOVE", p.playerId);
    loseSanity(ctx, p, 1, m`the black water`);
    return;
  }
  // the zone may have gone under while the roll was open
  if (ctx.s.city!.zones[to].status === "SUBMERGED") return log(ctx, m`${zoneRef(to)} is gone before ${p.nickname} gets there.`, "MOVE", p.playerId);
  arrive(ctx, p, to);
  if (floating) log(ctx, m`${p.nickname}'s life jacket keeps them up all the way to ${zoneRef(to)}.`, "MOVE", p.playerId);
  else if (roll.tier === "FAIL") {
    log(ctx, m`${p.nickname} makes it to ${zoneRef(to)}, soaked and shaking.`, "MOVE", p.playerId);
    loseSanity(ctx, p, 1, m`the black water`);
  } else log(ctx, m`${p.nickname} wades through to ${zoneRef(to)}.`, "MOVE", p.playerId);
});

// ---- searching and knowing ---------------------------------------------------------

const SEARCH: Spec = {
  check: (s, p) => (s.city!.zones[p.carriageIndex].searched ? fail("ILLEGAL_TARGET", m`${zoneRef(p.carriageIndex)} has already been picked clean.`) : null),
  hint: () => m`Search this zone, once: boat parts, supplies or a little Fate.`,
  apply: (ctx, p) => {
    startRoll(ctx, p, "S2_SEARCH", m`search`, { kind: "S2_SEARCH", carriageIndex: p.carriageIndex });
  },
};

onRollOutcome("S2_SEARCH", (ctx, p, roll, rc) => {
  const z = ctx.s.city!.zones[rc.carriageIndex];
  if (roll.tier === "DISASTER") {
    log(ctx, m`${p.nickname} reaches into the dark water and something reaches back.`, "SEARCH", p.playerId);
    return loseSanity(ctx, p, 1, m`what was under the water`);
  }
  if (roll.tier === "FAIL") return log(ctx, m`${p.nickname} searches ${zoneRef(rc.carriageIndex)} and comes up empty. It could be worth another look.`, "SEARCH", p.playerId);
  z.searched = true;
  const parts = z.caches.filter((c): c is PartId => (PART_IDS as string[]).includes(c));
  const items = z.caches.filter((c): c is S02ItemId => (ITEM_IDS02 as string[]).includes(c));
  const vip = z.caches.includes("VIP_PASS");
  z.caches = [];
  if (vip && awardPass(ctx, `VIP:${rc.carriageIndex}`, p, m`a VIP evacuation card in a drawer`)) p.stats.fragmentsFound++;
  measureRewards(ctx, [p.playerId], m`a search`, () => {
    for (const part of parts) {
      ctx.s.city!.holdings[p.playerId].parts.push(part);
      p.stats.fragmentsFound++;
      log(ctx, m`${p.nickname} finds a boat part in ${zoneRef(rc.carriageIndex)}.`, "PART", p.playerId);
      learn(ctx, p, m`You found the ${ref.part(part)} in ${zoneRef(rc.carriageIndex)}.`);
      cue(ctx, "PART", { playerId: p.playerId });
    }
    for (const item of items) {
      p.items.push(item);
      log(ctx, m`${p.nickname} finds a ${ref.item(item)} in ${zoneRef(rc.carriageIndex)}.`, "ITEM", p.playerId);
      cue(ctx, "ITEM", { playerId: p.playerId, item });
    }
    if (!parts.length && !items.length && !vip) gainFate(ctx, p, 1, m`useful supplies`);
    if (roll.tier === "PERFECT") gainFate(ctx, p, 1, m`a perfect search`);
  });
});

const INVESTIGATE: Spec = {
  check: () => null,
  hint: () => m`Study the water and the streets around you. What you learn stays yours unless you share it.`,
  apply: (ctx, p) => {
    log(ctx, m`${p.nickname} studies ${zoneRef(p.carriageIndex)} and keeps what they learn to themselves.`, "INVESTIGATE", p.playerId);
    startRoll(ctx, p, "S2_INVESTIGATE", m`investigation`, { kind: "S2_INVESTIGATE", carriageIndex: p.carriageIndex });
  },
};

/** How many more rises a zone has, as a sentence (true now; events can change it). */
function sinkFact(s: GameState, zone: number): Msg {
  const left = s.city!.zones[zone].sinkAt - s.collapse;
  if (left > 12) return m`${zoneRef(zone)} will not go under before the end.`;
  if (left <= 1) return m`${zoneRef(zone)} goes under at the next rise.`;
  return m`${zoneRef(zone)} goes under when the water rises ${left} more times.`;
}

onRollOutcome("S2_INVESTIGATE", (ctx, p, roll, rc) => {
  const s = ctx.s;
  const city = s.city!;
  const at = rc.carriageIndex;
  if (roll.tier === "DISASTER") {
    log(ctx, m`${p.nickname} sees a face under the water. Their own.`, "INVESTIGATE", p.playerId);
    return loseSanity(ctx, p, 1, m`a face under the water`);
  }
  if (roll.tier === "FAIL") return learn(ctx, p, sinkFact(s, at));
  // the most urgent zone around you, and any part hidden nearby
  const near = [at, ...city.edges.filter((e) => e.a === at || e.b === at).map((e) => (e.a === at ? e.b : e.a))].filter((i) => city.zones[i].status !== "SUBMERGED");
  const urgent = [...near].sort((x, y) => city.zones[x].sinkAt - city.zones[y].sinkAt || x - y)[0];
  learn(ctx, p, sinkFact(s, urgent));
  const reach = roll.tier === "PERFECT" ? 3 : 2;
  for (const part of PART_IDS) {
    const site = partSite(city, part);
    if (site >= 0 && hexDistance(at, site) <= reach) learn(ctx, p, m`The ${ref.part(part)} is hidden somewhere in ${zoneRef(site)}.`);
  }
  if (roll.tier === "PERFECT") {
    const giving = city.edges.filter((e) => !e.broken && e.breakAt !== null && (e.a === at || e.b === at || near.includes(e.a) || near.includes(e.b)));
    for (const e of giving) learn(ctx, p, m`The crossing between ${zoneRef(e.a)} and ${zoneRef(e.b)} gives way once the water has risen ${Math.max(1, e.breakAt! - s.collapse)} more times.`);
  }
});

// ---- working together ----------------------------------------------------------------

type Big = "POWER_STATION" | "PUMP_STATION" | "HARBOUR_GATE";
const bigAt = (s: GameState, zone: number): Big | null => {
  const f = facilityAt(zone);
  return f === "POWER_STATION" || f === "PUMP_STATION" ? f : f === "HARBOUR" ? "HARBOUR_GATE" : null;
};

const REPAIR: Spec = {
  check: (s, p) => {
    const f = bigAt(s, p.carriageIndex);
    if (!f) return fail("ILLEGAL_TARGET", m`Nothing here needs repairing. The power station, the pump station and the pier gate do.`);
    if (s.city!.facilities[f].done) return fail("ILLEGAL_TARGET", m`${zoneRef(p.carriageIndex)} is already working.`);
    return null;
  },
  hint: (s, p) => {
    const f = bigAt(s, p.carriageIndex);
    if (!f) return undefined;
    const fac = s.city!.facilities[f];
    const crew = Math.min(2, fac.workedThisRound.filter((id) => id !== p.playerId).length);
    return crew ? m`${fac.progress}/${fac.required} done. +${crew} for the others already working here this round.` : m`${fac.progress}/${fac.required} done. Others working here this round make it easier.`;
  },
  apply: (ctx, p) => {
    const f = bigAt(ctx.s, p.carriageIndex)!;
    const fac = ctx.s.city!.facilities[f];
    const crew = Math.min(2, fac.workedThisRound.filter((id) => id !== p.playerId).length);
    if (!fac.workedThisRound.includes(p.playerId)) fac.workedThisRound.push(p.playerId);
    startRoll(ctx, p, "S2_WORK", m`repair`, { kind: "S2_WORK", carriageIndex: p.carriageIndex }, { extra: crew ? [{ source: m`working together`, delta: crew }] : [] });
  },
};

onRollOutcome("S2_WORK", (ctx, p, roll, rc) => {
  const city = ctx.s.city!;
  const f = bigAt(ctx.s, rc.carriageIndex)!;
  const fac = city.facilities[f];
  if (roll.tier === "DISASTER") {
    fac.progress = Math.max(0, fac.progress - 1);
    log(ctx, f === "POWER_STATION" ? m`A transformer at the power station blows. ${p.nickname} is thrown clear.` : f === "PUMP_STATION" ? m`A pump seizes and floods its own room. ${p.nickname} gets out, barely.` : m`The gate's chain snaps and whips past ${p.nickname}.`, "WORK", p.playerId);
    loseSanity(ctx, p, 1, m`the blast`);
    // only the power station can take part of the city with it
    if (f === "POWER_STATION") changeCollapse(ctx, 1, m`a botched repair`);
    return;
  }
  if (roll.tier === "FAIL") return log(ctx, m`${p.nickname}'s work at ${zoneRef(rc.carriageIndex)} doesn't hold.`, "WORK", p.playerId);
  fac.progress = Math.min(fac.required, fac.progress + (roll.tier === "PERFECT" ? 2 : 1));
  p.stats.repairs++;
  contribute(ctx, p);
  fac.contributors[p.playerId] = (fac.contributors[p.playerId] ?? 0) + 1;
  log(ctx, m`${p.nickname} works on ${zoneRef(rc.carriageIndex)}: ${fac.progress}/${fac.required}.`, "WORK", p.playerId);
  cue(ctx, "WORK", { facility: f, progress: fac.progress, required: fac.required });
  if (fac.progress < fac.required || fac.done) return;
  fac.done = true;
  city.zones[rc.carriageIndex].powered = true;
  if (f === "POWER_STATION") {
    city.hold += 1;
    log(ctx, m`The power station comes back. Lights flicker on across what is left of the city, and the next rise is held back.`, "FACILITY");
  } else if (f === "PUMP_STATION") log(ctx, m`The pumps answer. Run them each round and they hold back the water.`, "FACILITY");
  else log(ctx, m`The pier gate swings on its hinges again. It still needs someone to hold it open.`, "FACILITY");
  cue(ctx, "FACILITY", { facility: f });
  jobDone(ctx, f);
});

const OPERATE: Spec = {
  check: (s, p) => {
    const city = s.city!;
    const f = facilityAt(p.carriageIndex);
    if (f === "PUMP_STATION") {
      if (!city.facilities.PUMP_STATION.done) return fail("ILLEGAL_TARGET", m`The pumps need repairing before they can run.`);
      if (city.pumpedRound === s.round) return fail("ILLEGAL_TARGET", m`The pumps are already running this round.`);
      return null;
    }
    if (f === "BROADCAST_TOWER" || f === "CONTROL_CENTRE") return s.flags[`op_${f}_${s.round}`] ? fail("ILLEGAL_TARGET", m`That has already been used this round.`) : null;
    if (f === "HOSPITAL") return here(s, p).concat(p).some((o) => o.sanity < 3 || o.lost) ? null : fail("ILLEGAL_TARGET", m`Nobody here needs treatment.`);
    if (f === "FIRE_STATION") return s.flags.fireLocker ? fail("ILLEGAL_TARGET", m`The fire station's locker is empty.`) : null;
    return fail("ILLEGAL_TARGET", m`Nothing here to operate.`);
  },
  hint: () => m`Pumps hold back a rise; the tower broadcasts what sinks next; the control centre finds a part; the hospital treats; the fire station has gear.`,
  apply: (ctx, p) => {
    const s = ctx.s;
    const city = s.city!;
    const f = facilityAt(p.carriageIndex)!;
    if (f === "PUMP_STATION") {
      city.pumpedRound = s.round;
      city.hold += PUMP_HOLD;
      contribute(ctx, p);
      return log(ctx, m`${p.nickname} runs the pumps. They will hold back up to ${PUMP_HOLD} of the next rise.`, "FACILITY", p.playerId);
    }
    if (f === "BROADCAST_TOWER") {
      s.flags[`op_${f}_${s.round}`] = 1;
      contribute(ctx, p);
      const soon = city.zones.map((z, i) => (z.status !== "SUBMERGED" && z.sinkAt <= s.collapse + 2 ? i : -1)).filter((i) => i >= 0);
      return log(ctx, soon.length ? m`${p.nickname} broadcasts to the whole city: within two rises, ${list(soon.map(zoneRef))} will be gone.` : m`${p.nickname} broadcasts to the whole city: nothing more goes under in the next two rises.`, "BROADCAST", p.playerId);
    }
    if (f === "CONTROL_CENTRE") {
      s.flags[`op_${f}_${s.round}`] = 1;
      log(ctx, m`${p.nickname} works the control centre's screens and keeps what they find to themselves.`, "FACILITY", p.playerId);
      const hidden = PART_IDS.map((part) => [part, partSite(city, part)] as const).filter(([, site]) => site >= 0);
      if (!hidden.length) return learn(ctx, p, m`Every boat part has already been found.`);
      const [part, site] = hidden[0];
      return learn(ctx, p, m`The ${ref.part(part)} is hidden somewhere in ${zoneRef(site)}.`);
    }
    if (f === "HOSPITAL") {
      for (const o of [p, ...here(s, p)]) gainSanity(ctx, o, 1, m`treatment at the hospital`);
      contribute(ctx, p);
      return;
    }
    s.flags.fireLocker = 1;
    p.items.push("LIFE_JACKET", "ROPE");
    log(ctx, m`${p.nickname} empties the fire station's locker: a life jacket and a rope.`, "ITEM", p.playerId);
  },
};

// ---- people ----------------------------------------------------------------------

const waitingHere = (s: GameState, p: PlayerGameState) => s.city!.npcs.filter((n) => n.state === "WAITING" && n.zone === p.carriageIndex);
const shakenHere = (s: GameState, p: PlayerGameState) => here(s, p).filter((o) => o.sanity < 3 || o.lost);

const RESCUE: Spec<Extract<GameAction, { type: "RESCUE" }>> = {
  targets: (s, p) => [...waitingHere(s, p).map((n) => n.id), ...shakenHere(s, p).map((o) => o.playerId)],
  check: (s, p, a) => {
    if (!waitingHere(s, p).length && !shakenHere(s, p).length) return fail("ILLEGAL_TARGET", m`Nobody here needs rescuing.`);
    if (!a) return null;
    if (a.npcId) return waitingHere(s, p).some((n) => n.id === a.npcId) ? null : fail("ILLEGAL_TARGET", m`They aren't here, or don't need you any more.`);
    if (a.targetId) return shakenHere(s, p).some((o) => o.playerId === a.targetId) ? null : fail("ILLEGAL_TARGET", m`They need to be in your zone and shaken.`);
    return fail("INVALID", m`Choose who to rescue.`);
  },
  hint: () => m`Pull someone out: a stranger waiting here (a roll), or a shaken companion here (+1 Sanity).`,
  apply: (ctx, p, a) => {
    if (a.npcId) {
      log(ctx, m`${p.nickname} goes in after ${ref.npc(a.npcId)}.`, "RESCUE", p.playerId);
      startRoll(ctx, p, "S2_RESCUE", m`rescue`, { kind: "S2_RESCUE", carriageIndex: p.carriageIndex, target: a.npcId });
      return;
    }
    const t = ctx.s.players[a.targetId!];
    log(ctx, m`${p.nickname} pulls ${t.nickname} out of the water and talks them down.`, "RESCUE", p.playerId);
    gainSanity(ctx, t, 1, m`a hand when it mattered`);
    contribute(ctx, p);
    ctx.s.city!.rescues[p.playerId] = (ctx.s.city!.rescues[p.playerId] ?? 0) + 1;
    p.stats.helpsGiven++;
  },
};

onRollOutcome("S2_RESCUE", (ctx, p, roll, rc) => {
  const npc = ctx.s.city!.npcs.find((n) => n.id === rc.target)!;
  if (roll.tier === "DISASTER") {
    log(ctx, m`The water drags ${p.nickname} under for a long moment. ${ref.npc(npc.id)} is still out of reach.`, "RESCUE", p.playerId);
    return loseSanity(ctx, p, 1, m`the undertow`);
  }
  if (roll.tier === "FAIL") return log(ctx, m`${p.nickname} can't get to ${ref.npc(npc.id)} yet.`, "RESCUE", p.playerId);
  if (npc.state !== "WAITING") return;
  npc.state = "RESCUED";
  contribute(ctx, p, 2);
  ctx.s.city!.rescues[p.playerId] = (ctx.s.city!.rescues[p.playerId] ?? 0) + 1;
  log(ctx, m`${p.nickname} brings ${ref.npc(npc.id)} to safety.`, "RESCUE", p.playerId);
  cue(ctx, "RESCUE", { playerId: p.playerId, npc: npc.id });
  const reward = NPCS.find((n) => n.id === npc.id)!.reward;
  measureRewards(ctx, [p.playerId], m`a rescue`, () => {
    if (reward === "FATE") gainFate(ctx, p, 2, m`a grateful stranger`);
    else if (reward === "PASS") {
      if (!awardPass(ctx, `NPC:${npc.id}`, p, ref.npc(npc.id))) gainFate(ctx, p, 1, m`a grateful stranger`);
    }
    else if (reward === "ITEM") {
      const item = pick(ctx.s, ITEM_IDS02);
      p.items.push(item);
      log(ctx, m`${ref.npc(npc.id)} presses a ${ref.item(item)} into ${p.nickname}'s hands.`, "ITEM", p.playerId);
    } else {
      const city = ctx.s.city!;
      const hidden = PART_IDS.map((part) => [part, partSite(city, part)] as const).filter(([, site]) => site >= 0);
      if (hidden.length) {
        const [part, site] = pick(ctx.s, hidden);
        learn(ctx, p, m`${ref.npc(npc.id)} tells you where the ${ref.part(part)} is: ${zoneRef(site)}.`);
      } else gainFate(ctx, p, 1, m`a grateful stranger`);
    }
  });
});

// ---- risk ------------------------------------------------------------------------

const doomed = (s: GameState, zone: number) => {
  const z = s.city!.zones[zone];
  return z.status === "FLOODED" || z.sinkAt === s.collapse + 1;
};

const SALVAGE: Spec = {
  check: (s, p) => {
    if (!doomed(s, p.carriageIndex)) return fail("ILLEGAL_TARGET", m`Salvage needs a flooded zone, or one about to go under.`);
    if (s.flags[`salvage_${p.carriageIndex}_${s.round}`]) return fail("ILLEGAL_TARGET", m`${zoneRef(p.carriageIndex)} has been salvaged this round.`);
    return null;
  },
  hint: () => m`Grab what you can from a drowning zone: better finds, worse falls.`,
  apply: (ctx, p) => {
    ctx.s.flags[`salvage_${p.carriageIndex}_${ctx.s.round}`] = 1;
    startRoll(ctx, p, "S2_RISK", m`salvage`, { kind: "S2_RISK", carriageIndex: p.carriageIndex });
  },
};

onRollOutcome("S2_RISK", (ctx, p, roll, rc) => {
  if (roll.tier === "DISASTER") {
    log(ctx, m`The floor gives way under ${p.nickname}.`, "SALVAGE", p.playerId);
    return loseSanity(ctx, p, 2, m`a fall into the water`);
  }
  if (roll.tier === "FAIL") {
    log(ctx, m`${p.nickname} comes back from ${zoneRef(rc.carriageIndex)} with nothing but cuts.`, "SALVAGE", p.playerId);
    return loseSanity(ctx, p, 1, m`a bad salvage`);
  }
  measureRewards(ctx, [p.playerId], m`a salvage`, () => {
    const found = roll.tier === "PERFECT" ? [pick(ctx.s, ITEM_IDS02), pick(ctx.s, ITEM_IDS02)] : [pick(ctx.s, ITEM_IDS02)];
    p.items.push(...found);
    log(ctx, m`${p.nickname} drags ${list(found.map((i) => ref.item(i)))} out of ${zoneRef(rc.carriageIndex)}.`, "SALVAGE", p.playerId);
    gainFate(ctx, p, 1, m`a daring salvage`);
  });
});

// ---- help, items -------------------------------------------------------------------

const HELP: Spec<Extract<GameAction, { type: "HELP" }>> = {
  targets: (s, p) => here(s, p).filter((o) => o.helpBonus < MAX_HELP_BONUS).map((o) => o.playerId),
  check: (s, p, a) => {
    if (!here(s, p).length) return fail("ILLEGAL_TARGET", m`Nobody else is in your zone.`);
    if (!a) return null;
    const t = s.players[a.targetId];
    if (!t || t.away || t.playerId === p.playerId || t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", m`They need to be in your zone.`);
    if (t.helpBonus >= MAX_HELP_BONUS) return fail("ILLEGAL_TARGET", m`${t.nickname} already has the most help they can use (+${MAX_HELP_BONUS}).`);
    return null;
  },
  hint: () => m`+1 to their next roll, up to +2.`,
  apply: (ctx, p, a) => {
    const t = ctx.s.players[a.targetId];
    t.helpBonus = Math.min(MAX_HELP_BONUS, t.helpBonus + 1);
    t.helpFrom.push(p.playerId);
    p.stats.helpsGiven++;
    t.stats.helpsReceived++;
    log(ctx, m`${p.nickname} helps ${t.nickname}: +1 to their next roll.`, "HELP", p.playerId);
    helped(ctx, p.playerId, t.playerId);
  },
};

const USE_ITEM: Spec<Extract<GameAction, { type: "USE_ITEM" }>> = {
  targets: (s, p) => [...new Set(p.items.filter((i) => i in ITEMS02 && ITEMS02[i as S02ItemId].effects.length))],
  check: (s, p, a) => {
    const usable = p.items.filter((i) => i in ITEMS02 && ITEMS02[i as S02ItemId].effects.length);
    if (!usable.length) return fail("ILLEGAL_TARGET", m`You aren't carrying any items you can use.`);
    if (!a) return null;
    if (!p.items.includes(a.item) || !(a.item in ITEMS02)) return fail("ILLEGAL_TARGET", m`You don't have that item.`);
    if (!ITEMS02[a.item as S02ItemId].effects.length) return fail("ILLEGAL_TARGET", m`The raft works when you move: choose a dry zone across the water.`);
    if (ITEMS02[a.item as S02ItemId].needsTarget && a.targetId && a.targetId !== p.playerId) {
      const t = s.players[a.targetId];
      if (!t || t.away || t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", m`They need to be in your zone.`);
    }
    return null;
  },
  hint: () => m`Items cost no action points.`,
  apply: (ctx, p, a) => {
    p.items.splice(p.items.indexOf(a.item), 1);
    const target = a.targetId ?? p.playerId;
    log(ctx, m`${p.nickname} uses the ${ref.item(a.item)}.`, "ITEM", p.playerId);
    cue(ctx, "ITEM_USED", { playerId: p.playerId, item: a.item, targetId: target });
    applyEffects(ctx, ITEMS02[a.item as S02ItemId].effects, { ownerId: p.playerId, targets: [target], label: ref.item(a.item) });
  },
};

// ---- trade and talk ----------------------------------------------------------------

const MAX_OFFERS_A_ROUND = 3;

function validOffer(s: GameState, p: PlayerGameState, o: TradeOffer): boolean {
  if (!o || !Array.isArray(o.items) || !Number.isInteger(o.fate) || o.fate < 0 || o.fate > p.fate) return false;
  const pool = [...p.items];
  for (const item of o.items) {
    const i = pool.indexOf(item);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  const parts = [...s.city!.holdings[p.playerId].parts];
  for (const part of o.parts ?? []) {
    const i = parts.indexOf(part);
    if (i < 0) return false;
    parts.splice(i, 1);
  }
  const passes = o.passes ?? 0;
  return Number.isInteger(passes) && passes >= 0 && passes <= s.city!.holdings[p.playerId].passes;
}

const wellFormed = (o: TradeOffer) =>
  !!o && Array.isArray(o.items) && Number.isInteger(o.fate) && o.fate >= 0 && (o.parts ?? []).every((x) => (PART_IDS as string[]).includes(x)) && Number.isInteger(o.passes ?? 0) && (o.passes ?? 0) >= 0;

const describe = (o: TradeOffer): Msg => {
  const bits: (Msg | string)[] = [
    ...o.items.map((i) => ref.item(i)),
    ...(o.parts ?? []).map((part) => ref.part(part)),
    ...(o.passes ? [o.passes === 1 ? m`an evacuation pass` : m`${o.passes} evacuation passes`] : []),
    ...(o.fate ? [m`${o.fate} Fate`] : []),
  ];
  return bits.length ? list(bits) : m`nothing`;
};

const TRADE: Spec<Extract<GameAction, { type: "TRADE" }>> = {
  targets: (s, p) => here(s, p).map((o) => o.playerId),
  check: (s, p, a): Fail | null => {
    if (!here(s, p).length) return fail("ILLEGAL_TARGET", m`Nobody else is in your zone to trade with.`);
    if ((s.flags[`offers_${s.round}_${p.playerId}`] ?? 0) >= MAX_OFFERS_A_ROUND) return fail("ILLEGAL_TARGET", m`You've made ${MAX_OFFERS_A_ROUND} offers this round. Let the others think.`);
    if (!a) return null;
    const t = s.players[a.targetId];
    if (!t || t.away || t.playerId === p.playerId || t.carriageIndex !== p.carriageIndex) return fail("ILLEGAL_TARGET", m`You can only trade with someone in your zone.`);
    if (!validOffer(s, p, a.give)) return fail("INVALID", m`You don't have everything you're offering.`);
    // what they carry is theirs to know: their side is checked when they accept, not now
    if (!wellFormed(a.want)) return fail("INVALID", m`That isn't a valid request.`);
    const empty = (o: TradeOffer) => !o.items.length && !o.fate && !o.parts?.length && !o.passes;
    if (empty(a.give) && empty(a.want)) return fail("INVALID", m`Offer or ask for something.`);
    return null;
  },
  hint: () => m`Free. Swap Fate, items, boat parts or passes with someone in your zone. They can refuse.`,
  apply: (ctx, p, a) => {
    const s = ctx.s;
    s.flags[`offers_${s.round}_${p.playerId}`] = (s.flags[`offers_${s.round}_${p.playerId}`] ?? 0) + 1;
    const t = s.players[a.targetId];
    log(ctx, m`${p.nickname} offers ${t.nickname} a trade.`, "TRADE", p.playerId);
    openWindow(ctx, {
      kind: "TRADE_OFFER",
      title: m`${p.nickname} offers a trade`,
      prompt: m`You get: ${describe(a.give)}. You give: ${describe(a.want)}.`,
      addressees: [t.playerId],
      options: [
        { id: "ACCEPT", label: m`Accept` },
        { id: "DECLINE", label: m`Decline` },
      ],
      defaultOptionId: "DECLINE",
      resume: { kind: "S2_TRADE", payload: { from: p.playerId, to: t.playerId, give: JSON.stringify(a.give), want: JSON.stringify(a.want) } },
      blocksTable: true,
      ownerId: p.playerId,
    });
  },
};

// completing a trade only moves the goods: no reward, trigger or contribution (nothing to farm)
onResume("S2_TRADE", (ctx, w, answers) => {
  const s = ctx.s;
  const payload = w.resume.payload as { from: string; to: string; give: string; want: string };
  const from = s.players[payload.from];
  const to = s.players[payload.to];
  const give = JSON.parse(payload.give) as TradeOffer;
  const want = JSON.parse(payload.want) as TradeOffer;
  if (answers[to.playerId] !== "ACCEPT") return log(ctx, m`${to.nickname} declines the trade.`, "TRADE", to.playerId);
  if (!validOffer(s, from, give) || !validOffer(s, to, want) || from.carriageIndex !== to.carriageIndex) {
    return log(ctx, m`The trade falls through: something changed hands in the meantime.`, "TRADE");
  }
  const move = (a: PlayerGameState, b: PlayerGameState, o: TradeOffer) => {
    for (const item of o.items) {
      a.items.splice(a.items.indexOf(item), 1);
      b.items.push(item);
    }
    const ha = s.city!.holdings[a.playerId].parts;
    for (const part of o.parts ?? []) {
      ha.splice(ha.indexOf(part), 1);
      s.city!.holdings[b.playerId].parts.push(part);
    }
    s.city!.holdings[a.playerId].passes -= o.passes ?? 0;
    s.city!.holdings[b.playerId].passes += o.passes ?? 0;
    spendFate(ctx, a, o.fate);
    b.fate += o.fate;
  };
  move(from, to, give);
  move(to, from, want);
  log(ctx, m`${from.nickname} and ${to.nickname} trade: ${describe(give)} for ${describe(want)}.`, "TRADE", from.playerId);
  cue(ctx, "TRADE", { from: from.playerId, to: to.playerId });
});

const SHARE_INTEL: Spec<Extract<GameAction, { type: "SHARE_INTEL" }>> = {
  targets: (s, p) => s.secrets[p.playerId].peeks.filter((x) => !s.flags[`shared_${x.id}`]).map((x) => x.id),
  check: (s, p, a) => {
    const open = s.secrets[p.playerId].peeks.filter((x) => !s.flags[`shared_${x.id}`]);
    if (!open.length) return fail("ILLEGAL_TARGET", m`You have nothing you haven't already shared.`);
    if (!a) return null;
    return open.some((x) => x.id === a.intelId) ? null : fail("ILLEGAL_TARGET", m`That isn't something you know, or you've already shared it.`);
  },
  hint: () => m`Free. Read out something you learned, word for word, to everyone.`,
  apply: (ctx, p, a) => {
    const intel = ctx.s.secrets[p.playerId].peeks.find((x) => x.id === a.intelId)!;
    ctx.s.flags[`shared_${intel.id}`] = 1;
    ctx.s.city!.shared.push({ from: p.playerId, text: intel.text, round: ctx.s.round });
    log(ctx, m`${p.nickname} shares what they know: ${intel.text}`, "INTEL", p.playerId);
    cue(ctx, "INTEL", { playerId: p.playerId });
  },
};

// ---- the boat ------------------------------------------------------------------------

const atPier = (p: PlayerGameState) => facilityAt(p.carriageIndex) === "HARBOUR";
const fitParts = (s: GameState, p: PlayerGameState) => s.city!.holdings[p.playerId].parts.filter((x) => !s.city!.boat.installed.includes(x));
const canWire = (s: GameState, p: PlayerGameState) => !s.city!.facilities.POWER_STATION.done && !s.city!.boat.batteryPower && p.items.filter((i) => i === "EMERGENCY_BATTERY").length >= 2;

const INSTALL: Spec<Extract<GameAction, { type: "INSTALL" }>> = {
  targets: (s, p) => [...fitParts(s, p), ...(canWire(s, p) ? ["BATTERIES"] : [])],
  check: (s, p, a) => {
    if (!atPier(p)) return fail("ILLEGAL_TARGET", m`Parts are fitted to the boat at the pier.`);
    if (!fitParts(s, p).length && !canWire(s, p)) return fail("ILLEGAL_TARGET", m`You carry nothing the boat still needs.`);
    if (!a) return null;
    if (a.part === "BATTERIES") return canWire(s, p) ? null : fail("ILLEGAL_TARGET", m`Wiring the pier needs two emergency batteries, and only while the power station is down.`);
    return fitParts(s, p).includes(a.part) ? null : fail("ILLEGAL_TARGET", m`You don't carry that part.`);
  },
  hint: () => m`Fit a boat part you carry, or wire two emergency batteries to power the pier.`,
  apply: (ctx, p, a) => {
    const city = ctx.s.city!;
    if (a.part === "BATTERIES") {
      for (let i = 0; i < 2; i++) p.items.splice(p.items.indexOf("EMERGENCY_BATTERY"), 1);
      city.boat.batteryPower = true;
      log(ctx, m`${p.nickname} wires two emergency batteries into the pier. The boat has power.`, "BOAT", p.playerId);
    } else {
      const h = city.holdings[p.playerId].parts;
      h.splice(h.indexOf(a.part), 1);
      city.boat.installed.push(a.part);
      if (a.part === "CHIP") city.boat.autoGate = true;
      else awardPass(ctx, `INSTALL:${a.part}`, p, m`the harbour crew, for the ${ref.part(a.part)}`);
      log(ctx, a.part === "CHIP" ? m`${p.nickname} fits the ${ref.part(a.part)}. The gate can now run from the boat.` : m`${p.nickname} fits the ${ref.part(a.part)} to the boat.`, "BOAT", p.playerId);
    }
    contribute(ctx, p, 2);
    cue(ctx, "INSTALL", { playerId: p.playerId, part: a.part });
    const missing = boatMissing(ctx.s);
    log(ctx, missing.length ? m`The boat still needs: ${list(missing)}.` : m`The boat has everything it needs.`, "BOAT");
  },
};

const REGISTER: Spec = {
  check: (s, p) => {
    if (!atPier(p)) return fail("ILLEGAL_TARGET", m`The evacuation office is at the pier.`);
    if (s.act < 2) return fail("ILLEGAL_TARGET", m`The evacuation office hasn't opened yet.`);
    if (!s.city!.passSources.includes("EXCHANGE")) return fail("ILLEGAL_TARGET", m`The evacuation office has no passes left.`);
    if (p.fate < 3 || !p.items.length) return fail("ILLEGAL_TARGET", m`A pass costs 3 Fate and one item.`);
    return null;
  },
  hint: () => m`3 Fate and one item for an evacuation pass, while the office has any.`,
  apply: (ctx, p) => {
    spendFate(ctx, p, 3);
    p.items.pop();
    awardPass(ctx, "EXCHANGE", p, m`the evacuation office`);
  },
};

let set: ActionSet | null = null;

/** Built on first use: the shared specs (actions.ts) may still be loading when this module is (import cycle). */
export function s02Actions(): ActionSet {
  set ??= {
    specs: { MOVE, SEARCH, INVESTIGATE, REPAIR, OPERATE, RESCUE, SALVAGE, HELP, STABILIZE, TRADE, SHARE_INTEL, INSTALL, REGISTER, USE_SKILL, USE_ITEM, END_TURN } as Partial<Record<GameActionType, Spec<never>>>,
    turnActions: ["MOVE", "SEARCH", "INVESTIGATE", "REPAIR", "OPERATE", "RESCUE", "SALVAGE", "HELP", "STABILIZE", "TRADE", "SHARE_INTEL", "INSTALL", "REGISTER", "USE_SKILL", "USE_ITEM", "END_TURN"],
    apCost: { ...AP_COST, TRADE: 0, OPERATE: 1, RESCUE: 1, SALVAGE: 1, SHARE_INTEL: 0, INSTALL: 1, REGISTER: 1 },
  };
  return set;
}


