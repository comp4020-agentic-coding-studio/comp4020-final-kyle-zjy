// RESULTS phase: how the run went, what each passenger did, and the secrets
// that are finally revealed (obsessions, and which messages were true). The
// host takes the room back to the lobby for another run.
import { motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { SCENARIO } from "../../shared/game/scenario01/content.ts";
import type { PlayerResult, PlayerView } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { endingKey, endingWon } from "../game/ending.ts";
import { useCharacterText, useFormat, useScenarioText, useT } from "../i18n/index.ts";
import { navigate } from "../router.ts";
import { sendLobby, useGame, useMe } from "../store.ts";

export function Results() {
  const g = useGame();
  const me = useMe();
  const t = useT();
  const endings = useScenarioText().endings;
  if (!g?.outcome || !g.results) return null;
  const text = { ...endings[endingKey(g.outcome, g.failReason)], won: endingWon(g.outcome) };
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
          <section aria-label={t("results.others")} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
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
                {t("results.restart")}
              </button>
              <p className="text-xs text-mist">{t("results.restartNote")}</p>
            </>
          ) : (
            <p className="text-sm text-mist" role="status">
              {t("results.waitingHost")}
            </p>
          )}
          <button className="btn btn-ghost w-full" onClick={() => navigate("/")}>
            {t("results.leave")}
          </button>
        </footer>
      </div>
    </main>
  );
}

function Summary({ g }: { g: PlayerView }) {
  const t = useT();
  const items: [string, string][] = [
    [t("results.rounds"), `${g.round} / ${SCENARIO.rounds}`],
    [t("results.collapse"), `${g.collapse} / ${g.collapseMax}`],
    [t("results.anchors"), `${Object.values(g.anchors).filter((a) => a.repaired).length} / 3`],
    [t("results.fragments"), `${g.fragments.length} / 3`],
    [t("results.core"), `${g.coreMemories} / 6`],
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
  const t = useT();
  const fmt = useFormat();
  const obsession = useScenarioText().obsessions[r.obsession];
  const title = fmt(r.title);
  const charTitle = useCharacterText()(ch.id).title;
  return (
    <article className={`tarot min-w-0 p-5 ${highlight ? "ring-1 ring-gold/60" : ""}`} aria-label={t("results.cardAria", { name: p.nickname, title })}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={highlight ? 72 : 56} dim={p.lost} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-moon">
            {p.nickname}
            {highlight ? t("results.you") : ""}
            {p.lost ? t("results.lost") : ""}
          </p>
          <p className="truncate text-xs text-mist">{charTitle}</p>
          <p className="mt-1 font-display text-xl leading-tight text-gold-bright">{title}</p>
        </div>
      </div>

      <div className={`mt-4 rounded-xl border p-3 ${r.obsessionMet ? "border-moss/50" : "border-ash/40"}`}>
        <p className={`label text-[10px] ${r.obsessionMet ? "text-moss" : "text-ash"}`}>{t(r.obsessionMet ? "results.obsessionMet" : "results.obsessionUnmet")}</p>
        <p className="mt-1 text-sm text-moon">{obsession.name}</p>
        <p className="text-xs text-mist">{obsession.text}</p>
      </div>

      <ul className="mt-3 space-y-1 text-sm text-mist">
        {/* the obsession has its own box above */}
        {r.highlights.filter((h) => !(typeof h === "string" ? h : h.k).startsWith("Obsession")).map((h, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-gold" aria-hidden="true">
              ·
            </span>
            {fmt(h)}
          </li>
        ))}
      </ul>

      {r.messages.length > 0 && (
        <div className="mt-3 border-t border-gold/15 pt-3">
          <p className="label text-[10px] text-violet-soft">{t(highlight ? "results.yourMessage" : "results.theirMessage")}</p>
          {r.messages.map((m, i) => (
            <p key={i} className="mt-1 text-sm text-moon">
              {t("common.quote", { text: fmt(m.text) })} <span className={`ml-1 font-mono text-[11px] font-bold ${m.isTrue ? "text-moss" : "text-ember"}`}>{t(m.isTrue ? "results.true" : "results.false")}</span>
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
