// A simple, sensible team of players for whole-run tests and the simulator
// (scripts/sim.ts): act 1 investigates carriages whose fragment is missing,
// act 2 repairs the nearest broken anchor, act 3 carries each key to its
// escape lock (a passenger holding two keys hands one to a keyless mate). Fate is spent only to turn a failure into a success; abilities,
// votes and events take their defaults; lost passengers steady themselves.
// "idle" players only end their turns and take every default. With
// `abilities`, players also use their active ability once its precondition
// holds (on sensible targets) and say yes to every reaction they're offered.
import { CARRIAGES, ESCAPE_LOCKS, isKeyItem, KEY_FOR_LOCK, LOCK_AT } from "../src/shared/game/scenario01/content.ts";
import type { GameAction } from "../src/shared/game/actions.ts";
import type { CarriageIdentity, GameState, ItemId, PlayerId } from "../src/shared/game/state.ts";
import type { CharacterId, MBTI, Zodiac } from "../src/shared/characters/types.ts";
import { getCharacterById } from "../src/shared/characters/roster/index.ts";
import { createGame } from "../src/server/engine/create.ts";
import { applyGameAction, startGame, tickGame } from "../src/server/engine/engine.ts";
import { activePlayerId } from "../src/server/engine/context.ts";
import { availableActions } from "../src/server/engine/actions.ts";
import { characterSkill } from "../src/shared/game/scenario01/skills.ts";

const ANCHOR_AT = { POWER: ["ENGINE_ROOM"], IDENTITY: ["ARCHIVE"], MEMORY: ["SLEEPER", "MIRROR"] } as const;

const where = (s: GameState, identity: CarriageIdentity) => s.carriages.find((c) => c.identity === identity)!.index;
const enabled = (s: GameState, id: PlayerId, type: GameAction["type"]) => availableActions(s, id).find((a) => a.type === type)?.enabled ?? false;

/** Where this player should be, and what to do on arrival. */
function goal(s: GameState, id: PlayerId): { at: number; action: "INVESTIGATE" | "REPAIR" } | null {
  const p = s.players[id];
  const nearest = (indexes: number[]) => indexes.sort((a, b) => Math.abs(a - p.carriageIndex) - Math.abs(b - p.carriageIndex))[0];
  const missingFragments = s.carriages.filter((c) => CARRIAGES[c.identity].fragment && !s.fragments.includes(CARRIAGES[c.identity].fragment!)).map((c) => c.index);
  if (s.act === 1 || (s.fragments.length < 3 && s.act === 2 && missingFragments.length)) {
    return missingFragments.length ? { at: nearest(missingFragments), action: "INVESTIGATE" } : null;
  }
  const broken = Object.values(s.anchors).filter((a) => !a.repaired && !(a.lastRepairedBy === id && s.turnOrder.length > 1));
  if (broken.length) return { at: nearest(broken.flatMap((a) => ANCHOR_AT[a.id].map((x) => where(s, x)))), action: "REPAIR" };
  if (s.act === 2) return missingFragments.length && s.fragments.length < 6 ? { at: nearest(missingFragments), action: "INVESTIGATE" } : null;
  if (s.fragments.length < 3) return missingFragments.length ? { at: nearest(missingFragments), action: "INVESTIGATE" } : null;
  // act 3: carry your key to its lock; with no key, go meet whoever holds two
  const thisRound = s.escape.round === s.round;
  const open = ESCAPE_LOCKS.filter((l) => !(thisRound && s.escape[l]));
  const mine = open.filter((l) => p.items.includes(KEY_FOR_LOCK[l]));
  if (mine.length) return { at: nearest(mine.map((l) => where(s, LOCK_AT[l]))), action: "REPAIR" };
  const hoarder = s.turnOrder.find((x) => x !== id && !s.players[x].away && s.players[x].items.filter(isKeyItem).length > 1);
  return hoarder ? { at: s.players[hoarder].carriageIndex, action: "INVESTIGATE" } : null;
}

