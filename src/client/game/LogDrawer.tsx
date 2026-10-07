// The train log: every public line, newest first, with the in-fiction clock.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { useFormat, useT } from "../i18n/index.ts";
import { Drawer } from "./Drawer.tsx";

const TONE: Record<string, string> = {
  ROUND: "text-gold-bright font-display text-base",
  STORY: "text-moon italic",
  EVENT: "text-gold",
  LOST: "text-ember",
  COLLAPSE_UP: "text-ember",
  ROLL_DISASTER: "text-ember",
  ROLL_PERFECT: "text-gold-bright",
  ROLL_SUCCESS: "text-moss",
  FRAGMENT: "text-violet-soft",
  CORE: "text-violet-soft",
  SKILL: "text-signal",
  INSPECTOR: "text-moon",
  ENDING_WIN: "text-gold-bright",
  ENDING_FAIL: "text-ember",
};

export function LogDrawer({ g, onClose }: { g: PlayerView; onClose: () => void }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <Drawer title={t("game.log")} onClose={onClose}>
      <ol className="space-y-2">
        {[...g.log].reverse().map((line) => {
          const p = line.actorId ? g.players[line.actorId] : null;
          const ch = p ? getCharacterById(p.characterId) : null;
          return (
            <li key={line.seq} className="flex gap-2 text-sm">
              <span className="w-11 shrink-0 font-mono text-[11px] text-ash">{line.clock}</span>
              {ch ? <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={22} className="mt-0.5 shrink-0" /> : <span className="w-[22px] shrink-0" />}
              <span className={`min-w-0 ${TONE[line.kind] ?? "text-mist"}`}>{line.msg ? fmt(line.msg) : line.text}</span>
            </li>
          );
        })}
      </ol>
    </Drawer>
  );
}
