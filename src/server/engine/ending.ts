// How a run ends. Victory needs all of: three anchors repaired, three or more
// memory fragment types, the Power, Route and Drive locks engaged in the same
// round, Collapse below 12, and at least half the passengers not lost.
// Failure: Collapse 12, round 12 over, or everyone lost at once.
// With 6 core memories the passengers face one last choice (true endings).
import { endingText, OBSESSIONS, TRUE_ENDING_CORE_MEMORIES } from "../../shared/game/scenario01/content.ts";
import type { FailReason, GameState, Outcome, PlayerGameState, PlayerResult } from "../../shared/game/state.ts";
import { cue, log, type Ctx } from "./context.ts";
import { tally } from "./beats.ts";
import { everyone, present } from "./players.ts";
import { onResume, openWindow } from "./windows.ts";

export type EscapeCheck = { ready: boolean; missing: string[] };

export function escapeStatus(s: GameState): EscapeCheck {
  const missing: string[] = [];
  const anchorsLeft = Object.values(s.anchors).filter((a) => !a.repaired).length;
  if (anchorsLeft) missing.push(`${anchorsLeft} reality anchor${anchorsLeft > 1 ? "s" : ""} still broken`);
  if (s.fragments.length < 3) missing.push(`only ${s.fragments.length}/3 memory fragment types`);
  const locks = s.escape.round === s.round ? [s.escape.power, s.escape.route, s.escape.drive].filter(Boolean).length : 0;
  if (locks < 3) missing.push(`${locks}/3 escape locks this round`);
  if (s.collapse >= s.collapseMax) missing.push("the train has collapsed");
  const players = Object.values(s.players);
  const steady = players.filter((p) => !p.lost).length;
  if (steady * 2 < players.length) missing.push("more than half the passengers are lost");
  return { ready: missing.length === 0, missing };
}

/** Returns true if the run just moved toward its end (ending started or final choice opened). */
export function checkEnd(ctx: Ctx): boolean {
  const s = ctx.s;
  if (s.outcome || s.flags.endingChoiceOpen) return false;
  if (s.collapse >= s.collapseMax) {
    startEnding(ctx, "FAILED", "COLLAPSE");
    return true;
  }
  const all = everyone(ctx);
  if (all.length && all.every((p) => p.lost)) {
    startEnding(ctx, "FAILED", "ALL_LOST");
    return true;
  }
  const locks = s.escape.round === s.round && s.escape.power && s.escape.route && s.escape.drive;
  if (!locks) return false;
  const status = escapeStatus(s);
  if (!status.ready) {
    if (!s.flags[`escapeBlocked_${s.round}`]) {
      s.flags[`escapeBlocked_${s.round}`] = 1;
      log(ctx, `All three locks hold, but the train won't let go: ${status.missing.join("; ")}.`, "LOCK_RESET");
    }
    return false;
  }
  if (s.coreMemories >= TRUE_ENDING_CORE_MEMORIES) {
    s.flags.endingChoiceOpen = 1;
    log(ctx, "Six core memories. The nameless passenger is not one person. It is every route none of you took.", "STORY");
    openWindow(ctx, {
      kind: "ENDING_CHOICE",
      title: "The passenger without a name",
      prompt: "It is every life you didn't choose. What do you do with it?",
      addressees: present(ctx).map((p) => p.playerId),
      options: [
        { id: "DELETE", label: "Delete it", detail: "Close every road not taken. Arrive lighter." },
        { id: "TICKET", label: "Give it a ticket", detail: "Let it ride with you. Arrive carrying everything." },
      ],
      defaultOptionId: "TICKET",
      resume: { kind: "ENDING_CHOICE" },
      blocksTable: true,
    });
    return true;
  }
  startEnding(ctx, "NORMAL");
  return true;
}

onResume("ENDING_CHOICE", (ctx, w, answers) => {
  const { winner } = tally(ctx, answers, w.options.map((o) => o.id));
  ctx.s.endingChoice = winner === "DELETE" ? "DELETE" : "TICKET";
  ctx.s.flags.endingChoiceOpen = 0;
  startEnding(ctx, winner === "DELETE" ? "TRUE_DELETE" : "TRUE_TICKET");
});

