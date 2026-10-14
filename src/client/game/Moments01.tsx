// Scenario 01's short client-side beats over the server's own state: the
// emergency brake's outcome, and the nameless passenger's memories assembling
// before the last choice. They only show what the server has already decided,
// never block it, and can be dismissed at once.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { MIDDLE } from "../../shared/game/scenario01/content.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { useScenarioText, useT } from "../i18n/index.ts";
import { useStore } from "../store.ts";

const BRAKE_MS = 3200;

export function Moments01({ g }: { g: PlayerView }) {
  return <>
    <BrakeMoment g={g} />
    <Reconstruction g={g} />
  </>;
}

function BrakeMoment({ g }: { g: PlayerView }) {
  const t = useT();
  const cue = useStore((s) => s.cues?.findLast((c) => c.kind === "VOTE_RESULT" && (c.payload.winner === "BRAKE" || c.payload.winner === "CONTINUE")));
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!cue || Date.now() - cue.at > BRAKE_MS) return;
    setOpen(cue.key);
    const timer = setTimeout(() => setOpen(null), BRAKE_MS);
    return () => clearTimeout(timer);
  }, [cue]);
  // braking moves the Inspector at once; a ticket check it starts is a decision, so the scene steps aside
  const checking = g.roll?.purpose === "TICKET_CHECK" && !g.roll.done;
  useEffect(() => { if (checking) setOpen(null); }, [checking]);
  const brake = cue?.payload.winner === "BRAKE";
  const counts = (cue?.payload.counts ?? {}) as Record<string, number>;
  return (
    <AnimatePresence>
      {open && cue && open === cue.key && (
        <motion.button
          key={cue.key}
          className={`fixed inset-0 z-[56] flex flex-col items-center justify-center px-6 text-center ${brake ? "brake-shake" : ""}`}
          style={{ background: brake ? "radial-gradient(circle at 50% 45%, #5a0d0dee, #000000f2 70%)" : "radial-gradient(circle at 50% 45%, #1d2552ee, #000000f2 70%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(null)}
          aria-label={t("common.continue")}
        >
          <p className="label text-ember">{t("moment.brake.kicker")}</p>
          <motion.h2 className="mt-3 font-display text-4xl font-semibold text-moon" initial={{ letterSpacing: "0.3em", opacity: 0 }} animate={{ letterSpacing: "0.04em", opacity: 1 }} transition={{ duration: 0.6 }}>
            {t(brake ? "moment.brake.pulled" : "moment.brake.kept")}
          </motion.h2>
          <motion.p className="mt-3 font-mono text-sm text-mist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            {t("moment.brake.count", { brake: counts.BRAKE ?? 0, keep: counts.CONTINUE ?? 0 })}
          </motion.p>
          {[t(brake ? "moment.brake.c1" : "moment.keep.c1"), t(brake ? "moment.brake.c2" : "moment.keep.c2")].map((line, i) => (
            <motion.p key={i} className="mt-2 text-moon" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 + i * 0.45 }}>
              {line}
            </motion.p>
          ))}
          <p className="mt-6 text-xs text-ash">{t("moment.tap")}</p>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** Six cards fly in and settle into one figure, before the server's last choice opens. */
function Reconstruction({ g }: { g: PlayerView }) {
  const t = useT();
  const text = useScenarioText();
  const choice = g.pending.find((w) => w.kind === "ENDING_CHOICE");
  const [seen, setSeen] = useState<string | null>(null);
  const open = !!choice && seen !== choice.id;
  useEffect(() => {
    if (!choice) return;
    const timer = setTimeout(() => setSeen(choice.id), 5200);
    return () => clearTimeout(timer);
  }, [choice]);
  const pieces = MIDDLE.filter((c) => g.flags[`core_${c}`]);
  return (
    <AnimatePresence>
      {open && choice && (
        <motion.button key={choice.id} className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSeen(choice.id)} aria-label={t("common.continue")}>
          <p className="label text-violet-soft">{t("moment.rebuild.kicker")}</p>
          <div className="relative mt-6 h-40 w-64 max-w-full">
            {pieces.map((c, i) => {
              const angle = (i / Math.max(1, pieces.length)) * Math.PI * 2;
              return (
                <motion.span
                  key={c}
                  className="absolute top-1/2 left-1/2 w-24 -translate-x-1/2 -translate-y-1/2 truncate rounded-md border border-violet/60 bg-[#1d1640] px-2 py-1 text-[10px] text-violet-soft"
                  initial={{ x: Math.cos(angle) * 160, y: Math.sin(angle) * 120, opacity: 0, rotate: (i - 3) * 12 }}
                  animate={{ x: Math.cos(angle) * 46, y: Math.sin(angle) * 40, opacity: [0, 1, 1, 0.15], rotate: 0 }}
                  transition={{ delay: 0.3 + i * 0.35, duration: 2.6, times: [0, 0.3, 0.75, 1] }}
                >
                  {text.carriages[c].name}
                </motion.span>
              );
            })}
            <motion.svg viewBox="0 0 100 130" className="absolute inset-0 m-auto h-40" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.8, duration: 1 }} aria-hidden="true">
              <path d="M50 18a14 14 0 1 1 0 .1M30 48h40l-4 30H34zM30 50l-14 34M70 50l14 34M38 80l-6 42M62 80l6 42" fill="none" stroke="#e8c97f" strokeWidth="3" strokeLinecap="round" />
            </motion.svg>
          </div>
          <motion.h2 className="mt-6 font-display text-3xl text-moon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.2 }}>{t("moment.rebuild.title")}</motion.h2>
          <motion.p className="mt-2 max-w-sm text-mist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.8 }}>{t("moment.rebuild.line")}</motion.p>
          <p className="mt-6 text-xs text-ash">{t("moment.tap")}</p>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
