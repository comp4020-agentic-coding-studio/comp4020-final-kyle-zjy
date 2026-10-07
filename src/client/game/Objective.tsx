// The act's goal, with progress, so every turn starts from "what are we doing".
import { CARRIAGES, FRAGMENTS } from "../../shared/game/scenario01/content.ts";
import type { PlayerView } from "../../shared/game/state.ts";

export function objective(g: PlayerView): { text: string; done: number; of: number } {
  if (g.act === 1) {
    const goal = ["ROUTE", "DRIVER", "MANIFEST"] as const;
    return { text: `Recover the ${goal.map((f) => FRAGMENTS[f].name).join(", ")} fragments`, done: goal.filter((f) => g.fragments.includes(f)).length, of: 3 };
  }
  if (g.act === 2) {
    return { text: "Repair the three reality anchors before the train comes apart", done: Object.values(g.anchors).filter((a) => a.repaired).length, of: 3 };
  }
  const locks = g.escape.round === g.round ? [g.escape.power, g.escape.route, g.escape.drive].filter(Boolean).length : 0;
  return { text: "Engage the Power, Route and Drive locks in the same round", done: locks, of: 3 };
}

export function Objective({ g }: { g: PlayerView }) {
  const o = objective(g);
  return (
    <p className="mx-auto mt-1 flex max-w-6xl items-baseline gap-2 px-3 text-xs sm:px-4" aria-label={`Objective: ${o.text}, ${o.done} of ${o.of}`}>
      <span className="label shrink-0 text-[10px] text-signal">Objective</span>
      <span className="min-w-0 flex-1 text-mist">{o.text}</span>
      <span className="shrink-0 font-mono text-signal">
        {o.done}/{o.of}
      </span>
    </p>
  );
}

/** Where the Inspector is and who it's after: on a phone it is often off-screen in the train. */
export function InspectorLine({ g }: { g: PlayerView }) {
  const insp = g.inspector;
  if (!insp.active) return null;
  const banished = insp.banishedUntilRound !== null;
  const where = CARRIAGES[g.carriages[insp.carriageIndex]?.identity ?? "START"].name;
  const target = insp.targetId === g.viewerId ? "you" : insp.targetId ? g.players[insp.targetId]?.nickname : null;
  const text = banished ? `Banished. It returns in round ${insp.banishedUntilRound! + 1}.` : `${where}${target ? ` · heading for ${target}` : ""}`;
  return (
    <p className="mx-auto flex max-w-6xl items-baseline gap-2 px-3 text-xs sm:px-4" aria-label={`Inspector: ${text}`}>
      <span className="label shrink-0 text-[10px] text-ember">Inspector</span>
      <span className={`min-w-0 flex-1 ${target === "you" && !banished ? "text-ember" : "text-mist"}`}>{text}</span>
      {!banished && <span className="shrink-0 font-mono text-signal">marks {insp.distortion}/3</span>}
    </p>
  );
}