export function startEnding(ctx: Ctx, outcome: Outcome, reason?: FailReason): void {
  const s = ctx.s;
  if (s.outcome) return;
  s.outcome = outcome;
  s.failReason = reason ?? null;
  s.phase = "ENDING";
  s.pending = [];
  s.jobs = [];
  s.triggerQueue = [];
  s.pendingEffect = null;
  if (s.roll && !s.roll.done) s.roll.done = true;
  s.rollContext = null;
  s.turnDeadline = null;
  s.sequence = { kind: "ENDING", acks: [] };
  s.results = computeResults(ctx);
  const text = endingText(outcome, s.failReason);
  log(ctx, `${text.title} ${text.lines.join(" ")}`, text.won ? "ENDING_WIN" : "ENDING_FAIL");
  cue(ctx, "ENDING", { outcome, reason: reason ?? null });
}

function obsessionMet(ctx: Ctx, p: PlayerGameState): boolean {
  const st = p.stats;
  switch (ctx.s.secrets[p.playerId].obsession) {
    case "NO_DEBTS":
      return st.helpsReceived <= 2;
    case "WAY_HOME":
      return st.carriagesVisited.length >= 5;
    case "I_KNOW_THEM":
      return (p.counters.helpedNeighbour ?? 0) >= 2;
    case "COLLECTOR":
      return p.items.length >= 3;
    case "DOUBT_EVERYTHING":
      return st.hiddenInvestigations >= 2;
    case "LUCKY":
      return st.perfects >= 1;
    case "LIFESAVER":
      return st.damageTakenForOthers >= 1;
    case "GAMBLER":
      return st.fateSpentOnDice >= 3;
    case "LONE_WOLF":
      return st.soloKeyTasks >= 1;
    case "LAST_TRAIN":
      return st.finalTaskRound !== null && st.finalTaskRound >= 10;
  }
}

/** Each player's title comes from what they did most, relative to the table. */
function computeResults(ctx: Ctx): PlayerResult[] {
  const all = everyone(ctx);
  const best = (score: (p: PlayerGameState) => number) => Math.max(0, ...all.map(score));
  const awards: { title: string; score: (p: PlayerGameState) => number; line: (n: number) => string }[] = [
    { title: "Keeper of Memories", score: (p) => p.stats.fragmentsFound, line: (n) => `${n} memory fragment${n > 1 ? "s" : ""} recovered` },
    { title: "The Train's Mechanic", score: (p) => p.stats.repairs, line: (n) => `${n} successful repair${n > 1 ? "s" : ""}` },
    { title: "The Kind Stranger", score: (p) => p.stats.helpsGiven, line: (n) => `helped others ${n} time${n > 1 ? "s" : ""}` },
    { title: "The Inspector's Nemesis", score: (p) => p.stats.confronts, line: (n) => `${n} confrontation${n > 1 ? "s" : ""}` },
    { title: "Fate's Favourite", score: (p) => p.stats.perfects, line: (n) => `${n} perfect roll${n > 1 ? "s" : ""}` },
    { title: "The Gambler", score: (p) => p.stats.fateSpentOnDice, line: (n) => `${n} Fate spent bending the dice` },
    { title: "The Wanderer", score: (p) => p.stats.carriagesVisited.length, line: (n) => `${n} carriage${n > 1 ? "s" : ""} explored` },
  ];
  return all.map((p) => {
    const highlights = awards.map((a) => ({ a, n: a.score(p) })).filter(({ n }) => n > 0);
    // a title someone holds alone beats one they share, so ties don't hand everyone the same name
    const tops = awards.filter((a) => a.score(p) > 0 && a.score(p) === best(a.score));
    const won = tops.find((a) => all.filter((o) => a.score(o) === a.score(p)).length === 1) ?? tops[0];
    const met = obsessionMet(ctx, p);
    const secrets = ctx.s.secrets[p.playerId];
    return {
      playerId: p.playerId,
      obsession: secrets.obsession,
      obsessionMet: met,
      title: won?.title ?? (p.lost ? "The One Who Got Lost" : "A Passenger With a Name"),
      highlights: [
        ...highlights.map(({ a, n }) => a.line(n)),
        met ? `Obsession fulfilled: ${OBSESSIONS[secrets.obsession].name}` : `Obsession unfulfilled: ${OBSESSIONS[secrets.obsession].name}`,
        p.skill.usesLeft < 1 ? "ability used" : "ability never used",
      ],
      messages: secrets.messages.map((m) => ({ text: m.text, isTrue: m.isTrue })),
    };
  });
}

