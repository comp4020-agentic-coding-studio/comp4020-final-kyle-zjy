import type { GameAction, TradeOffer } from "../../../shared/game/actions.ts";
import { ADJACENT03, OPENS_IN_ACT03, placeFromKey03, placeKey03, type RoomId03, type Year03 } from "../../../shared/game/scenario03/map.ts";
import { ITEMS03, ORDINARY_POOL03, PROTECTED_STORAGE03, RELIC_STORAGE03, type S03ItemId } from "../../../shared/game/scenario03/items.ts";
import { NODES03, derivePresent03, type CausalNodeId03 } from "../../../shared/game/scenario03/nodes.ts";
import { NPCS03 } from "../../../shared/game/scenario03/story.ts";
import type { GameState, PlayerGameState, Roll, RollPurpose } from "../../../shared/game/state.ts";
import { list, m, ref } from "../../../shared/i18n/msg.ts";
import { END_TURN, USE_SKILL, fail, helped, type Spec } from "../actions.ts";
import { cue, log, type Ctx } from "../context.ts";
import { applyEffects, changeCollapse, grantItem } from "../effects.ts";
import { addStatus, gainFate, loseSanity, removeStatus, spendFate, statusOf } from "../players.ts";
import { isSuccess, onRollOutcome, startRoll } from "../dice.ts";
import type { ActionSet } from "../scenario.ts";
import { onResume, openWindow } from "../windows.ts";
import { reveal03 } from "./story.ts";
import { recordTrace03 } from "./surveillance.ts";
import { resolveHistory03, routeTargets03 } from "./ending.ts";

export const canEnter03 = (s: GameState, room: RoomId03, year: Year03 = "Y2026"): boolean =>
  !(room === "POWER_ROOM" && year === "Y2026" && !s.temporal?.present.powerRoomExists) &&
  (s.act >= OPENS_IN_ACT03[room] || (room === "SECRET_ARCHIVE" && year === "Y2026" && !!s.temporal?.present.secretArchiveOpen));
export const moveTargets03 = (s: GameState, p: PlayerGameState): number[] => {
  const here = s.temporal!.locations[p.playerId];
  return ADJACENT03[here.roomId].filter((room) => canEnter03(s, room, here.year)).map((room) => placeKey03(room, here.year));
};

export function arrive03(ctx: Ctx, p: PlayerGameState, roomId: RoomId03, year: Year03): void {
  const from = p.carriageIndex;
  p.carriageIndex = placeKey03(roomId, year);
  ctx.s.temporal!.locations[p.playerId] = { roomId, year };
  const visit = `s3Visited${p.carriageIndex}`;
  if (!p.counters[visit]) {
    p.counters[visit] = 1;
    p.counters.zonesVisited = (p.counters.zonesVisited ?? 1) + 1;
  }
  cue(ctx, "MOVE", { playerId: p.playerId, from, to: p.carriageIndex });
}

type ActionRoll03 = Extract<RollPurpose, "S3_INVESTIGATE" | "S3_INTERVENE" | "S3_SPEAK" | "S3_SEARCH" | "S3_TIME_JUMP">;

function resolveActionRoll03(ctx: Ctx, p: PlayerGameState, roll: Roll, action: ActionRoll03): boolean {
  const success = isSuccess(roll.tier);
  cue(ctx, "S3_ACTION_RESOLVED", { playerId: p.playerId, action, tier: roll.tier, success });
  if (roll.tier === "DISASTER") loseSanity(ctx, p, 1, m`temporal action backlash`);
  if (roll.tier === "PERFECT") gainFate(ctx, p, 1, m`a precise temporal action`);
  if (!success) {
    const message = action === "S3_INVESTIGATE" ? m`The investigation yields no evidence. It can be tried again.`
      : action === "S3_INTERVENE" ? m`The causal change does not take hold. The decision remains open.`
        : action === "S3_SPEAK" ? m`The contact breaks off before sharing anything. You can try again.`
          : action === "S3_SEARCH" ? m`Nothing useful is recovered from the research cabinet. You can search again.`
            : m`The jump reaches the right room and year, but temporal transit is unstable.`;
    log(ctx, message, `ROLL_${roll.tier}`, p.playerId);
  } else if (action === "S3_TIME_JUMP") {
    log(ctx, m`The temporal jump is stable.`, `ROLL_${roll.tier}`, p.playerId);
  }
  return success;
}

