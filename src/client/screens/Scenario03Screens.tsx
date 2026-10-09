// Scenario 03 (Incident Zero): the intro, the run on scenario 02's layout
// (src/client/game/scenario03/ holds its map, panels, dock actions and private
// drawer), the identity and third-route scenes, the ending and the results.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { RoomId03, Year03 } from "../../shared/game/scenario03/map.ts";
import type { PlayerView, PublicPlayerState } from "../../shared/game/state.ts";
import { Banner } from "../game/Banner.tsx";
import { CueFeed } from "../game/CueFeed.tsx";
import { DecisionLayer } from "../game/Decision.tsx";
import { DiceOverlay } from "../game/Dice.tsx";
import { Dock, type Mode } from "../game/Dock.tsx";
import { EventPanel } from "../game/EventPanel.tsx";
import { HostSkip } from "../game/HostSkip.tsx";
import { LogDrawer } from "../game/LogDrawer.tsx";
import { PlayerSheet } from "../game/PlayerSheet.tsx";
import { PlayersStrip } from "../game/PlayersStrip.tsx";
import { SecretsDrawer } from "../game/SecretsDrawer.tsx";
import { DOCK03 } from "../game/scenario03/dock03.tsx";
import { Map03 } from "../game/scenario03/Map03.tsx";
import { Objective03, RoomPanel03, TopBar03 } from "../game/scenario03/Panels03.tsx";
import { Private03 } from "../game/scenario03/Private03.tsx";
import { useFormat, useT } from "../i18n/index.ts";
import { sendGame, sendLobby, useGame, useMe, useStore } from "../store.ts";
import "../styles/scenario03.css";

function Frame({ children }: { children: React.ReactNode }) {
  return <main className="night-sky relative min-h-dvh px-3 py-5 text-moon sm:px-6"><div className="mx-auto max-w-5xl">{children}</div></main>;
}

export function Scenario03Intro() {
  const g = useGame();
  const t = useT();
  if (!g) return null;
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  return <Frame>
    <section className="tarot s3-scene-card mx-auto mt-10 max-w-xl p-6 text-center">
      <p className="label text-signal">{t("s3.development")}</p>
      <p className="s3-scene-clock" aria-hidden="true">23:47</p>
      <h1 className="mt-4 font-display text-4xl text-gold-bright">{t("s3.title")}</h1>
      <p className="mt-3 text-mist italic">{t("s3.subtitle")}</p>
      <p className="mt-8 text-lg">{t("s3.intro")}</p>
      <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>
        {acked ? t("s3.waiting") : t("s3.begin")}
      </button>
    </section>
    <HostSkip g={g} />
  </Frame>;
}

/**
 * The run, on scenario 02's layout: the top bar (act, cycle, temporal collapse,
 * log and secrets), the turn banner and objective, the branching map in the
 * year on view (the 1996 / 2026 switch and the causal ripple are this
 * scenario's own), the selected room, the players, and the shared dock.
 */
