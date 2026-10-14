// The evacuation triage board, once the boat's seats are known. A disaster
// ward's list, not a leaderboard: each person's public work decides who gets a
// seat if more board than there are seats (a public rule). Who holds a pass is
// private and never shown here.
import { getCharacterById } from "../../../shared/characters/roster/index.ts";
import { HARBOUR_ZONE, zoneIndex } from "../../../shared/game/scenario02/map.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { Avatar } from "../../components/Avatar.tsx";
import { useT } from "../../i18n/index.ts";

export function Triage({ g }: { g: PlayerView }) {
  const t = useT();
  const city = g.city!;
  const seats = city.boat.capacity;
  if (seats === null) return null;
  const pier = zoneIndex(HARBOUR_ZONE);
  const rows = g.turnOrder
    .map((id, i) => ({ id, i, work: city.contrib[id] ?? 0 }))
    .sort((a, b) => b.work - a.work || a.i - b.i);
  return (
    <section aria-label={t("s2.triage.title")} className="triage mx-3 rounded-xl border border-ember/30 bg-black/35 px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="label text-[10px] text-ember">{t("s2.triage.title")}</p>
        <p className="font-mono text-[11px] text-gold">{t("s2.triage.seats", { aboard: city.boat.aboard.length, seats })}</p>
      </div>
      <ul className="mt-1 grid grid-cols-1 gap-1">
        {rows.map((r, rank) => {
          const p = g.players[r.id];
          const ch = getCharacterById(p.characterId);
          const aboard = city.boat.aboard.includes(r.id);
          const place = aboard ? t("s2.triage.aboard") : p.carriageIndex === pier ? t("s2.triage.pier") : t("s2.triage.city");
          return (
            <li key={r.id} className={`triage-row flex min-w-0 items-center gap-2 rounded-md border-l-4 px-2 py-1 text-xs ${aboard ? "border-signal bg-signal/10" : p.carriageIndex === pier ? "border-gold bg-gold/10" : "border-ash/60 bg-white/[0.03]"}`}>
              <span className="w-9 shrink-0 font-mono text-[10px] text-ash">{t("s2.triage.rank", { n: rank + 1 })}</span>
              <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={22} />
              <span className="min-w-0 flex-1 truncate font-semibold text-moon">
                {p.nickname}
                {r.id === g.viewerId ? ` ${t("s2.triage.you")}` : ""}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-mist">{r.work === 1 ? t("s2.triage.work.one") : t("s2.triage.work.other", { n: r.work })}</span>
              <span className="shrink-0 rounded border border-current px-1 font-mono text-[9px] font-bold tracking-wider text-gold">{place}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[10px] text-ash">{t("s2.triage.rule")}</p>
    </section>
  );
}