const MOVE03: Spec<Extract<GameAction, { type: "MOVE" }>> = {
  targets: moveTargets03,
  check: (s, p, action) => {
    const targets = moveTargets03(s, p);
    if (!targets.length) return fail("ILLEGAL_TARGET", m`No adjacent room is open.`);
    if (!action) return null;
    if (!Number.isInteger(action.toCarriage) || !placeFromKey03(action.toCarriage)) return fail("INVALID", m`Choose a room.`);
    if (!targets.includes(action.toCarriage)) return fail("ILLEGAL_TARGET", m`You can only walk to an open adjacent room in your current year.`);
    return null;
  },
  hint: () => m`Walk one room in the same year.`,
  apply: (ctx, p, action) => {
    const place = placeFromKey03(action.toCarriage)!;
    arrive03(ctx, p, place.roomId, place.year);
    if (place.year === "Y1996") recordTrace03(ctx, p, { kind: "MOVEMENT", roomId: place.roomId });
    log(ctx, place.year === "Y1996" ? m`${p.nickname} moves through the 1996 facility.` : m`${p.nickname} moves through the 2026 Administration.`, "MOVE", p.playerId);
  },
};

const SCAN03: Spec<Extract<GameAction, { type: "SCAN" }>> = {
  check: (s, p, action) => {
    if (p.counters.s3ScannedRound === s.round) return fail("ILLEGAL_TARGET", m`You have already run a temporal scan this cycle.`);
    if (action && !["ARCHIVE", "FIELD", "STABILIZE"].includes(action.protocol)) return fail("INVALID", m`Choose a valid scan protocol.`);
    return null;
  },
  hint: () => m`Run one temporal scan this cycle. Disaster costs 1 Sanity; Perfect gains 1 Fate.`,
  apply: (ctx, p, action) => {
    p.counters.s3ScannedRound = ctx.s.round;
    const purpose = `S3_SCAN_${action.protocol}` as const;
    startRoll(ctx, p, purpose, action.protocol === "ARCHIVE" ? m`archive scan` : action.protocol === "FIELD" ? m`field scan` : m`stabilization scan`, { kind: purpose, carriageIndex: p.carriageIndex });
  },
};

for (const purpose of ["S3_SCAN_ARCHIVE", "S3_SCAN_FIELD", "S3_SCAN_STABILIZE"] as const) {
  onRollOutcome(purpose, (ctx, p, roll) => {
    if (roll.tier === "PERFECT") gainFate(ctx, p, 1, m`a precise temporal scan`);
    else if (roll.tier === "DISASTER") loseSanity(ctx, p, 1, m`temporal feedback`);
    if (!isSuccess(roll.tier)) return;
    if (purpose === "S3_SCAN_ARCHIVE") {
      const lead = archiveLead03(ctx.s, p);
      ctx.s.secrets[p.playerId].archiveLead03 = {
        round: ctx.s.round, roomId: lead?.roomId ?? null, year: lead?.year ?? null,
        evidenceId: roll.tier === "PERFECT" ? (lead?.evidenceId ?? null) : null,
      };
      cue(ctx, "S3_ARCHIVE_LEAD", { playerId: p.playerId });
    } else if (purpose === "S3_SCAN_FIELD") {
      // kept until a rolled field action uses it (dice.ts BONUS_STATUS), never expired by a turn or cycle ending
      if (!statusOf(p, "FIELD_FOCUS")) addStatus(ctx, p, {
        kind: "FIELD_FOCUS", polarity: "POSITIVE", sourceId: "SYSTEM",
        expiresAtRound: null, hidden: false, ordinary: false, value: 2,
      });
      cue(ctx, "S3_SCAN_PROTOCOL", { playerId: p.playerId, protocol: "FIELD" });
    } else {
      if (!statusOf(p, "TEMPORAL_ALIGNMENT")) addStatus(ctx, p, {
        kind: "TEMPORAL_ALIGNMENT", polarity: "POSITIVE", sourceId: "SYSTEM",
        expiresAtRound: null, hidden: false, ordinary: false,
      });
      cue(ctx, "S3_SCAN_PROTOCOL", { playerId: p.playerId, protocol: "STABILIZE" });
    }
  });
}

const HELP03: Spec<Extract<GameAction, { type: "HELP" }>> = {
  targets: (s, p) => Object.values(s.players).filter((other) => other.playerId !== p.playerId && !other.away && other.carriageIndex === p.carriageIndex && other.helpBonus < 2).map((other) => other.playerId),
  check: (s, p, action) => {
    const targets = HELP03.targets!(s, p);
    if (!targets.length) return fail("ILLEGAL_TARGET", m`No teammate here can receive scan help.`);
    if (action && !targets.includes(action.targetId)) return fail("ILLEGAL_TARGET", m`Help a teammate in the same room and year.`);
    return null;
  },
  hint: () => m`Give a teammate here +1 on their next roll, up to +2.`,
  apply: (ctx, p, action) => {
    const other = ctx.s.players[action.targetId];
    other.helpBonus = Math.min(2, other.helpBonus + 1);
    other.helpFrom.push(p.playerId);
    p.stats.helpsGiven++;
    other.stats.helpsReceived++;
    log(ctx, m`${p.nickname} helps ${other.nickname} prepare their next roll.`, "HELP", p.playerId);
    cue(ctx, "HELP", { from: p.playerId, to: other.playerId, bonus: other.helpBonus });
    helped(ctx, p.playerId, other.playerId);
  },
};