/** A spare key and a keyless mate in the carriage: give the key away. */
function handOverKey(s: GameState, id: PlayerId): GameAction | null {
  const p = s.players[id];
  const keys = p.items.filter(isKeyItem);
  if (s.act !== 3 || keys.length < 2 || !enabled(s, id, "TRADE")) return null;
  const mate = s.turnOrder.find((x) => x !== id && !s.players[x].away && s.players[x].carriageIndex === p.carriageIndex && !s.players[x].items.some(isKeyItem));
  if (!mate) return null;
  // keep the key whose lock is closest
  const far = [...keys].sort((a, b) => Math.abs(where(s, LOCK_AT[lockOf(b)]) - p.carriageIndex) - Math.abs(where(s, LOCK_AT[lockOf(a)]) - p.carriageIndex))[0];
  return { type: "TRADE", targetId: mate, give: { items: [far], fate: 0 }, want: { items: [], fate: 0 } };
}
const lockOf = (key: ItemId) => ESCAPE_LOCKS.find((l) => KEY_FOR_LOCK[l] === key)!;

export function turn(s: GameState, id: PlayerId): GameAction {
  const p = s.players[id];
  if (p.lost && enabled(s, id, "STABILIZE")) return { type: "STABILIZE", mode: "SANITY" };
  const gift = handOverKey(s, id);
  if (gift) return gift;
  const g = goal(s, id);
  if (g && p.carriageIndex === g.at && enabled(s, id, g.action)) return { type: g.action };
  if (g && p.carriageIndex !== g.at && enabled(s, id, "MOVE")) {
    const to = p.carriageIndex + Math.sign(g.at - p.carriageIndex);
    if (!s.carriages[to]?.locked) return { type: "MOVE", toCarriage: to };
  }
  if (p.sanity <= 1 && enabled(s, id, "STABILIZE")) return { type: "STABILIZE", mode: "SANITY" };
  // nothing pressing: help someone here, dig for clues (Fate for the dice, core memories on a Perfect), or search
  const mate = s.turnOrder.find((x) => x !== id && !s.players[x].away && s.players[x].carriageIndex === p.carriageIndex && s.players[x].helpBonus === 0);
  if (mate && p.ap > 1 && enabled(s, id, "HELP")) return { type: "HELP", targetId: mate };
  if (enabled(s, id, "INVESTIGATE")) return { type: "INVESTIGATE" };
  if (enabled(s, id, "SEARCH")) return { type: "SEARCH" };
  return { type: "END_TURN" };
}

/** Answers a decision: Fate only when it turns a failure into a success, defaults otherwise. */
export function answer(s: GameState, id: PlayerId, w: GameState["pending"][number]): string {
  if (w.kind === "FATE_SPEND" && s.roll) {
    const need = Math.max(0, 4 - s.roll.final);
    return w.options.some((o) => o.id === String(need)) ? String(need) : "0";
  }
  // a gift (nothing asked in return) is always welcome
  if (w.kind === "TRADE_OFFER") {
    const want = JSON.parse(String(w.resume.payload?.want ?? "{}")) as { items?: unknown[]; fate?: number };
    if (!want.items?.length && !want.fate) return "ACCEPT";
  }
  void id;
  return w.defaultOptionId;
}

/** Sensible targets for an active ability: the poorest others first (they gain most from help). */
function skillTargets(s: GameState, id: PlayerId): PlayerId[] {
  const p = s.players[id];
  const rule = characterSkill(p.skill.borrowed ?? p.characterId).target;
  const others = s.turnOrder.filter((x) => x !== id && !s.players[x].away).sort((a, b) => s.players[a].fate - s.players[b].fate);
  if (rule === "OTHER_PLAYER") return others.slice(0, 1);
  if (rule === "ANY_PLAYER") return [others[0] ?? id];
  if (rule === "SAME_CARRIAGE") return others.filter((x) => s.players[x].carriageIndex === p.carriageIndex).slice(0, 1);
  if (rule === "TWO_PLAYERS") return [id, ...others].slice(0, 2);
  if (rule === "UP_TO_THREE_PLAYERS") return [id, ...others].slice(0, 3);
  return [];
}

/** Says yes to every ability moment (the first "use" option), otherwise answers like the team. */
function eager(s: GameState, id: PlayerId, w: GameState["pending"][number]): string {
  if (w.kind === "REACTION" || w.kind === "PASSIVE_CONFIRM") return w.options.find((o) => o.id.startsWith("USE") || (o.id !== "KEEP" && o.id !== "SKIP"))?.id ?? w.defaultOptionId;
  return answer(s, id, w);
}

