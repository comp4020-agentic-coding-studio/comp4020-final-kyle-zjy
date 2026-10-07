// RESULTS phase: how the run went, what each passenger did, and the secrets
// that are finally revealed (obsessions, and which messages were true). The
// host takes the room back to the lobby for another run.
import { motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { endingText, OBSESSIONS, SCENARIO } from "../../shared/game/scenario01/content.ts";
import type { PlayerResult, PlayerView } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { navigate } from "../router.ts";
import { sendLobby, useGame, useMe } from "../store.ts";

export function Results() {
  const g = useGame();
  const me = useMe();
  if (!g?.outcome || !g.results) return null;
  const text = endingText(g.outcome, g.failReason);
  const mine = g.results.find((r) => r.playerId === g.viewerId);
  const others = g.results.filter((r) => r.playerId !== g.viewerId);
  return (
    <main className="night-sky min-h-dvh px-4 py-8 sm:py-12">
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6">
        <header className="text-center">
          <p className={`label ${text.won ? "text-gold-bright" : "text-ember"}`}>{text.kicker}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-moon sm:text-5xl">{text.title}</h1>
          <Summary g={g} />
        </header>

        {mine && <PlayerCard g={g} r={mine} highlight />}
        {others.length > 0 && (
          <section aria-label="The other passengers" className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            {others.map((r, i) => (
              <motion.div key={r.playerId} className="min-w-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i }}>
                <PlayerCard g={g} r={r} />
              </motion.div>
            ))}
          </section>
        )}

        <footer className="tarot grid grid-cols-1 gap-3 p-5 text-center">
          {me?.isHost ? (
            <>
              <button className="btn btn-gold w-full" onClick={() => void sendLobby({ type: "RESTART" })}>
                Back to the lobby for another run
              </button>
              <p className="text-xs text-mist">Everyone keeps their character and confirms again before the next departure.</p>
            </>
          ) : (
            <p className="text-sm text-mist" role="status">
              Waiting for the host to take everyone back to the lobby.
            </p>
          )}
          <button className="btn btn-ghost w-full" onClick={() => navigate("/")}>
            Leave for the platform
          </button>
        </footer>
      </div>
    </main>
  );
}

function Summary({ g }: { g: PlayerView }) {
  const items: [string, string][] = [
    ["Rounds", `${g.round} / ${SCENARIO.rounds}`],
    ["Collapse", `${g.collapse} / ${g.collapseMax}`],
    ["Anchors", `${Object.values(g.anchors).filter((a) => a.repaired).length} / 3`],
    ["Fragments", `${g.fragments.length} / 3`],
    ["Core memories", `${g.coreMemories} / 6`],
  ];
  return (
    <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 rounded-xl border border-gold/20 px-2 py-2">
          <dt className="label text-[10px] text-mist">{k}</dt>
          <dd className="mt-0.5 font-mono text-lg text-moon">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function PlayerCard({ g, r, highlight = false }: { g: PlayerView; r: PlayerResult; highlight?: boolean }) {
  const p = g.players[r.playerId];
  const ch = getCharacterById(p.characterId);
  const obsession = OBSESSIONS[r.obsession];
  return (
    <article className={`tarot min-w-0 p-5 ${highlight ? "ring-1 ring-gold/60" : ""}`} aria-label={`${p.nickname}: ${r.title}`}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={highlight ? 72 : 56} dim={p.lost} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-moon">
            {p.nickname}
            {highlight ? " (you)" : ""}
            {p.lost ? " · lost" : ""}
          </p>
          <p className="truncate text-xs text-mist">{ch.nickname}</p>
          <p className="mt-1 font-display text-xl leading-tight text-gold-bright">{r.title}</p>
        </div>
      </div>

      <div className={`mt-4 rounded-xl border p-3 ${r.obsessionMet ? "border-moss/50" : "border-ash/40"}`}>
        <p className={`label text-[10px] ${r.obsessionMet ? "text-moss" : "text-ash"}`}>Obsession · {r.obsessionMet ? "Fulfilled" : "Unfulfilled"}</p>
        <p className="mt-1 text-sm text-moon">{obsession.name}</p>
        <p className="text-xs text-mist">{obsession.text}</p>
      </div>

      <ul className="mt-3 space-y-1 text-sm text-mist">
        {r.highlights.filter((h) => !h.startsWith("Obsession")).map((h) => (
          <li key={h} className="flex gap-2">
            <span className="text-gold" aria-hidden="true">
              ·
            </span>
            {h}
          </li>
        ))}
      </ul>

      {r.messages.length > 0 && (
        <div className="mt-3 border-t border-gold/15 pt-3">
          <p className="label text-[10px] text-violet-soft">{highlight ? "Your" : "Their"} round-5 message</p>
          {r.messages.map((m, i) => (
            <p key={i} className="mt-1 text-sm text-moon">
              "{m.text}" <span className={`ml-1 font-mono text-[11px] font-bold ${m.isTrue ? "text-moss" : "text-ember"}`}>{m.isTrue ? "TRUE" : "FALSE"}</span>
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
