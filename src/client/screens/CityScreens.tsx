// Scenario 02's intro, ending and results. Its ending is personal: the boat
// leaves with some and without others, so each player first sees how their
// own run ended, then everyone's.
import { motion } from "motion/react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { EscapeFate, PlayerResult, PlayerView } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { HostSkip } from "../game/HostSkip.tsx";
import { notYet } from "../game/waiting.ts";
import { useCharacterText, useFormat, useScenario02Text, useScenarioText, useT, type MessageKey } from "../i18n/index.ts";
import { navigate } from "../router.ts";
import { sendGame, sendLobby, useMe } from "../store.ts";

const LINES: { key: MessageKey; broadcast?: boolean }[] = [
  { key: "s2.intro.line1" },
  { key: "s2.intro.line2", broadcast: true },
  { key: "s2.intro.line3" },
  { key: "s2.intro.line4", broadcast: true },
  { key: "s2.intro.line5" },
  { key: "s2.intro.line6" },
];
const STEP = 0.9;

export function CityIntro({ g }: { g: PlayerView }) {
  const t = useT();
  const text = useScenarioText();
  const city = useScenario02Text();
  const after = LINES.length * STEP + 0.4;
  const ready = g.sequence?.acks.includes(g.viewerId) ?? false;
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#020a14] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <p className="label text-signal">{t("s2.intro.kicker")}</p>
        <h1 className="mt-2 font-display text-3xl text-moon">{city.scenario.title}</h1>
        <ol className="mt-6 space-y-3">
          {LINES.map((l, i) => (
            <motion.li key={l.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * STEP, duration: 0.6 }} className={l.broadcast ? "led-amber text-[15px]" : "font-display text-xl text-moon sm:text-2xl"}>
              {l.broadcast && <span className="mr-2 text-ash">&gt;</span>}
              {t(l.key)}
            </motion.li>
          ))}
        </ol>
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: after, duration: 1 }} className="mt-10">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {g.turnOrder.map((id) => {
              const p = g.players[id];
              const ch = getCharacterById(p.characterId);
              return (
                <li key={id} className="ticket flex items-center gap-2 py-2 pr-2 pl-4">
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
                </li>
              );
            })}
          </ul>
          <div className="mt-6 rounded-xl border border-gold/30 p-3 text-sm text-mist">{t("s2.intro.rule")}</div>
          <button className="btn btn-gold mt-6 w-full" disabled={ready} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>
            {ready ? t("s2.intro.ready", { names: notYet(g, t) }) : t("s2.intro.begin")}
          </button>
        </motion.section>
      </div>
      <HostSkip g={g} />
    </main>
  );
}

const TINT: Record<EscapeFate, string> = { ESCAPED: "#0d2a33", GATEKEEPER: "#2a1f05", LEFT_BEHIND: "#1b1430", DROWNED: "#04101f" };

