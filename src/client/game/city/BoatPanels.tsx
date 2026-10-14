// Scenario 02's boat states on the run screen: the final startup the city must
// still perform, and the calm panel someone sees once they are aboard.
import { motion } from "motion/react";
import { facilityAtZone } from "./facility.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useT } from "../../i18n/index.ts";

/** Someone is aboard, the boat has not left and no chip will start it. */
export const needsStartup = (g: PlayerView) => {
  const b = g.city!.boat;
  return b.aboard.length > 0 && !b.launched && !b.autoStart;
};

export function FinalStartup({ g }: { g: PlayerView }) {
  const t = useT();
  if (!needsStartup(g)) return null;
  const here = facilityAtZone(g.players[g.viewerId]?.carriageIndex ?? -1) === "POWER_STATION" && !g.city!.boat.aboard.includes(g.viewerId);
  return (
    <motion.section role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="final-startup mx-3 rounded-xl border-2 border-gold/70 bg-gold/10 px-3 py-2">
      <p className="label text-gold-bright">{t("s2.final.title")}</p>
      <p className="mt-0.5 text-sm text-moon">{g.city!.boat.aboard.includes(g.viewerId) ? t("s2.final.aboardBody") : t("s2.final.body")}</p>
      {here && <p className="mt-1 text-sm font-semibold text-gold-bright">{t("s2.final.here")}</p>}
    </motion.section>
  );
}

/** What an aboard player sees in place of the action dock. */
export function AboardWatch({ g }: { g: PlayerView }) {
  const t = useT();
  const b = g.city!.boat;
  const ashore = g.turnOrder.filter((id) => !b.aboard.includes(id) && !g.players[id].lost);
  return (
    <section className="aboard-watch safe-bottom sticky bottom-0 z-20 border-t border-signal/30 bg-[#04121c]/92 px-4 py-4 text-center backdrop-blur-md" role="status">
      <p className="label text-signal">{t("s2.watch.title")}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm text-moon">{t("s2.watch.body")}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm text-mist">
        {b.launched ? t("s2.watch.launched") : ashore.length ? t("s2.watch.waiting", { n: ashore.length }) : t("s2.watch.waiting.none")}
      </p>
      {!b.launched && ashore.length > 0 && <p className="mx-auto mt-1 max-w-xl text-xs text-ash">{t("s2.watch.ashore", { names: ashore.map((id) => g.players[id].nickname).join(t("common.listSep")) })}</p>}
    </section>
  );
}