export type RunOptions = {
  seed: string;
  chars: [Zodiac, MBTI][];
  strategy?: "team" | "idle";
  abilities?: boolean;
  /** Called after every state change (invariant checks, statistics). */
  onStep?: (s: GameState) => void;
};

export type RunInput = { kind: "ACT" | "TICK"; actor?: PlayerId; action?: GameAction; at: number };

/** Plays a whole run to its results (or the guard), returning the starting state and every input. */
export type RunResult = { initial: GameState; state: GameState; inputs: RunInput[]; turns: number; emptyTurns: number; usedAbility: CharacterId[] };

export function playRun(o: RunOptions): RunResult {
  const seats = o.chars.map(([zodiac, mbti], i) => ({ playerId: `p${i}`, nickname: `P${i}`, seat: i, zodiac, mbti }));
  let now = 1_800_000_000_000;
  const created = createGame("run", seats, o.seed, now);
  const initial = startGame(created, now).state;
  let s = initial;
  const inputs: RunInput[] = [];
  // turns where a player had action points but nothing worth doing
  let turns = 0;
  let emptyTurns = 0;
  let lastTurn = "";
  let tookAction = false;
  let apAtStart = 0;
  const triedSkill = new Set<string>();
  const triedItem = new Set<string>();
  const act = (id: PlayerId, a: GameAction) => {
    now += 500;
    s = applyGameAction(s, id, a, now).state;
    inputs.push({ kind: "ACT", actor: id, action: a, at: now });
    o.onStep?.(s);
  };
  const tick = () => {
    now += 1000;
    s = tickGame(s, now).state;
    inputs.push({ kind: "TICK", at: now });
    o.onStep?.(s);
  };
  for (let guard = 0; guard < 20_000 && s.phase !== "RESULTS"; guard++) {
    const w = s.pending.at(-1);
    if (w) {
      const waiting = w.addressees.filter((x) => !(x in w.answers));
      if (waiting.length) act(waiting[0], { type: "RESPOND", windowId: w.id, optionId: o.strategy === "idle" ? w.defaultOptionId : o.abilities ? eager(s, waiting[0], w) : answer(s, waiting[0], w) });
      else tick();
      continue;
    }
    if (s.sequence) {
      const ack = s.turnOrder.find((id) => !s.sequence!.acks.includes(id));
      if (ack) act(ack, { type: "ACK_SEQUENCE" });
      else tick();
      continue;
    }
    const id = activePlayerId(s);
    if (!id) {
      tick();
      continue;
    }
    if (o.strategy === "idle") {
      act(id, { type: "END_TURN" });
      continue;
    }
    const turnKey = `${s.round}:${s.activeIndex}`;
    if (turnKey !== lastTurn) {
      lastTurn = turnKey;
      turns++;
      tookAction = false;
      apAtStart = s.players[id].ap;
    }
    if (o.abilities && !triedSkill.has(turnKey) && enabled(s, id, "USE_SKILL")) {
      triedSkill.add(turnKey);
      try {
        act(id, { type: "USE_SKILL", targets: skillTargets(s, id) });
        continue;
      } catch {
        // its precondition doesn't hold yet; try again on a later turn
      }
    }
    if (o.abilities && !triedItem.has(turnKey) && s.players[id].items.length) {
      triedItem.add(turnKey);
      try {
        act(id, { type: "USE_ITEM", item: s.players[id].items[0], targetId: id });
        continue;
      } catch {
        // not usable now (no target, nothing to fix)
      }
    }
    const a = turn(s, id);
    // a turn with action points but no action the rules allow besides ending it
    if (a.type === "END_TURN" && !tookAction && apAtStart > 0 && !availableActions(s, id).some((x) => x.enabled && x.type !== "END_TURN" && x.apCost > 0)) emptyTurns++;
    if (a.type !== "END_TURN") tookAction = true;
    try {
      act(id, a);
    } catch {
      act(id, { type: "END_TURN" });
    }
  }
  const usedAbility = s.turnOrder.filter((id) => s.players[id].stats.skillUsedRound !== null).map((id) => s.players[id].characterId);
  return { initial, state: s, inputs, turns, emptyTurns, usedAbility };
}
