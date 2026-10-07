// Where you are and what this carriage offers: the context for "what can I do".
import { CARRIAGES } from "../../shared/game/scenario01/content.ts";
import type { PlayerView } from "../../shared/game/state.ts";

export function CarriageInfo({ g }: { g: PlayerView }) {
  const me = g.players[g.viewerId];
  if (!me) return null;
  const c = g.carriages[me.carriageIndex];
  const info = CARRIAGES[c.identity];
  const investigate = g.myActions.find((a) => a.type === "INVESTIGATE")?.hint ?? info.investigateHint;
  const search = g.myActions.find((a) => a.type === "SEARCH")?.hint ?? info.searchHint;
  const repair = g.myActions.find((a) => a.type === "REPAIR");
  return (
    <section className="mx-auto w-full max-w-6xl px-3 sm:px-4" aria-label="Your carriage">
      <div className="rounded-xl border px-3 py-2" style={{ borderColor: `${info.accent}55`, background: `linear-gradient(90deg, ${info.accent}14, transparent 70%)` }}>
        <p className="text-sm">
          <span className="label mr-2 text-[10px]">You are in</span>
          <span className="font-display text-lg text-moon">{info.name}</span>
          <span className="ml-2 text-xs text-mist">{info.blurb}</span>
        </p>
        <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-mist sm:grid-cols-3">
          <li>
            <span className="text-gold">Investigate:</span> {investigate}
          </li>
          <li>
            <span className="text-gold">Search:</span> {search}
          </li>
          <li>
            <span className="text-gold">Repair:</span> {repair?.enabled ? repair.hint : repair?.reason}
          </li>
        </ul>
      </div>
    </section>
  );
}