const TIME_JUMP: Spec<Extract<GameAction, { type: "TIME_JUMP" }>> = {
  check: (s, p) => {
    const here = s.temporal!.locations[p.playerId];
    if (!canEnter03(s, here.roomId, here.year === "Y1996" ? "Y2026" : "Y1996")) return fail("ILLEGAL_TARGET", m`This room cannot receive a time jump.`);
    return null;
  },
  hint: (_s, p) => statusOf(p, "TEMPORAL_ALIGNMENT")
    ? m`Jump to the other year in this same room. Temporal Alignment reduces the cost to 1 action point.`
    : m`Jump to the other year in this same room. Costs 2 action points.`,
  apply: (ctx, p) => {
    const here = ctx.s.temporal!.locations[p.playerId];
    const year = here.year === "Y1996" ? "Y2026" : "Y1996";
    for (const item of Object.values(ctx.s.temporal!.storedItems)) {
      if (item.ownerId !== p.playerId) continue;
      item.status = year === "Y1996" ? "HELD_1996" : "HELD_2026";
    }
    arrive03(ctx, p, here.roomId, year);
    removeStatus(p, "TEMPORAL_ALIGNMENT");
    log(ctx, year === "Y1996" ? m`${p.nickname} jumps to 1996 without changing rooms.` : m`${p.nickname} jumps to 2026 without changing rooms.`, "MOVE", p.playerId);
    cue(ctx, "TIME_JUMP", { playerId: p.playerId, roomId: here.roomId, year });
    if (year === "Y1996") {
      recordTrace03(ctx, p, { kind: "ARRIVAL", roomId: here.roomId });
      reveal03(ctx, "FIRST_JUMP");
    }
    if (ctx.s.act >= 3 && ctx.s.collapse >= 6) startRoll(ctx, p, "S3_TIME_JUMP", m`temporal jump stability`, { kind: "S3_TIME_JUMP", carriageIndex: p.carriageIndex });
  },
};

onRollOutcome("S3_TIME_JUMP", (ctx, p, roll) => {
  resolveActionRoll03(ctx, p, roll, "S3_TIME_JUMP");
  if (roll.tier !== "FAIL") return;
  const lag = statusOf(p, "TEMPORAL_LAG");
  if (lag) lag.expiresAtRound = Math.max(lag.expiresAtRound ?? 0, ctx.s.round + 1);
  else addStatus(ctx, p, {
    kind: "TEMPORAL_LAG", polarity: "NEGATIVE", sourceId: "SYSTEM",
    expiresAtRound: ctx.s.round + 1, hidden: false, ordinary: false,
  });
});

const SEARCH03: Spec<Extract<GameAction, { type: "SEARCH" }>> = {
  check: (s, p) => {
    const here = s.temporal!.locations[p.playerId];
    if (here.year !== "Y2026" || here.roomId !== "RESEARCH_WING") return fail("ILLEGAL_TARGET", m`Search for supplies in the 2026 Research Wing.`);
    if (p.counters.s03Searched) return fail("ILLEGAL_TARGET", m`You already searched this supply cabinet.`);
    return null;
  },
  hint: () => m`Search the research cabinet. A successful roll finds one supply.`,
  apply: (ctx, p) => {
    startRoll(ctx, p, "S3_SEARCH", m`research cabinet search`, { kind: "S3_SEARCH", carriageIndex: p.carriageIndex });
  },
};

onRollOutcome("S3_SEARCH", (ctx, p, roll) => {
  if (!resolveActionRoll03(ctx, p, roll, "S3_SEARCH")) return;
  p.counters.s03Searched = 1;
  if (roll.tier !== "PERFECT") {
    grantItem(ctx, p.playerId, "ANY", m`the research cabinet`);
    return;
  }
  openWindow(ctx, {
    kind: "SUPPLY_CHOICE", title: m`Choose a supply`, prompt: m`Your precise search found both supplies. Take one.`,
    addressees: [p.playerId], options: ORDINARY_POOL03.map((id) => ({ id, label: ref.item(id) })),
    defaultOptionId: ORDINARY_POOL03[0], resume: { kind: "S3_SEARCH_SUPPLY" }, blocksTable: true, ownerId: p.playerId,
  });
});

onResume("S3_SEARCH_SUPPLY", (ctx, w, answers) => {
  const id = answers[w.ownerId!] as S03ItemId;
  const p = ctx.s.players[w.ownerId!];
  if (!p || !ORDINARY_POOL03.includes(id)) return;
  p.items.push(id);
  cue(ctx, "ITEM", { playerId: p.playerId, item: id });
  log(ctx, m`${p.nickname} takes ${ref.item(id)} from the research cabinet.`, "ITEM", p.playerId);
});

