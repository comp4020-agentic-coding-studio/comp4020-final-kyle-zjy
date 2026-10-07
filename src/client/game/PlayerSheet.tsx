// A passenger's public card: character, ability state, resources, statuses.
// Shows only what the server sent: hidden statuses of others never arrive.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { CARRIAGES, ITEMS, MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import { statusShort } from "../../shared/game/scenario01/statuses.ts";
import type { PlayerView, PublicPlayerState } from "../../shared/game/state.ts";
import { CharacterCard } from "../components/CharacterCard.tsx";
import { Drawer } from "./Drawer.tsx";

export function PlayerSheet({ g, p, onClose }: { g: PlayerView; p: PublicPlayerState; onClose: () => void }) {
  const live = g.players[p.playerId] ?? p;
  const ch = getCharacterById(live.characterId);
  const identity = g.carriages[live.carriageIndex]?.identity ?? "START";
  return (
    <Drawer title={live.nickname} onClose={onClose}>
      <div className="space-y-3">
        <CharacterCard zodiac={ch.zodiac} mbti={ch.mbti} />
        <p className="text-sm">
          Ability: <span className={live.skill.state === "READY" ? "text-moss" : "text-ember"}>{live.skill.state}</span>
          {live.skill.borrowed ? ` (borrowed: ${getCharacterById(live.skill.borrowed).skill.name})` : ""}
        </p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat k="Fate" v={String(live.fate)} />
          <Stat k="Sanity" v={`${live.sanity}/${MAX_SANITY}`} />
          <Stat k="Shields" v={String(live.shields)} />
        </dl>
        <p className="text-sm text-mist">
          In the <span className="text-moon">{CARRIAGES[identity].name}</span>
          {live.lost ? " · LOST" : ""}
          {live.away ? " · away" : ""}
        </p>
        <div>
          <p className="label">Items</p>
          <p className="mt-1 text-sm text-mist">{live.items.length ? live.items.map((i) => ITEMS[i].name).join(", ") : "None"}</p>
        </div>
        <div>
          <p className="label">Statuses</p>
          <p className="mt-1 text-sm text-mist">{live.statuses.length ? live.statuses.map((s) => statusShort(s.kind)).join(", ") : "None"}</p>
        </div>
      </div>
    </Drawer>
  );
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-lg border border-indigo p-2">
    <dt className="label text-[10px]">{k}</dt>
    <dd className="font-mono text-lg">{v}</dd>
  </div>
);
