// Scenario 03's time prediction. Before a major 1996 intervention is rolled,
// every other traveller with Fate may stake 1 on whether the 2026 record will
// change. Answers are secret until the window closes; the roll then starts
// exactly as it would have. The bet settles on what actually happened: a
// rewrite of the present (derivePresent03's diff) or none (a failed roll, or a
// decision that changes nothing). Right: the stake back plus 1. Wrong: lost.
import type { CausalNodeId03 } from "../../../shared/game/scenario03/nodes.ts";
import type { PlayerGameState, PlayerId, RollContext } from "../../../shared/game/state.ts";
import { m } from "../../../shared/i18n/msg.ts";
import type { Msg } from "../../../shared/i18n/types.ts";
import { cue, log, type Ctx } from "../context.ts";
import { startRoll } from "../dice.ts";
import { gainFate, present, spendFate } from "../players.ts";
import { onResume, openWindow } from "../windows.ts";

/** The decisions big enough to bet on. */
export const PREDICTABLE03: readonly CausalNodeId03[] = ["PROTOTYPE_CORE", "ACCIDENT_RECORD", "STAFF_EVACUATION"];

const flagKey = (id: PlayerId) => `s3_bet_${id}`;
const BET_CHANGE = 1;
const BET_SAME = 2;

function promptFor(name: string, nodeId: CausalNodeId03): Msg {
  if (nodeId === "PROTOTYPE_CORE") return m`${name} is about to act on the 1996 prototype core. Will the 2026 record change? Stake 1 Fate: right, you get it back with 1 more; wrong, it's gone.`;
  if (nodeId === "ACCIDENT_RECORD") return m`${name} is about to rewrite the 1996 accident record. Will the 2026 record change? Stake 1 Fate: right, you get it back with 1 more; wrong, it's gone.`;
  return m`${name} is about to decide the 1996 staff evacuation. Will the 2026 record change? Stake 1 Fate: right, you get it back with 1 more; wrong, it's gone.`;
}

/** Opens the prediction window, or starts the roll at once if nobody can bet. */
export function interveneWithPrediction03(ctx: Ctx, p: PlayerGameState, nodeId: CausalNodeId03, choiceId: string): void {
  const rc: RollContext = { kind: "S3_INTERVENE", carriageIndex: p.carriageIndex, scenario03: { nodeId, choiceId } };
  const bettors = PREDICTABLE03.includes(nodeId) ? present(ctx).filter((o) => o.playerId !== p.playerId && o.fate >= 1).map((o) => o.playerId) : [];
  if (!bettors.length) return void startRoll(ctx, p, "S3_INTERVENE", m`historical intervention`, rc);
  openWindow(ctx, {
    kind: "VOTE",
    title: m`Time prediction`,
    prompt: promptFor(p.nickname, nodeId),
    addressees: bettors,
    options: [
      { id: "CHANGE", label: m`It will change`, detail: m`Stake 1 Fate` },
      { id: "SAME", label: m`Nothing will change`, detail: m`Stake 1 Fate` },
      { id: "PASS", label: m`Stay out of it` },
    ],
    defaultOptionId: "PASS",
    resume: { kind: "S3_PREDICTION", payload: { actorId: p.playerId, nodeId, choiceId } },
    blocksTable: true,
    ownerId: p.playerId,
  });
}

onResume("S3_PREDICTION", (ctx, w, answers) => {
  const { actorId, nodeId, choiceId } = w.resume.payload as { actorId: PlayerId; nodeId: CausalNodeId03; choiceId: string };
  for (const [id, answer] of Object.entries(answers)) {
    if (answer === "PASS") continue;
    const bettor = ctx.s.players[id];
    if (!bettor || spendFate(ctx, bettor, 1) < 1) continue;
    ctx.s.flags[flagKey(id)] = answer === "CHANGE" ? BET_CHANGE : BET_SAME;
  }
  const staked = Object.values(answers).filter((a) => a !== "PASS").length;
  if (staked) log(ctx, staked === 1 ? m`1 traveller stakes Fate on what history will do.` : m`${staked} travellers stake Fate on what history will do.`, "S3_PREDICTION");
  const actor = ctx.s.players[actorId];
  startRoll(ctx, actor, "S3_INTERVENE", m`historical intervention`, { kind: "S3_INTERVENE", carriageIndex: actor.carriageIndex, scenario03: { nodeId, choiceId } });
});

/** Called once the intervention has resolved: `changed` is whether the 2026 present was rewritten. */
export function settlePredictions03(ctx: Ctx, changed: boolean): void {
  const s = ctx.s;
  const winners: PlayerId[] = [];
  for (const id of s.turnOrder) {
    const bet = s.flags[flagKey(id)];
    if (!bet) continue;
    delete s.flags[flagKey(id)];
    if ((bet === BET_CHANGE) === changed) {
      gainFate(ctx, s.players[id], 2, m`a correct time prediction`);
      winners.push(id);
    }
  }
  if (winners.length) cue(ctx, "S3_PREDICTION", { changed, winners });
}