const USE_ITEM03: Spec<Extract<GameAction, { type: "USE_ITEM" }>> = {
  targets: (_s, p) => [...new Set(p.items.filter((id) => id === "PHASE_BATTERY" || id === "SEDATIVE03"))],
  check: (_s, p, action) => {
    if (!USE_ITEM03.targets!(_s, p).length) return fail("ILLEGAL_TARGET", m`You have no usable supply.`);
    if (!action) return null;
    if (!p.items.includes(action.item) || (action.item !== "PHASE_BATTERY" && action.item !== "SEDATIVE03")) return fail("ILLEGAL_TARGET", m`That supply is unavailable.`);
    return null;
  },
  hint: () => m`Use one ordinary supply without spending action points.`,
  apply: (ctx, p, action) => {
    const itemId = action.item as S03ItemId;
    p.items.splice(p.items.indexOf(itemId), 1);
    applyEffects(ctx, ITEMS03[itemId].effects, { ownerId: p.playerId, targets: [p.playerId], label: ref.item(itemId) });
    log(ctx, m`${p.nickname} uses ${ref.item(itemId)}.`, "ITEM", p.playerId);
  },
};

const PICK_UP03: Spec<Extract<GameAction, { type: "PICK_UP" }>> = {
  targets: (s, p) => {
    const here = s.temporal!.locations[p.playerId];
    return here.year === "Y2026" ? Object.values(s.temporal!.storedItems).filter((item) => item.roomId === here.roomId && (item.status === "AVAILABLE_2026" || item.status === "STORED")).map((item) => item.instanceId) : [];
  },
  check: (s, p, action) => {
    const targets = PICK_UP03.targets!(s, p);
    if (!targets.length) return fail("ILLEGAL_TARGET", m`No numbered relic is available here in 2026.`);
    if (action && !targets.includes(action.instanceId)) return fail("ILLEGAL_TARGET", m`That relic is not available here.`);
    return null;
  },
  hint: () => m`Pick up one numbered relic from this room.`,
  apply: (ctx, p, action) => {
    const item = ctx.s.temporal!.storedItems[action.instanceId];
    item.status = "HELD_2026";
    item.ownerId = p.playerId;
    cue(ctx, "S3_ITEM_PICKUP", { instanceId: item.instanceId, roomId: item.roomId, playerId: p.playerId });
    log(ctx, m`${p.nickname} picks up ${ref.item(item.itemId)}.`, "ITEM", p.playerId);
    if (item.bootstrapOwnerId) reveal03(ctx, "BOOTSTRAP_TRACE");
  },
};

const STORE_ITEM03: Spec<Extract<GameAction, { type: "STORE_ITEM" }>> = {
  targets: (s, p) => {
    const here = s.temporal!.locations[p.playerId];
    return here.year === "Y1996" && PROTECTED_STORAGE03[here.roomId] ? Object.values(s.temporal!.storedItems).filter((item) => item.ownerId === p.playerId && item.status === "HELD_1996" && RELIC_STORAGE03[item.itemId] === here.roomId && (!item.bootstrapOwnerId || item.bootstrapOwnerId === p.playerId)).map((item) => item.instanceId) : [];
  },
  check: (s, p, action) => {
    const targets = STORE_ITEM03.targets!(s, p);
    if (!targets.length) return fail("ILLEGAL_TARGET", m`No relic can be sealed in this 1996 storage facility.`);
    if (action && !targets.includes(action.instanceId)) return fail("ILLEGAL_TARGET", m`That relic needs its assigned keeper and protected 1996 storage room.`);
    return null;
  },
  hint: () => m`Seal a numbered relic in its designated 1996 storage facility.`,
  apply: (ctx, p, action) => {
    const temporal = ctx.s.temporal!;
    const item = temporal.storedItems[action.instanceId];
    item.status = "STORED";
    item.ownerId = null;
    item.storedBy = p.playerId;
    item.storedRound = ctx.s.round;
    const obligation = temporal.bootstrap.find((entry) => entry.instanceId === item.instanceId);
    if (obligation) obligation.placedBy = p.playerId;
    recordTrace03(ctx, p, { kind: "RELIC_STORAGE", roomId: temporal.locations[p.playerId].roomId, instanceId: item.instanceId });
    cue(ctx, "S3_ITEM_STORED", { instanceId: item.instanceId, roomId: item.roomId, playerId: p.playerId });
    log(ctx, m`${p.nickname} seals ${ref.item(item.itemId)} in 1996.`, "ITEM", p.playerId);
  },
};

const emptyOffer03 = (offer: TradeOffer): boolean => !offer.items.length && !offer.fate && !(offer.instances?.length);
const wellFormedOffer03 = (offer: TradeOffer): boolean =>
  !!offer && Array.isArray(offer.items) && Array.isArray(offer.instances ?? []) &&
  offer.parts === undefined && offer.passes === undefined &&
  Number.isInteger(offer.fate) && offer.fate >= 0 &&
  offer.items.every((item) => ORDINARY_POOL03.includes(item as S03ItemId)) && (offer.instances ?? []).every((id) => typeof id === "string");

