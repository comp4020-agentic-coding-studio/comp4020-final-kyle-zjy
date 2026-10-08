// Scenario 01 (00:17, train N13) as the engine's hooks. The rules themselves
// stay in the modules that already hold them (beats, inspector, outcomes,
// ending, actions); this file only says which one runs at each step.
import { AP_PER_ROUND, AP_WHEN_LOST, ITEM_IDS, SCENARIO } from "../../../shared/game/scenario01/content.ts";
import { m } from "../../../shared/i18n/msg.ts";
import { S01_ACTIONS } from "../actions.ts";
import { onRoundStart, scriptedRoundEvent } from "../beats.ts";
import { log, cue } from "../context.ts";
import { createScenario01 } from "../create.ts";
import { changeCollapse } from "../effects.ts";
import { checkEnd, startEnding } from "../ending.ts";
import { inspectorPhase, runInspectorJob } from "../inspector.ts";
import { everyone } from "../players.ts";
import { drawRoundEvent } from "../round-events.ts";
import { registerScenario } from "../scenario.ts";

registerScenario({
  id: "S01_LAST_TRAIN",
  create: createScenario01,
  // a getter: actions.ts may still be loading when this registers (import cycle through create.ts)
  get actions() {
    return S01_ACTIONS;
  },

  itemPools: { any: ITEM_IDS, buff: ["FLASHLIGHT", "OLD_KEY", "RED_UMBRELLA", "BLANK_TICKET", "PASSENGER_PASS"] },
  roundOpens: (ctx) => {
    ctx.s.escape = { round: null, power: false, identity: false, memory: false, by: {} };
  },
  roundHeader: (s) => m`— Round ${s.round} of ${SCENARIO.rounds} —`,
  apFor: (s, p) => (p.lost ? AP_WHEN_LOST : AP_PER_ROUND) + s.config.bonusAp + (s.act === 3 ? s.config.act3BonusAp : 0),
  playerRoundStart: (ctx, p) => {
    const s = ctx.s;
    if (s.nightRule !== "VOID_HOUR") return;
    if (s.round === 1 && p.skill.state === "READY") p.skill.state = "LOCKED";
    if (s.round === 2 && p.skill.state === "LOCKED") p.skill.state = p.skill.usesLeft > 0 ? "READY" : "BURNED";
    // once, after the last passenger
    if (s.round === 1 && p.playerId === s.turnOrder.at(-1)) log(ctx, m`Void Hour: every ability is locked this round.`, "RULE");
  },
  onRoundStart,
  afterTurns: (s) => (s.act >= 2 ? "INSPECTOR" : "ROUND_EVENT"),
  worldStep: inspectorPhase,
  roundEvent: (ctx) => {
    if (!scriptedRoundEvent(ctx)) drawRoundEvent(ctx);
  },
  roundCloses: (ctx) => {
    const s = ctx.s;
    if (s.escape.round !== s.round || s.outcome) return;
    const set = [s.escape.power, s.escape.identity, s.escape.memory].filter(Boolean).length;
    if (set > 0) log(ctx, m`The escape locks slip back: ${set}/3 is not enough. All three must hold in the same round. The keys stay with whoever carries them.`, "LOCK_RESET");
  },
  roundCollapse: (ctx) => changeCollapse(ctx, 1, m`the train runs on`),
  afterRound: (ctx) => {
    const s = ctx.s;
    if (s.round >= SCENARIO.rounds) {
      startEnding(ctx, "FAILED", "TIME");
      return true;
    }
    if (s.round === 3) {
      s.phase = "ACT_2";
      s.act = 2;
      s.sequence = { kind: "BLACKOUT", acks: [] };
      log(ctx, m`The lights die. "Identity registration complete. Anomaly detected."`, "STORY");
      log(ctx, m`"Passengers on board: ${everyone(ctx).length + 1}."`, "STORY");
      cue(ctx, "BLACKOUT", {});
    } else if (s.round === 7) {
      s.phase = "ACT_3";
      s.act = 3;
      for (const c of s.carriages) c.locked = false;
      s.sequence = { kind: "CAB_OPEN", acks: [] };
      log(ctx, m`A lock turns somewhere at the front of the train. Driver's cab access restored.`, "STORY");
      log(ctx, m`FINAL DEPARTURE PROTOCOL: carry the Power, Identity and Memory keys to their escape locks, all in the same round.`, "STORY");
      cue(ctx, "CAB_OPEN", {});
    }
    return false;
  },
  checkEnd,
  runJob: runInspectorJob,
});
