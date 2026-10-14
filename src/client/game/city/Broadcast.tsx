// The city's emergency broadcast: one line at a time under the top bar, every
// line built from public state (what is flooded, what goes under at the next
// rise, who still waits, which roads still stand). Nothing here is invented.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ZONES } from "../../../shared/game/scenario02/map.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useScenario02Text, useT } from "../../i18n/index.ts";

export function Broadcast({ g }: { g: PlayerView }) {
  const t = useT();
  const text = useScenario02Text();
  const city = g.city!;
  const sep = t("common.listSep");
  const lines: string[] = [];
  const warned = city.zones.flatMap((z, i) => (z.warning ? [text.zones[ZONES[i].id].name] : []));
  if (warned.length) lines.push(t("s2.bc.warning", { zones: warned.join(sep) }));
  const waiting = city.npcs.filter((n) => n.state === "WAITING").map((n) => text.npcs[n.id].name);
  if (waiting.length) lines.push(t("s2.bc.waiting", { names: waiting.join(sep) }));
  const standing = city.edges.filter((e) => !e.broken && e.kind !== "ROAD").length;
  if (standing) lines.push(standing === 1 ? t("s2.bc.roads.one") : t("s2.bc.roads", { n: standing }));
  const lost = city.edges.filter((e) => e.broken).length;
  if (lost) lines.push(t("s2.bc.lost", { n: lost }));
  const flooded = city.zones.filter((z) => z.status === "FLOODED" || z.status === "SUBMERGED").length;
  if (flooded) lines.push(flooded === 1 ? t("s2.bc.flooded.one") : t("s2.bc.flooded", { n: flooded }));
  if (city.boat.readyRound !== null && !city.boat.launched) lines.push(t("s2.bc.boat"));
  if (!lines.length) lines.push(t("s2.bc.quiet"));

  // a new line each round (and when the set of lines changes), warnings first
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 7000);
    return () => clearInterval(id);
  }, []);
  const line = lines[(warned.length ? tick : tick + g.round) % lines.length];

  return (
    <section aria-label={t("s2.bc.aria")} className="flood-broadcast mx-3 mb-1 flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-amber-500/30 bg-black/40 px-3 py-1.5">
      <span className="flood-broadcast-dot h-2 w-2 shrink-0 rounded-full bg-ember" aria-hidden="true" />
      <p className="label shrink-0 text-[10px] text-ember">{t("s2.bc.title")}</p>
      <AnimatePresence mode="wait">
        <motion.p key={line} className="led-amber min-w-0 basis-full text-[12px] leading-snug sm:flex-1 sm:basis-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} role="status">
          {line}
        </motion.p>
      </AnimatePresence>
    </section>
  );
}