function validOffer03(s: GameState, p: PlayerGameState, offer: TradeOffer): boolean {
  if (!wellFormedOffer03(offer) || offer.fate > p.fate) return false;
  const ordinary = [...p.items];
  for (const item of offer.items) {
    const index = ordinary.indexOf(item);
    if (index < 0) return false;
    ordinary.splice(index, 1);
  }
  const here = s.temporal!.locations[p.playerId];
  const seen = new Set<string>();
  for (const id of offer.instances ?? []) {
    if (seen.has(id)) return false;
    seen.add(id);
    const instance = s.temporal!.storedItems[id];
    if (!instance || instance.ownerId !== p.playerId || instance.status !== (here.year === "Y1996" ? "HELD_1996" : "HELD_2026")) return false;
  }
  return true;
}

const describeOffer03 = (s: GameState, offer: TradeOffer) => list([
  ...offer.items.map((item) => ref.item(item)),
  ...(offer.instances ?? []).map((id) => ref.item(s.temporal!.storedItems[id].itemId)),
  ...(offer.fate ? [m`${offer.fate} Fate`] : []),
]);

const TRADE03: Spec<Extract<GameAction, { type: "TRADE" }>> = {
  targets: (s, p) => Object.values(s.players).filter((other) => other.playerId !== p.playerId && !other.away && other.carriageIndex === p.carriageIndex).map((other) => other.playerId),
  check: (s, p, action) => {
    const targets = TRADE03.targets!(s, p);
    if (!targets.length) return fail("ILLEGAL_TARGET", m`No teammate is with you in this year and room.`);
    if (!action) return null;
    if (!targets.includes(action.targetId)) return fail("ILLEGAL_TARGET", m`You can only offer a relic to a teammate in the same year and room.`);
    if (!validOffer03(s, p, action.give)) return fail("INVALID", m`You do not hold everything in this offer.`);
    if (!wellFormedOffer03(action.want) || !emptyOffer03(action.want)) return fail("INVALID", m`This transfer cannot request hidden belongings.`);
    if (emptyOffer03(action.give)) return fail("INVALID", m`Choose something to offer.`);
    return null;
  },
  hint: () => m`Offer a numbered relic, ordinary supply or Fate to a teammate here. They may decline.`,
  apply: (ctx, p, action) => {
    const recipient = ctx.s.players[action.targetId];
    openWindow(ctx, {
      kind: "TRADE_OFFER",
      title: m`${p.nickname} offers a transfer`,
      prompt: m`${p.nickname} offers ${describeOffer03(ctx.s, action.give)} to ${recipient.nickname}. Accept?`,
      addressees: [recipient.playerId],
      options: [{ id: "ACCEPT", label: m`Accept` }, { id: "DECLINE", label: m`Decline` }],
      defaultOptionId: "DECLINE",
      resume: { kind: "S3_TRADE", payload: { from: p.playerId, to: recipient.playerId, give: JSON.stringify(action.give) } },
      blocksTable: true,
      ownerId: p.playerId,
    });
  },
};

onResume("S3_TRADE", (ctx, window, answers) => {
  const payload = window.resume.payload as { from: string; to: string; give: string };
  const from = ctx.s.players[payload.from];
  const to = ctx.s.players[payload.to];
  const give = JSON.parse(payload.give) as TradeOffer;
  if (answers[payload.to] !== "ACCEPT") return log(ctx, m`The relic transfer is declined.`, "TRADE", payload.to);
  if (!from || !to || from.carriageIndex !== to.carriageIndex || !validOffer03(ctx.s, from, give)) return log(ctx, m`The relic transfer can no longer be completed.`, "TRADE");
  for (const item of give.items) {
    from.items.splice(from.items.indexOf(item), 1);
    to.items.push(item);
  }
  for (const id of give.instances ?? []) ctx.s.temporal!.storedItems[id].ownerId = to.playerId;
  spendFate(ctx, from, give.fate);
  to.fate += give.fate;
  cue(ctx, "S3_ITEM_TRADE", { from: from.playerId, to: to.playerId, instances: give.instances ?? [] });
  log(ctx, m`${from.nickname} transfers ${describeOffer03(ctx.s, give)} to ${to.nickname}.`, "TRADE", from.playerId);
});

