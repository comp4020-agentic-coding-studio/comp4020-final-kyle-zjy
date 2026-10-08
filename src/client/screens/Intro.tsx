// INTRO phase: the boarding broadcast. Everyone's ticket is dealt; the run
// starts when every connected passenger has boarded: nobody is rushed.
import { motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { SCENARIO } from "../../shared/game/scenario01/content.ts";
import { Avatar } from "../components/Avatar.tsx";
import { HostSkip } from "../game/HostSkip.tsx";
import { notYet } from "../game/waiting.ts";
import { useScenarioText, useT, type MessageKey } from "../i18n/index.ts";
import { sendGame, useGame } from "../store.ts";
import { CityIntro } from "./CityScreens.tsx";

const LINES: { key: MessageKey; broadcast?: boolean }[] = [
  { key: "intro.line1" },
  { key: "intro.line2" },
  { key: "intro.line3", broadcast: true },
  { key: "intro.line4", broadcast: true },
  { key: "intro.line5" },
  { key: "intro.line6" },
  { key: "intro.line7", broadcast: true },
];

const STEP = 0.9;

export function Intro() {
  const g = useGame();
  const t = useT();
  const text = useScenarioText();
  if (!g) return null;
  if (g.city) return <CityIntro g={g} />;
  const after = LINES.length * STEP + 0.4;
  const boarded = g.sequence?.acks.includes(g.viewerId) ?? false;
  return (
    <main className="relative min-h-dvh overflow-hidden bg-black px-4 py-10">
      <div className="mx-auto max-w-xl">
        <p className="label text-signal">
          {t("intro.route", { n: SCENARIO.number })}
        </p>
        <ol className="mt-6 space-y-3">
          {LINES.map((l, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * STEP, duration: 0.6 }} className={l.broadcast ? "led-amber text-[15px]" : "font-display text-xl text-moon sm:text-2xl"}>
              {l.broadcast && <span className="mr-2 text-ash">&gt;</span>}
              {t(l.key)}
            </motion.li>
          ))}
        </ol>

        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: after, duration: 1 }} className="mt-10">
          <p className="font-display text-xl text-mist">{t("intro.ticket")}</p>
          <p className="mt-2 font-display text-3xl text-gold-bright italic">{t("intro.ticketBack")}</p>
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
                      {text.zodiac[ch.zodiac].name} {ch.mbti}
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </ul>
          {g.nightRule && (
            <div className="mt-6 rounded-xl border border-gold/30 p-3">
              <p className="label text-gold">{t("intro.rule", { name: text.nightRules[g.nightRule].name })}</p>
              <p className="mt-1 text-sm text-mist">{text.nightRules[g.nightRule].text}</p>
            </div>
          )}
          <button className="btn btn-gold mt-6 w-full" disabled={boarded} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>
            {boarded ? t("intro.boarded", { names: notYet(g, t) }) : t("intro.board")}
          </button>
        </motion.section>
      </div>
      <HostSkip g={g} />
    </main>
  );
}
