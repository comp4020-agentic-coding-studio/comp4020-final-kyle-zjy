// INTRO phase: the boarding broadcast. Everyone's ticket is dealt; the run
// starts when every connected passenger has boarded: nobody is rushed.
import { motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { ZODIAC_INFO } from "../../shared/characters/signs.ts";
import { NIGHT_RULES, SCENARIO } from "../../shared/game/scenario01/content.ts";
import { Avatar } from "../components/Avatar.tsx";
import { HostSkip } from "../game/HostSkip.tsx";
import { notYet } from "../game/waiting.ts";
import { sendGame, useGame } from "../store.ts";

const LINES: { text: string; broadcast?: boolean }[] = [
  { text: "00:17. The metro stopped running an hour ago." },
  { text: "Every phone on the platform buzzes at once." },
  { text: "Train N13 is arriving.", broadcast: true },
  { text: "Terminus: ██████", broadcast: true },
  { text: "No staff. No other passengers. No working map." },
  { text: "A black train with no number pulls in. The doors close behind you." },
  { text: "Welcome aboard the last service. Passenger count is being confirmed.", broadcast: true },
];

const STEP = 0.9;

export function Intro() {
  const g = useGame();
  if (!g) return null;
  const after = LINES.length * STEP + 0.4;
  const boarded = g.sequence?.acks.includes(g.viewerId) ?? false;
  return (
    <main className="relative min-h-dvh overflow-hidden bg-black px-4 py-10">
      <div className="mx-auto max-w-xl">
        <p className="label text-signal">
          Scenario {SCENARIO.number} · Route N13
        </p>
        <ol className="mt-6 space-y-3">
          {LINES.map((l, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * STEP, duration: 0.6 }} className={l.broadcast ? "led-amber text-[15px]" : "font-display text-xl text-moon sm:text-2xl"}>
              {l.broadcast && <span className="mr-2 text-ash">&gt;</span>}
              {l.text}
            </motion.li>
          ))}
        </ol>

        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: after, duration: 1 }} className="mt-10">
          <p className="font-display text-xl text-mist">A ticket appears in every hand. On the back:</p>
          <p className="mt-2 font-display text-3xl text-gold-bright italic">"Prove you exist, or stay."</p>
          <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {g.turnOrder.map((id, i) => {
              const p = g.players[id];
              const ch = getCharacterById(p.characterId);
              return (
                <motion.li key={id} className="ticket flex items-center gap-2 py-2 pr-2 pl-4" initial={{ opacity: 0, rotateX: 90 }} animate={{ opacity: 1, rotateX: 0 }} transition={{ delay: after + 0.6 + i * 0.12 }}>
                  <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {p.nickname}
                      {g.sequence?.acks.includes(id) ? " ✓" : ""}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-mist">
                      {ZODIAC_INFO[ch.zodiac].name} {ch.mbti}
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </ul>
          <div className="mt-6 rounded-xl border border-gold/30 p-3">
            <p className="label text-gold">Tonight's rule · {NIGHT_RULES[g.nightRule].name}</p>
            <p className="mt-1 text-sm text-mist">{NIGHT_RULES[g.nightRule].text}</p>
          </div>
          <button className="btn btn-gold mt-6 w-full" disabled={boarded} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>
            {boarded ? `Boarded. Waiting for ${notYet(g)}…` : "Board the train"}
          </button>
        </motion.section>
      </div>
      <HostSkip g={g} />
    </main>
  );
}