function investigation03(s: GameState, p: PlayerGameState, here = s.temporal!.locations[p.playerId], act = s.act): string | null {
  const evidence = s.temporal!.evidence[p.playerId];
  const has = (id: string) => evidence.includes(id);
  if (here.year === "Y2026" && here.roomId === "ARCHIVES") {
    if (!evidence.some((id) => id.startsWith("CASE_FILE_"))) return `CASE_FILE_${s.temporal!.present.caseFile}`;
    return act >= 3 && !has("FOUNDING_CHARTER") ? "FOUNDING_CHARTER" : null;
  }
  if (act >= 2 && here.year === "Y2026" && here.roomId === "DIRECTOR_OFFICE") {
    if (!has("SURVEILLANCE_TAPE")) return "SURVEILLANCE_TAPE";
    return act >= 3 && !has("FOUNDER_DISCREPANCY") ? "FOUNDER_DISCREPANCY" : null;
  }
  if (act >= 2 && here.year === "Y1996" && here.roomId === "DIRECTOR_OFFICE") {
    if (!has("ACCESS_LEDGER")) return "ACCESS_LEDGER";
    return act >= 3 && !has("JI_MARGIN_NOTE") ? "JI_MARGIN_NOTE" : null;
  }
  if (act >= 2 && here.year === "Y1996" && here.roomId === "MAIN_LAB") return has("PROTOTYPE_LOG") ? null : "PROTOTYPE_LOG";
  if (act >= 3 && here.year === "Y2026" && here.roomId === "MAIN_LAB") return has("STAFF_DISCREPANCY") ? null : "STAFF_DISCREPANCY";
  if (act >= 3 && here.year === "Y2026" && here.roomId === "PROTOTYPE_ROOM") return has("PROTOTYPE_DISCREPANCY") ? null : "PROTOTYPE_DISCREPANCY";
  return null;
}

const ARCHIVE_DIRECTIONS03: { roomId: RoomId03; year: Year03 }[] = [
  { roomId: "ARCHIVES", year: "Y2026" },
  { roomId: "DIRECTOR_OFFICE", year: "Y2026" },
  { roomId: "DIRECTOR_OFFICE", year: "Y1996" },
  { roomId: "MAIN_LAB", year: "Y1996" },
  { roomId: "MAIN_LAB", year: "Y2026" },
  { roomId: "PROTOTYPE_ROOM", year: "Y2026" },
];

function archiveLead03(s: GameState, p: PlayerGameState): { roomId: RoomId03; year: Year03; evidenceId: string } | null {
  for (const place of ARCHIVE_DIRECTIONS03) {
    const evidenceId = investigation03(s, p, place, 4);
    if (evidenceId) return { ...place, evidenceId };
  }
  return null;
}

const INVESTIGATE03: Spec<Extract<GameAction, { type: "INVESTIGATE" }>> = {
  check: (s, p) => investigation03(s, p) ? null : fail("ILLEGAL_TARGET", m`No new investigation is available in this room and year.`),
  hint: (s, p) => {
    const id = investigation03(s, p);
    if (id?.startsWith("CASE_FILE_")) return m`Read the sealed case file privately.`;
    if (id === "SURVEILLANCE_TAPE") return m`Review the recovered surveillance tape.`;
    if (id === "ACCESS_LEDGER") return m`Examine the 1996 access ledger.`;
    if (id === "PROTOTYPE_LOG") return m`Examine the 1996 prototype telemetry.`;
    if (id === "FOUNDING_CHARTER") return m`Read the Administration's founding charter.`;
    if (id === "FOUNDER_DISCREPANCY") return m`Compare Ji Linchuan's death entry with its supporting evidence.`;
    if (id === "JI_MARGIN_NOTE") return m`Read Ji Linchuan's margin note.`;
    if (id === "STAFF_DISCREPANCY") return m`Audit the staff casualty register.`;
    if (id === "PROTOTYPE_DISCREPANCY") return m`Compare the lost prototype with later machine designs.`;
    return undefined;
  },
  apply: (ctx, p) => {
    const id = investigation03(ctx.s, p)!;
    startRoll(ctx, p, "S3_INVESTIGATE", m`incident investigation`, { kind: "S3_INVESTIGATE", carriageIndex: p.carriageIndex, scenario03: { evidenceId: id } });
  },
};

onRollOutcome("S3_INVESTIGATE", (ctx, p, roll, rc) => {
  if (!resolveActionRoll03(ctx, p, roll, "S3_INVESTIGATE")) return;
  completeInvestigation03(ctx, p, rc.scenario03!.evidenceId!);
});

