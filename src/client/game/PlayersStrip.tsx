// Layer three: everyone else at a glance. Compact chips (portrait, Fate,
// Sanity, ability state); tap one for the full card.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { PlayerView, PublicPlayerState } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";

export function PlayersStrip({ g, onOpen }: { g: PlayerView; onOpen: (p: PublicPlayerState) => void }) {
  const active = g.step === "PLAYER_TURNS" ? g.turnOrder[g.activeIndex] : null;
  return (
    <ul className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-3 pb-1 sm:px-4" aria-label="Passengers">
      {g.turnOrder.map((id) => {
        const p = g.players[id];
        const ch = getCharacterById(p.characterId);
        const nb = g.seatNeighbours.find((grp) => grp.includes(g.viewerId))?.includes(id) && id !== g.viewerId;
        return (
          <li key={id} className="shrink-0">
            <button
              onClick={() => onOpen(p)}
              className={`flex min-h-12 items-center gap-2 rounded-full border py-1 pr-3 pl-1 ${id === active ? "border-signal bg-signal/10" : id === g.viewerId ? "border-gold/50" : "border-[#262d55]"}`}
              aria-label={`${p.nickname}${id === g.viewerId ? " (you)" : ""}: Fate ${p.fate}, Sanity ${p.sanity}${p.lost ? ", lost" : ""}${p.away ? ", away" : ""}, ability ${p.skill.state.toLowerCase()}`}
            >
              <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={32} dim={p.away || p.lost} />
              <span className="text-left leading-tight">
                <span className="block max-w-[6.5rem] truncate text-xs font-semibold">
                  {p.nickname}
                  {nb ? " · neighbour" : ""}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-mist">
                  <span className="text-gold-bright">◉{p.fate}</span>
                  <span className={p.sanity <= 1 ? "text-ember" : "text-signal"}>✦{p.sanity}</span>
                  <span className={p.skill.state === "READY" ? "text-moss" : "text-ash"}>{p.skill.state === "READY" ? "READY" : p.skill.state === "LOCKED" ? "LOCKED" : "BURNED"}</span>
                  {p.away && <span className="text-ember">AWAY</span>}
                  {p.lost && <span className="text-ember">LOST</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
