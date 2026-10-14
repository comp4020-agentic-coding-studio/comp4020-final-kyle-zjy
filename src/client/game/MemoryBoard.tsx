// Scenario 01's memory wall: the six memory fragments as cards pinned where
// they were found, and the six core memories filling in the outline of the
// passenger the train is erasing. Everything here is already public: found
// fragments and which carriages have given up their core memory.
import { motion } from "motion/react";
import { CARRIAGES, FRAGMENTS, MIDDLE, TRUE_ENDING_CORE_MEMORIES } from "../../shared/game/scenario01/content.ts";
import type { CarriageIdentity, FragmentType, PlayerView } from "../../shared/game/state.ts";
import { useScenarioText, useT } from "../i18n/index.ts";
import { Card } from "./cards/Card.tsx";
import { Drawer } from "./Drawer.tsx";

const ALL = Object.keys(FRAGMENTS) as FragmentType[];
const SOURCE: Record<FragmentType, CarriageIdentity> = Object.fromEntries(
  (Object.keys(CARRIAGES) as CarriageIdentity[]).filter((c) => CARRIAGES[c].fragment).map((c) => [CARRIAGES[c].fragment!, c]),
) as Record<FragmentType, CarriageIdentity>;

export function MemoryBoard({ g, onClose }: { g: PlayerView; onClose: () => void }) {
  const t = useT();
  const text = useScenarioText();
  const woken = MIDDLE.filter((c) => g.flags[`core_${c}`]);
  return (
    <Drawer title={t("memory.title")} onClose={onClose}>
      <p className="text-sm text-mist">{t("memory.intro")}</p>
      <Passenger g={g} woken={woken} />
      <p className="label mt-4">{t("memory.fragments", { n: g.fragments.length, total: ALL.length })}</p>
      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL.map((f, i) => {
          const found = g.fragments.includes(f);
          return (
            <motion.li key={f} className="min-w-0" initial={{ opacity: 0, rotate: i % 2 ? 1.5 : -1.5, y: 8 }} animate={{ opacity: 1, rotate: i % 2 ? 0.6 : -0.6, y: 0 }} transition={{ delay: i * 0.05 }}>
              {found ? (
                <Card variant="memory" kicker={t("memory.from", { carriage: text.carriages[SOURCE[f]].name })} title={text.fragments[f].name}>
                  <p className="italic">“{text.fragments[f].text}”</p>
                </Card>
              ) : (
                <Card variant="memory" dim kicker={t("memory.unfound")} title="???">
                  <p>{t("memory.hint", { carriage: text.carriages[SOURCE[f]].name })}</p>
                </Card>
              )}
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ash">{t("memory.unclaimed")}</p>
    </Drawer>
  );
}

/** The outline of a person, one piece lit per core memory recovered. */
function Passenger({ g, woken }: { g: PlayerView; woken: CarriageIdentity[] }) {
  const t = useT();
  const text = useScenarioText();
  const n = g.coreMemories;
  const pieces = ["M50 18a14 14 0 1 1 0 .1", "M30 48h40l-4 30H34z", "M30 50l-14 34", "M70 50l14 34", "M38 80l-6 42", "M62 80l6 42"];
  const whole = n >= TRUE_ENDING_CORE_MEMORIES;
  return (
    <div className="mt-3 flex min-w-0 items-center gap-4 rounded-xl border border-violet/40 bg-[radial-gradient(ellipse_at_center,#221a4a_0%,#0b0a1d_80%)] p-3" role="img" aria-label={t("memory.coreAria", { n, total: TRUE_ENDING_CORE_MEMORIES })}>
      <svg width="88" height="128" viewBox="0 0 100 130" className="shrink-0" aria-hidden="true">
        {pieces.map((d, i) => (
          <motion.path key={i} d={d} fill={i === 1 && i < n ? "#9c86ff33" : "none"} stroke={i < n ? (whole ? "#e8c97f" : "#9c86ff") : "#2a2f55"} strokeWidth={i === 0 ? 2 : 3} strokeLinecap="round" strokeDasharray={i < n ? undefined : "3 4"} initial={false} animate={{ opacity: i < n ? 1 : 0.6 }} />
        ))}
      </svg>
      <div className="min-w-0">
        <p className="font-mono text-2xl text-moon">{n} / {TRUE_ENDING_CORE_MEMORIES}</p>
        <p className="label text-[10px] text-violet-soft">{t("memory.core")}</p>
        <p className="mt-1 text-xs text-mist">{whole ? t("memory.whole") : woken.length ? t("memory.wokenIn", { list: woken.map((c) => text.carriages[c].name).join(t("common.listSep")) }) : t("memory.none")}</p>
      </div>
    </div>
  );
}