function completeInvestigation03(ctx: Ctx, p: PlayerGameState, id: string): void {
  const temporal = ctx.s.temporal!;
  const here = temporal.locations[p.playerId];
  temporal.evidence[p.playerId].push(id);
  p.stats.fragmentsFound++;
  if (here.year === "Y1996") recordTrace03(ctx, p, { kind: "INVESTIGATION", roomId: here.roomId, evidenceId: id });
  if (id.startsWith("CASE_FILE_")) {
    log(ctx, m`${p.nickname} examines a sealed case file.`, "INVESTIGATE", p.playerId);
    reveal03(ctx, "OFFICIAL_FILE");
  } else if (id === "SURVEILLANCE_TAPE") {
    temporal.surveillanceReviewed = true;
    reveal03(ctx, "SURVEILLANCE_FOUND");
  } else if (id === "ACCESS_LEDGER") {
    temporal.accessLedgerReviewed = true;
    reveal03(ctx, "ACCESS_LEDGER_FOUND");
  } else if (id === "PROTOTYPE_LOG") {
    temporal.prototypeLogReviewed = true;
    reveal03(ctx, "PROTOTYPE_LOG_FOUND");
  } else if (id === "FOUNDING_CHARTER") reveal03(ctx, "FOUNDING_PARADOX");
  else if (id === "JI_MARGIN_NOTE") reveal03(ctx, "JI_NOTE");
  else {
    const fact = id === "FOUNDER_DISCREPANCY" ? "FOUNDER" : id === "STAFF_DISCREPANCY" ? "STAFF" : "PROTOTYPE";
    if (!temporal.discoveredFacts.includes(fact)) temporal.discoveredFacts.push(fact);
    reveal03(ctx, fact === "FOUNDER" ? "FOUNDER_CLUE" : fact === "STAFF" ? "STAFF_CLUE" : "PROTOTYPE_CLUE");
  }
}

const INTERACT_NPC03: Spec<Extract<GameAction, { type: "INTERACT_NPC" }>> = {
  targets: (s, p) => {
    const here = s.temporal!.locations[p.playerId];
    return Object.entries(NPCS03).filter(([id, npc]) => npc.roomId === here.roomId && npc.year === here.year && s.act >= npc.minAct && !s.temporal!.evidence[p.playerId].includes(id === "ZERO" ? "ZERO_TRANSCRIPT" : "ARCHIVIST_NOTE")).map(([id]) => id);
  },
  check: (s, p, action) => {
    const targets = INTERACT_NPC03.targets!(s, p);
    if (!targets.length) return fail("ILLEGAL_TARGET", m`No new testimony is available here.`);
    if (action && !targets.includes(action.npcId)) return fail("ILLEGAL_TARGET", m`That person is not available here.`);
    return null;
  },
  hint: (s, p) => s.temporal!.locations[p.playerId].roomId === "CENTRAL_HALL" && s.act >= 3 ? m`Ask Administrator ZERO why Incident Zero must happen.` : m`Ask Archivist 00 about the 1996 access record.`,
  apply: (ctx, p, action) => {
    startRoll(ctx, p, "S3_SPEAK", m`contact conversation`, { kind: "S3_SPEAK", carriageIndex: p.carriageIndex, scenario03: { npcId: action.npcId } });
  },
};

onRollOutcome("S3_SPEAK", (ctx, p, roll, rc) => {
  if (!resolveActionRoll03(ctx, p, roll, "S3_SPEAK")) return;
  const id = rc.scenario03!.npcId!;
  if (id === "ZERO") {
    ctx.s.temporal!.evidence[p.playerId].push("ZERO_TRANSCRIPT");
    reveal03(ctx, "ZERO_CONSULTED");
  } else {
    ctx.s.temporal!.evidence[p.playerId].push("ARCHIVIST_NOTE");
    reveal03(ctx, "ARCHIVIST_CONTACT");
  }
});

const INTERVENE03: Spec<Extract<GameAction, { type: "INTERVENE" }>> = {
  targets: (s, p) => {
    const here = s.temporal!.locations[p.playerId];
    return here.year === "Y1996"
      ? (Object.keys(NODES03) as CausalNodeId03[]).filter((id) => NODES03[id].roomId === here.roomId && s.act >= NODES03[id].minAct && !s.temporal!.interventions.some((i) => i.nodeId === id))
      : [];
  },
  check: (s, p, action) => {
    const targets = INTERVENE03.targets!(s, p) as CausalNodeId03[];
    if (!targets.length) return fail("ILLEGAL_TARGET", m`No unresolved causal decision is here in 1996.`);
    if (!action) return null;
    if (!Object.hasOwn(NODES03, action.nodeId) || !targets.includes(action.nodeId)) return fail("ILLEGAL_TARGET", m`That causal decision is unavailable here.`);
    if (!NODES03[action.nodeId].choices.includes(action.choiceId)) return fail("INVALID", m`Choose a valid intervention.`);
    return null;
  },
  hint: () => m`Attempt a 1996 decision. Success changes its 2026 consequences.`,
  apply: (ctx, p, action) => {
    startRoll(ctx, p, "S3_INTERVENE", m`historical intervention`, { kind: "S3_INTERVENE", carriageIndex: p.carriageIndex, scenario03: { nodeId: action.nodeId, choiceId: action.choiceId } });
  },
};

onRollOutcome("S3_INTERVENE", (ctx, p, roll, rc) => {
  if (!resolveActionRoll03(ctx, p, roll, "S3_INTERVENE")) return;
  completeIntervention03(ctx, p, rc.scenario03!.nodeId!, rc.scenario03!.choiceId!);
});