/** The closing scene: each player's own fate first. */
export function CityEnding({ g }: { g: PlayerView }) {
  const t = useT();
  const fate = g.results?.find((r) => r.playerId === g.viewerId)?.escape ?? "DROWNED";
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  const lines = [t(`s2.end.${fate}.line1`), t(`s2.end.${fate}.line2`)];
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10" style={{ background: `radial-gradient(circle at 50% 35%, ${TINT[fate]}, #000000 72%)` }} role="dialog" aria-label={t(`s2.end.${fate}.title`)}>
      <div className="w-full max-w-md text-center">
        <motion.p className={`label ${fate === "ESCAPED" || fate === "GATEKEEPER" ? "text-gold-bright" : "text-ember"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {t(`s2.end.${fate}.kicker`)}
        </motion.p>
        <motion.h1 className="mt-4 font-display text-4xl leading-tight font-semibold text-moon sm:text-5xl" initial={{ opacity: 0, filter: "blur(10px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ delay: 0.7, duration: 1.4 }}>
          {t(`s2.end.${fate}.title`)}
        </motion.h1>
        {lines.map((l, i) => (
          <motion.p key={i} className="mt-2 text-mist" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 + i * 0.7 }}>
            {l}
          </motion.p>
        ))}
        <motion.p className="mt-4 font-mono text-sm text-gold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.4 }}>
          {g.outcome === "S02_EVACUATED" ? t("s2.results.evacuated", { n: g.city!.boat.aboard.length, total: g.turnOrder.length }) : t("s2.results.none")}
        </motion.p>
        <motion.button className="btn btn-gold mt-10 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.8 }}>
          {acked ? t("common.waitingFor", { names: notYet(g, t) }) : t("ending.results")}
        </motion.button>
      </div>
      <HostSkip g={g} />
    </main>
  );
}

export function CityResults({ g }: { g: PlayerView }) {
  const t = useT();
  const me = useMe();
  if (!g.results) return null;
  const mine = g.results.find((r) => r.playerId === g.viewerId);
  const others = g.results.filter((r) => r.playerId !== g.viewerId);
  const b = g.city!.boat;
  const summary: [string, string][] = [
    [t("results.rounds"), String(g.round)],
    [t("results.collapse"), `${g.collapse} / ${g.collapseMax}`],
    [t("s2.results.aboard"), `${b.aboard.length} / ${b.capacity ?? "?"}`],
    [t("s2.results.gate"), b.gatekeeper ? g.players[b.gatekeeper].nickname : b.autoGate ? t("s2.results.chip") : "—"],
  ];
  return (
    <main className="night-sky min-h-dvh px-4 py-8 sm:py-12">
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6">
        <header className="text-center">
          <p className={`label ${g.outcome === "S02_EVACUATED" ? "text-gold-bright" : "text-ember"}`}>{g.outcome === "S02_EVACUATED" ? t("s2.results.evacuated", { n: b.aboard.length, total: g.turnOrder.length }) : t("s2.results.none")}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-moon sm:text-5xl">{t(`s2.end.${mine?.escape ?? "DROWNED"}.title`)}</h1>
          {g.failReason === "BOAT_LOST" && <p className="mt-2 text-sm text-mist">{t("s2.results.boatLost")}</p>}
          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-xl border border-gold/20 px-2 py-2">
                <dt className="label text-[10px] text-mist">{k}</dt>
                <dd className="mt-0.5 truncate font-mono text-lg text-moon">{v}</dd>
              </div>
            ))}
          </dl>
        </header>
        {mine && <FateCard g={g} r={mine} highlight />}
        {others.length > 0 && (
          <section aria-label={t("results.others")} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            {others.map((r) => (
              <FateCard key={r.playerId} g={g} r={r} />
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

function FateCard({ g, r, highlight = false }: { g: PlayerView; r: PlayerResult; highlight?: boolean }) {
  const t = useT();
  const fmt = useFormat();
  const p = g.players[r.playerId];
  const ch = getCharacterById(p.characterId);
  const charTitle = useCharacterText()(ch.id).title;
  const fate = r.escape ?? "DROWNED";
  return (
    <article className={`tarot min-w-0 p-5 ${highlight ? "ring-1 ring-gold/60" : ""}`} aria-label={t("results.cardAria", { name: p.nickname, title: fmt(r.title) })}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={highlight ? 72 : 56} dim={fate !== "ESCAPED"} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-moon">{p.nickname}</p>
          <p className="truncate text-xs text-mist">{charTitle}</p>
          <p className="mt-1 font-display text-xl text-gold-bright">{fmt(r.title)}</p>
        </div>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-1 font-mono text-[10px] font-bold ${fate === "ESCAPED" ? "bg-moss/20 text-moss" : fate === "GATEKEEPER" ? "bg-gold/20 text-gold-bright" : "bg-ember/15 text-ember"}`}>{t(`s2.results.fate.${fate}`)}</span>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-mist">
        {r.highlights.map((h, i) => (
          <li key={i}>· {fmt(h)}</li>
        ))}
      </ul>
    </article>
  );
}
