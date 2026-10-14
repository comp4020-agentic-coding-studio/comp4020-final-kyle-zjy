// Scenario 03's causal layer, all from public state: the timeline shift after
// a rewrite (where 2026 changed, never what it changed into, so the table has
// to go and look), the causal network of recorded 1996 decisions and the 2026
// places they touch, and the viewer's private Administration directive.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { RoomId03 } from "../../../shared/game/scenario03/map.ts";
import { NODE_IDS03, NODES03, type CausalNodeId03 } from "../../../shared/game/scenario03/nodes.ts";
import type { PlayerView, TemporalPresent03 } from "../../../shared/game/state.ts";
import { useT, type MessageKey } from "../../i18n/index.ts";
import { useStore } from "../../store.ts";
import { Card } from "../cards/Card.tsx";
import { roomKey03 } from "./Map03.tsx";

/** Which 2026 room shows each part of the present. */
const ROOM_OF: Record<keyof TemporalPresent03, RoomId03 | null> = {
  caseFile: "ARCHIVES", researchFacility: "RESEARCH_WING", secretArchiveOpen: "SECRET_ARCHIVE",
  workerPresent: "RESEARCH_WING", badgeCache: "RESEARCH_WING", report: "ARCHIVES",
  powerRoomExists: "POWER_ROOM", administrationIntegrity: "CENTRAL_HALL", accidentRecord: "ARCHIVES",
  staffEvacuated: "MAIN_LAB", jiStaged: "DIRECTOR_OFFICE", prototypeHidden: "PROTOTYPE_ROOM",
};

/** What each 1996 decision is known to touch in 2026 (the rule of the causal fold, nodes.ts). */
const TOUCHES: Record<CausalNodeId03, (keyof TemporalPresent03)[]> = {
  ARCHIVE_GATE: ["secretArchiveOpen"], WORKER: ["workerPresent", "badgeCache"], REPORT: ["report"],
  PROTOTYPE_CORE: ["powerRoomExists", "administrationIntegrity"], ACCIDENT_RECORD: ["accidentRecord"],
  STAFF_EVACUATION: ["staffEvacuated"], JI_RECORD: ["jiStaged"], PROTOTYPE_FATE: ["prototypeHidden"],
};

const roomsOf = (keys: (keyof TemporalPresent03)[]) => [...new Set(keys.map((k) => ROOM_OF[k]).filter((r): r is RoomId03 => !!r))];

/** `onOpen`: opens the Timeline Dossier, where the rewritten records change in place. */
export function TimelineShift03({ onOpen, hidden = false }: { onOpen?: () => void; hidden?: boolean }) {
  const t = useT();
  const cue = useStore((s) => s.cues?.findLast((c) => c.kind === "S3_CAUSAL_REWRITE"));
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!cue || Date.now() - cue.at > 4000) return;
    setOpen(cue.key);
    const timer = setTimeout(() => setOpen(null), 4200);
    return () => clearTimeout(timer);
  }, [cue]);
  const before = (cue?.payload.before ?? {}) as Partial<TemporalPresent03>;
  const after = (cue?.payload.after ?? {}) as Partial<TemporalPresent03>;
  const changed = roomsOf((Object.keys(after) as (keyof TemporalPresent03)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])));
  return (
    <AnimatePresence>
      {open && cue?.key === open && !hidden && (
        <motion.button key={open} className="s3-shift fixed inset-x-3 top-[calc(env(safe-area-inset-top)+96px)] z-40 mx-auto max-w-md rounded-xl border border-signal/50 bg-[#061a22]/95 p-3 text-left" initial={{ opacity: 0, y: -10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0 }} onClick={() => { setOpen(null); onOpen?.(); }} aria-live="polite">
          <p className="label text-signal">{t("s3.shift.kicker")}</p>
          <p className="font-display text-xl text-moon">{t("s3.shift.title")}</p>
          <ul className="mt-1 grid grid-cols-1 gap-0.5 font-mono text-xs text-mist">
            {changed.map((room, i) => (
              <motion.li key={room} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.25 }}>
                {t("s3.shift.room", { room: t(roomKey03(room)) })}
              </motion.li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-ash">{t("s3.shift.note")}</p>
          {onOpen && <span className="mt-1 block font-mono text-xs text-signal underline underline-offset-4">{t("s3.dossier.shiftOpen")}</span>}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** Recorded 1996 decisions and the 2026 rooms they touch; open decisions stay ???. */
export function CausalNetwork03({ g }: { g: PlayerView }) {
  const t = useT();
  const tp = g.temporal!;
  const known = NODE_IDS03.filter((id) => g.act >= NODES03[id].minAct);
  return (
    <section>
      <p className="label">{t("s3.network.title")}</p>
      <p className="mt-1 text-xs text-ash">{t("s3.network.intro")}</p>
      <ol className="mt-2 grid grid-cols-1 gap-1.5">
        {known.map((id) => {
          const done = tp.interventions.find((i) => i.nodeId === id);
          return (
            <li key={id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-gold/20 bg-[#141008]/60 px-2 py-1.5 text-xs">
              <span className="min-w-0">
                <span className="block truncate text-gold">{t(`s3.node.${id}` as MessageKey)}</span>
                <span className="block truncate text-moon">{done ? t(`s3.choice.${id}.${done.choiceId}` as MessageKey) : "???"}</span>
              </span>
              <span className={done ? "text-signal" : "text-ash"} aria-hidden="true">→</span>
              <span className="min-w-0 text-right">
                <span className="block truncate text-signal">{t("s3.network.y2026")}</span>
                <span className="block truncate text-mist">{done ? roomsOf(TOUCHES[id]).map((r) => t(roomKey03(r))).join(t("common.listSep")) : "???"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Directive03({ g }: { g: PlayerView }) {
  const t = useT();
  const mine = g.temporal?.directives?.find((d) => d.playerId === g.viewerId);
  if (!mine) return null;
  return (
    <Card variant="intel" private kicker={t("s3.directive.kicker")} title={t(`s3.directive.${mine.directive}.name` as MessageKey)}>
      <p>{t(`s3.directive.${mine.directive}.text` as MessageKey)}</p>
      <p className="mt-1 text-xs text-ash">{t("s3.directive.note")}</p>
    </Card>
  );
}

/** After the run: every directive and whether history kept it. */
export function DirectiveResults03({ g }: { g: PlayerView }) {
  const t = useT();
  const all = g.temporal?.directives ?? [];
  if (!all.length || all.some((d) => d.met === null)) return null;
  return (
    <section className="mt-5 rounded-xl border border-violet/40 p-4 text-left" aria-label={t("s3.directive.results")}>
      <p className="label text-violet-soft">{t("s3.directive.results")}</p>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-sm">
        {all.map((d) => (
          <li key={d.playerId} className="flex min-w-0 items-baseline gap-2">
            <span className={d.met ? "text-moss" : "text-ember"} aria-hidden="true">{d.met ? "✓" : "✗"}</span>
            <span className="min-w-0 text-moon">{g.players[d.playerId]?.nickname} · {t(`s3.directive.${d.directive}.name` as MessageKey)}</span>
            <span className="sr-only">{t(d.met ? "s3.directive.met" : "s3.directive.unmet")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