function completeIntervention03(ctx: Ctx, p: PlayerGameState, nodeId: CausalNodeId03, choiceId: string): void {
  const temporal = ctx.s.temporal!;
  const before = { ...temporal.present };
  const here = temporal.locations[p.playerId];
  temporal.interventions.push({ seq: temporal.interventions.length + 1, nodeId, choiceId, actorId: p.playerId, round: ctx.s.round, roomId: here.roomId, year: "Y1996" });
  p.stats.repairs++;
  recordTrace03(ctx, p, { kind: "INTERVENTION", roomId: here.roomId, nodeId, choiceId });
  temporal.present = derivePresent03(temporal.baselinePresent, temporal.interventions);
  if (nodeId === "WORKER" && choiceId === "SAVE") {
    temporal.storedItems["relic-badge"] = { instanceId: "relic-badge", itemId: "OLD_BADGE", roomId: "RESEARCH_WING", status: "AVAILABLE_2026", ownerId: null, bootstrapOwnerId: null, storedBy: null, storedRound: null };
  }
  const changed = JSON.stringify(before) !== JSON.stringify(temporal.present);
  if (changed) {
    temporal.causalRevision++;
    cue(ctx, "S3_CAUSAL_REWRITE", { revision: temporal.causalRevision, nodeId, roomId: here.roomId, year: "Y2026", before, after: temporal.present });
    log(ctx, m`${p.nickname} changes a 1996 decision. The 2026 record is rewritten.`, "STORY", p.playerId);
    reveal03(ctx, "FIRST_REWRITE");
    if (nodeId === "PROTOTYPE_CORE" && choiceId === "SHUT_DOWN") {
      reveal03(ctx, "PREVENTION_ATTEMPT");
      changeCollapse(ctx, 1, m`the attempted shutdown destabilizes the Administration's history`);
    }
    if (before.administrationIntegrity === "FADING" && temporal.present.administrationIntegrity === "STABLE") {
      changeCollapse(ctx, -1, m`the controlled accident restores the Administration's history`);
    }
  } else {
    cue(ctx, "S3_CAUSAL_DECISION", { nodeId, roomId: here.roomId, year: "Y1996", changed: false });
    log(ctx, m`${p.nickname} preserves the 1996 record.`, "STORY", p.playerId);
  }
}

const RESOLVE_HISTORY03: Spec<Extract<GameAction, { type: "RESOLVE_HISTORY" }>> = {
  targets: (s, p) => {
    const here = s.temporal!.locations[p.playerId];
    return here.year === "Y1996" && here.roomId === "ARCHIVES" ? routeTargets03(s) : [];
  },
  check: (s, p, action) => {
    if (s.act < 4) return fail("ILLEGAL_TARGET", m`The final history is not open yet.`);
    const here = s.temporal!.locations[p.playerId];
    if (here.year !== "Y1996" || here.roomId !== "ARCHIVES") return fail("ILLEGAL_TARGET", m`Resolve history at the 1996 Archives.`);
    if (!action) return routeTargets03(s).length ? null : fail("ILLEGAL_TARGET", m`No history route has all its required actions yet.`);
    if (!routeTargets03(s).includes(action.route)) return fail("ILLEGAL_TARGET", m`That history route is not supported by the recorded actions.`);
    return null;
  },
  hint: () => m`Commit one history supported by the 1996 record and the relic sources.`,
  apply: (ctx, _p, action) => resolveHistory03(ctx, action.route),
};

export function s03Actions(): ActionSet {
  return {
    specs: { MOVE: MOVE03, TIME_JUMP, SCAN: SCAN03, HELP: HELP03, USE_SKILL, SEARCH: SEARCH03, USE_ITEM: USE_ITEM03, PICK_UP: PICK_UP03, STORE_ITEM: STORE_ITEM03, TRADE: TRADE03, INVESTIGATE: INVESTIGATE03, INTERACT_NPC: INTERACT_NPC03, INTERVENE: INTERVENE03, RESOLVE_HISTORY: RESOLVE_HISTORY03, END_TURN },
    turnActions: ["MOVE", "TIME_JUMP", "SCAN", "HELP", "USE_SKILL", "SEARCH", "PICK_UP", "STORE_ITEM", "TRADE", "USE_ITEM", "INVESTIGATE", "INTERACT_NPC", "INTERVENE", "RESOLVE_HISTORY", "END_TURN"],
    apCost: { MOVE: 1, TIME_JUMP: 2, SCAN: 1, HELP: 1, USE_SKILL: 0, SEARCH: 1, PICK_UP: 1, STORE_ITEM: 1, TRADE: 0, USE_ITEM: 0, INVESTIGATE: 1, INTERACT_NPC: 1, INTERVENE: 1, RESOLVE_HISTORY: 1, END_TURN: 0 },
    costFor: (_s, p, type) => type === "TIME_JUMP" && statusOf(p, "TEMPORAL_ALIGNMENT") ? 1 : undefined,
  };
}