export function Scenario03Game() {
  const g = useGame();
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);
  const [drawer, setDrawer] = useState<null | "log" | "secrets">(null);
  const [sheet, setSheet] = useState<PublicPlayerState | null>(null);
  const [looking, setLooking] = useState<RoomId03 | null>(null);
  const [viewYear, setViewYear] = useState<Year03>("Y2026");
  const [ripple, setRipple] = useState(false);
  const [jumpFlash, setJumpFlash] = useState<{ key: string; year: Year03 } | null>(null);
  const jumpCue = useStore((s) => s.cues.findLast((c) => c.kind === "TIME_JUMP" && c.payload.playerId === s.playerId));
  const seenJump = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();
  const priorRevision = useRef<number | null>(null);
  const current = g?.temporal?.locations[g.viewerId];
  useEffect(() => {
    if (!current) return;
    setViewYear(current.year);
    setLooking(null);
  }, [current?.year, current?.roomId]);
  useEffect(() => {
    const revision = g?.temporal?.causalRevision;
    if (revision === undefined) return;
    if (priorRevision.current !== null && revision > priorRevision.current) {
      setRipple(true);
      const timer = setTimeout(() => setRipple(false), 1200);
      priorRevision.current = revision;
      return () => clearTimeout(timer);
    }
    priorRevision.current = revision;
  }, [g?.temporal?.causalRevision]);
  useEffect(() => {
    if (!jumpCue || seenJump.current === jumpCue.key) return;
    seenJump.current = jumpCue.key;
    if (Date.now() - jumpCue.at > 1500) return;
    const year = jumpCue.payload.year;
    if (year !== "Y1996" && year !== "Y2026") return;
    setJumpFlash({ key: jumpCue.key, year });
    const timer = setTimeout(() => setJumpFlash(null), 650);
    return () => clearTimeout(timer);
  }, [jumpCue]);
  if (!g?.temporal || !current) return null;

  const move = g.myActions.find((a) => a.type === "MOVE");
  const moveTargets = mode === "MOVE" && move?.enabled ? (move.targets ?? []).map(Number) : [];
  const secrets = g.temporal.myEvidence.length + g.temporal.myItems.length + (g.mySecrets?.peeks.length ?? 0);
  const room = looking ?? current.roomId;
  const yearOf = (id: string) => g.temporal!.locations[id]?.year;

  return (
    <main className="night-sky relative flex min-h-dvh flex-col">
      <TopBar03 g={g} onLog={() => setDrawer("log")} onSecrets={() => setDrawer("secrets")} secretsCount={secrets} />
      <Banner g={g} />
      <Objective03 g={g} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 py-1">
        <div className="relative mx-auto w-full max-w-6xl px-3 sm:px-4">
          {/* the year switch: a row above the map; on wide screens, in the map's left margin */}
          <div className="s3-timeline-switch grid grid-cols-2 gap-2 xl:absolute xl:top-2 xl:left-6 xl:z-10 xl:w-48 xl:grid-cols-1" role="group" aria-label={t("s3.timeline.title")}>
            {(["Y1996", "Y2026"] as const).map((year) => (
              <button
                key={year}
                className={`btn min-w-0 text-sm xl:px-3 xl:text-xs ${year === viewYear ? (year === "Y1996" ? "btn-gold" : "btn-signal") : "btn-ghost"}`}
                aria-pressed={year === viewYear}
                aria-label={t("s3.map.year", { year: t(`s3.year.short.${year}`) })}
                onClick={() => {
                  setViewYear(year);
                  setLooking(null);
                }}
              >
                <span className="min-w-0 truncate">{t(year === "Y1996" ? "s3.timeline.past" : "s3.timeline.present")}</span>
              </button>
            ))}
          </div>
          <div className="mt-1.5 xl:mt-0">
            <Map03
              g={g}
              year={viewYear}
              ripple={ripple}
              selected={room}
              onSelect={(r) => setLooking(r === current.roomId && viewYear === current.year ? null : r)}
              moveTargets={moveTargets}
              onMove={(place) => {
                setMode(null);
                setLooking(null);
                void sendGame({ type: "MOVE", toCarriage: place });
              }}
            />
          </div>
          {ripple && (
            <p className="mt-1 text-sm text-signal" role="status">
              {t("s3.causal.ripple")}
            </p>
          )}
        </div>
        <RoomPanel03
          g={g}
          room={room}
          year={viewYear}
          onBack={() => {
            setLooking(null);
            setViewYear(current.year);
          }}
        />
        <EventPanel g={g} />
        <PlayersStrip g={g} onOpen={setSheet} tag={(id) => yearOf(id) && <span className={yearOf(id) === "Y1996" ? "text-gold" : "text-signal"}>{t(`s3.year.short.${yearOf(id)!}`)}</span>} />
      </div>
      <Dock g={g} mode={mode} setMode={setMode} extension={DOCK03} />

      <CueFeed g={g} />
      <AnimatePresence>
        {jumpFlash && <motion.div
          key={jumpFlash.key}
          className={`s3-jump-veil ${jumpFlash.year === "Y1996" ? "s3-jump-past" : "s3-jump-present"}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.12 }}
          role="status" aria-live="polite"
        >
          <motion.div className="s3-jump-clock" initial={reduceMotion ? false : { scale: 0.75, rotate: -25 }} animate={reduceMotion ? {} : { scale: 1.08, rotate: 20 }} transition={{ duration: 0.52, ease: "easeOut" }} aria-hidden="true" />
          <p className="s3-jump-label">{t("s3.jump.arrival", { year: t(`s3.year.short.${jumpFlash.year}`) })}</p>
        </motion.div>}
      </AnimatePresence>
      <DiceOverlay g={g} />
      <DecisionLayer g={g} />
      <HostSkip g={g} />
      {!g.pending.length && g.sequence?.kind === "S3_IDENTITY" && <IdentitySequence03 g={g} />}
      {!g.pending.length && g.sequence?.kind === "S3_THIRD_ROUTE" && <ThirdRouteSequence03 g={g} />}
      <AnimatePresence>
        {drawer === "log" && <LogDrawer key="log" g={g} title={t("s3.top.log")} onClose={() => setDrawer(null)} />}
        {drawer === "secrets" && <SecretsDrawer key="secrets" g={g} sections={<Private03 g={g} />} onClose={() => setDrawer(null)} />}
        {sheet && <PlayerSheet key="sheet" g={g} p={sheet} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </main>
  );
}

function IdentitySequence03({ g }: { g: PlayerView }) {
  const t = useT();
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  return <motion.div className="s3-reveal s3-identity fixed inset-0 z-[60] overflow-y-auto bg-void px-4 py-6 text-moon" role="dialog" aria-modal="true" aria-label={t("s3.identity.title")} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="s3-reveal-content mx-auto flex min-h-full max-w-xl flex-col justify-center py-6 text-center">
      <p className="label text-signal">{t("s3.identity.kicker")}</p>
      <motion.h2 className="mt-4 font-display text-4xl leading-tight text-gold-bright" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>{t("s3.identity.title")}</motion.h2>
      <p className="mt-4 text-mist">{t("s3.identity.body")}</p>
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">{g.temporal!.identityMatches.map((match, index) => <motion.p key={match.signature} className="min-w-0 rounded-xl border border-signal/40 bg-signal/10 p-3 font-mono text-sm" initial={{ opacity: 0, filter: "blur(8px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ delay: 0.6 + index * 0.2 }}>{t("s3.intruders.match", { signature: match.signature, name: g.players[match.playerId].nickname })}</motion.p>)}</div>
      <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>{acked ? t("s3.waiting") : t("s3.identity.next")}</button>
    </div>
  </motion.div>;
}

function ThirdRouteSequence03({ g }: { g: PlayerView }) {
  const t = useT();
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  return <motion.div className="s3-reveal s3-third-route fixed inset-0 z-[60] overflow-y-auto bg-void px-4 py-6 text-moon" role="dialog" aria-modal="true" aria-label={t("s3.route.sceneTitle")} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="s3-reveal-content mx-auto flex min-h-full max-w-xl flex-col justify-center py-6 text-center">
      <p className="label text-signal">{t("s3.route.kicker")}</p>
      <motion.h2 className="mt-4 font-display text-4xl leading-tight text-gold-bright" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>{t("s3.route.sceneTitle")}</motion.h2>
      <p className="mt-4 text-mist">{t("s3.route.body")}</p>
      <ul className="mt-6 grid grid-cols-1 gap-2">{g.temporal!.story.availableRoutes.map((id) => <li key={id} className="rounded-xl border border-signal/40 bg-signal/10 p-3 text-sm">{t(`s3.route.${id}`)}</li>)}</ul>
      <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>{acked ? t("s3.waiting") : t("s3.route.next")}</button>
    </div>
  </motion.div>;
}

export function Scenario03Ending() {
  const g = useGame();
  const t = useT();
  if (!g) return null;
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  const ending = g.outcome === "S03_OFFICIAL_HISTORY" || g.outcome === "S03_NO_TOMORROW" || g.outcome === "S03_DECEIVE_HISTORY" ? g.outcome : "FAILED";
  return <Frame>
    <section className={`tarot s3-scene-card s3-ending-card s3-ending-${ending} mx-auto mt-16 max-w-xl p-6 text-center`}>
      <p className="label text-signal">{t("s3.development")}</p>
      <h1 className="mt-4 font-display text-4xl">{t(`s3.ending.${ending}.title`)}</h1>
      <p className="mt-4 text-mist">{t(`s3.ending.${ending}.body`)}</p>
      <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>{acked ? t("s3.waiting") : t("s3.results")}</button>
    </section>
    <HostSkip g={g} />
  </Frame>;
}

export function Scenario03Results() {
  const g = useGame();
  const t = useT();
  const fmt = useFormat();
  const me = useMe();
  if (!g?.temporal) return null;
  const ending = g.outcome === "S03_OFFICIAL_HISTORY" || g.outcome === "S03_NO_TOMORROW" || g.outcome === "S03_DECEIVE_HISTORY" ? g.outcome : "FAILED";
  return <Frame>
    <section className={`tarot s3-scene-card s3-ending-card s3-ending-${ending} mx-auto mt-16 max-w-xl p-6 text-center`}>
      <p className="label text-signal">{t("s3.development")}</p>
      <h1 className="mt-4 font-display text-4xl">{t("s3.results.title")}</h1>
      <p className="mt-4 text-xl text-gold-bright">{t(`s3.ending.${ending}.title`)}</p>
      <p className="mt-3 text-mist">{t(`s3.ending.${ending}.body`)}</p>
      <p className="mt-4 text-sm">{t("s3.results.relics", { n: g.temporal.bootstrapProgress.placed, total: g.temporal.bootstrapProgress.total })}</p>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{g.results?.map((result) => <div key={result.playerId} className="min-w-0 rounded-xl border border-gold/20 p-3 text-left text-sm"><p className="text-gold-bright">{t("s3.results.player", { name: g.players[result.playerId].nickname, title: fmt(result.title) })}</p>{result.highlights.map((line, index) => <p key={index} className="mt-1 text-mist">{fmt(line)}</p>)}</div>)}</div>
      {me?.isHost ? <button className="btn btn-gold mt-8 w-full" onClick={() => void sendLobby({ type: "RESTART" })}>{t("s3.results.back")}</button> : <p className="mt-8 text-sm text-mist">{t("s3.results.wait")}</p>}
    </section>
  </Frame>;
}
