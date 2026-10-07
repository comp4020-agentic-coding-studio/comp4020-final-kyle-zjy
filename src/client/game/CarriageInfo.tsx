// Where you are and what this carriage offers: the context for "what can I do".
import { CARRIAGES } from "../../shared/game/scenario01/content.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { useFormat, useScenarioText, useT } from "../i18n/index.ts";

export function CarriageInfo({ g }: { g: PlayerView }) {
  const t = useT();
  const fmt = useFormat();
  const carriages = useScenarioText().carriages;
  const me = g.players[g.viewerId];
  if (!me) return null;
  const c = g.carriages[me.carriageIndex];
  const accent = CARRIAGES[c.identity].accent;
  const info = carriages[c.identity];
  const investigate = fmt(g.myActions.find((a) => a.type === "INVESTIGATE")?.hint ?? info.investigateHint);
  const search = fmt(g.myActions.find((a) => a.type === "SEARCH")?.hint ?? info.searchHint);
  const repair = g.myActions.find((a) => a.type === "REPAIR");
  return (
    <section className="mx-auto w-full max-w-6xl px-3 sm:px-4" aria-label={t("carriage.aria")}>
      <div className="rounded-xl border px-3 py-2" style={{ borderColor: `${accent}55`, background: `linear-gradient(90deg, ${accent}14, transparent 70%)` }}>
        <p className="text-sm">
          <span className="label mr-2 text-[10px]">{t("carriage.youAreIn")}</span>
          <span className="font-display text-lg text-moon">{info.name}</span>
          <span className="ml-2 text-xs text-mist">{info.blurb}</span>
        </p>
        <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-mist sm:grid-cols-3">
          <li>
            <span className="text-gold">{t("carriage.investigate")}</span> {investigate}
          </li>
          <li>
            <span className="text-gold">{t("carriage.search")}</span> {search}
          </li>
          <li>
            <span className="text-gold">{t("carriage.repair")}</span> {fmt(repair?.enabled ? repair.hint : repair?.reason)}
          </li>
        </ul>
      </div>
    </section>
  );
}
