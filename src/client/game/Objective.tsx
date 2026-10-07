// The act's goal, with progress, so every turn starts from "what are we doing".
import type { ScenarioText } from "../../shared/i18n/content-types.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { useScenarioText, useT, type TFunction } from "../i18n/index.ts";

function objective(g: PlayerView, t: TFunction, text: ScenarioText): { text: string; done: number; of: number } {
  if (g.act === 1) {
    const goal = ["ROUTE", "DRIVER", "MANIFEST"] as const;
    return { text: t("objective.act1", { list: goal.map((f) => text.fragments[f].name).join(t("common.listSep")) }), done: goal.filter((f) => g.fragments.includes(f)).length, of: 3 };
  }
  if (g.act === 2) {
    return { text: t("objective.act2"), done: Object.values(g.anchors).filter((a) => a.repaired).length, of: 3 };
  }
  const locks = g.escape.round === g.round ? [g.escape.power, g.escape.route, g.escape.drive].filter(Boolean).length : 0;
  return { text: t("objective.act3"), done: locks, of: 3 };
}

export function Objective({ g }: { g: PlayerView }) {
  const t = useT();
  const o = objective(g, t, useScenarioText());
  return (
    <p className="mx-auto mt-1 flex max-w-6xl items-baseline gap-2 px-3 text-xs sm:px-4" aria-label={t("objective.aria", { text: o.text, done: o.done, of: o.of })}>
      <span className="label shrink-0 text-[10px] text-signal">{t("objective.label")}</span>
      <span className="min-w-0 flex-1 text-mist">{o.text}</span>
      <span className="shrink-0 font-mono text-signal">
        {o.done}/{o.of}
      </span>
    </p>
  );
}

/** Where the Inspector is and who it's after: on a phone it is often off-screen in the train. */
export function InspectorLine({ g }: { g: PlayerView }) {
  const t = useT();
  const carriages = useScenarioText().carriages;
  const insp = g.inspector;
  if (!insp.active) return null;
  const banished = insp.banishedUntilRound !== null;
  const where = carriages[g.carriages[insp.carriageIndex]?.identity ?? "START"].name;
  const targetsMe = insp.targetId === g.viewerId;
  const target = targetsMe ? t("inspector.you") : insp.targetId ? g.players[insp.targetId]?.nickname : null;
  const text = banished ? t("inspector.banished", { n: insp.banishedUntilRound! + 1 }) : target ? t("inspector.heading", { where, target }) : where;
  return (
    <p className="mx-auto flex max-w-6xl items-baseline gap-2 px-3 text-xs sm:px-4" aria-label={t("inspector.aria", { text })}>
      <span className="label shrink-0 text-[10px] text-ember">{t("inspector.label")}</span>
      <span className={`min-w-0 flex-1 ${targetsMe && !banished ? "text-ember" : "text-mist"}`}>{text}</span>
      {!banished && <span className="shrink-0 font-mono text-signal">{t("inspector.marks", { n: insp.distortion })}</span>}
    </p>
  );
}
