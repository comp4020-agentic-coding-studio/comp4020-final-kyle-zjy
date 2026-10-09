// Layer three: everyone else at a glance. Compact chips (portrait, Fate,
// Sanity, ability state, and a scenario's own tag such as the year a player
// is in); tap one for the full card.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { ReactNode } from "react";
import type { PlayerView, PublicPlayerState } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { useT } from "../i18n/index.ts";

export function PlayersStrip({ g, onOpen, tag }: { g: PlayerView; onOpen: (p: PublicPlayerState) => void; tag?: (id: string) => ReactNode }) {
  const t = useT();
  const active = g.step === "PLAYER_TURNS" ? g.turnOrder[g.activeIndex] : null;
  return (
    <ul className="no-scrollbar mx-auto flex w-full min-w-0 max-w-6xl gap-2 overflow-x-auto px-3 pb-1 sm:px-4" aria-label={t("lobby.passengers")}>
      {g.turnOrder.map((id) => {
        const p = g.players[id];
        const ch = getCharacterById(p.characterId);
        const nb = g.seatNeighbours.find((grp) => grp.includes(g.viewerId))?.includes(id) && id !== g.viewerId;
        return (
          <li key={id} className="shrink-0">
            <button
              onClick={() => onOpen(p)}
              className={`flex min-h-12 items-center gap-2 rounded-full border py-1 pr-3 pl-1 ${id === active ? "border-signal bg-signal/10" : id === g.viewerId ? "border-gold/50" : "border-[#262d55]"}`}
              aria-label={t("players.aria", {
                name: p.nickname,
                you: id === g.viewerId ? t("players.you") : "",
                fate: p.fate,
                sanity: p.sanity,
                lost: p.lost ? t("players.lostAria") : "",
                away: p.away ? t("players.awayAria") : "",
                state: t(`players.stateAria.${p.skill.state}`),
              })}
            >
              <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={32} dim={p.away || p.lost} />
              <span className="text-left leading-tight">
                <span className="block max-w-[6.5rem] truncate text-xs font-semibold">
                  {p.nickname}
                  {nb ? t("players.neighbour") : ""}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-mist">
                  <span className="text-gold-bright">◉{p.fate}</span>
                  <span className={p.sanity <= 1 ? "text-ember" : "text-signal"}>✦{p.sanity}</span>
                  <span className={p.skill.state === "READY" ? "text-moss" : "text-ash"}>{t(`skill.state.${p.skill.state}`)}</span>
                  {p.away && <span className="text-ember">{t("players.away")}</span>}
                  {p.lost && <span className="text-ember">{t(g.city ? "s2.players.despair" : "players.lost")}</span>}
                  {g.city?.boat.aboard.includes(id) && <span className="text-signal">{t("s2.players.aboard")}</span>}
                  {tag?.(id)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
