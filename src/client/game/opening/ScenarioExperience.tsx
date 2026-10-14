import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { worldPressure } from "../fx/pressure.ts";
import { useStageFx } from "../fx/useStageFx.ts";
import "../../styles/stage.css";
import { AudioControl } from "../../audio/AudioControl.tsx";
import { audio } from "../../audio/manager.ts";
import { gameplayScore } from "../../audio/score.ts";
import { useT } from "../../i18n/index.ts";
import { sendGame, useGame, useStore } from "../../store.ts";
import { OPENINGS } from "./definitions.ts";
import { openingKey, rememberOpening, shouldOpen } from "./memory.ts";
import { ScenarioOpening } from "./ScenarioOpening.tsx";
import { endingFacts, endingFor, endingKey, endingWatched, rememberEnding, type EndingId } from "../ending/cinematics.ts";
import { EndingFilm } from "../ending/EndingFilm.tsx";
import { EndingFilmDone } from "../ending/done.ts";
import { BubbleGuide } from "../../components/guide/BubbleGuide.tsx";
import { guideSeen, rememberGuide } from "../../components/guide/steps.ts";

/** Stable across the server's INTRO → act transition; no local game logic. */
export function ScenarioExperience({ children }: { children: ReactNode }) {
  const g = useGame()!;
  const status = useStore((s) => s.status);
  const t = useT();
  const definition = OPENINGS[g.scenarioId];
  const [playing, setPlaying] = useState(() => shouldOpen(g));
  const [handoff, setHandoff] = useState(false);
  const [hint, setHint] = useState(false);
  const acknowledging = useRef(false);
  const game = useRef<HTMLDivElement>(null);
  const key = openingKey(g);
  const score = gameplayScore(g);
  const finish = useCallback(() => { setPlaying(false); setHandoff(false); setHint(true); }, []);
  const beginHandoff = useCallback(() => setHandoff(true), []);
  // The server has already decided the ending; this viewer's film plays once per run, locally.
  const over = g.phase === "ENDING" || g.phase === "RESULTS";
  const ending = over ? endingFor(g) : null;
  const filmKey = ending ? endingKey(g, ending) : null;
  const [film, setFilm] = useState<EndingId | null>(null);
  const [filmDone, setFilmDone] = useState(false);
  useEffect(() => {
    if (ending && filmKey && !film && !filmDone) {
      if (endingWatched(filmKey)) setFilmDone(true);
      else setFilm(ending);
    }
  }, [ending, filmKey, film, filmDone]);
  const endFilm = useCallback(() => {
    if (filmKey) rememberEnding(filmKey);
    setFilm(null);
    setFilmDone(true);
  }, [filmKey]);
  // the first-view guide: once the opening is over, the first time on this device for this scenario
  const inPlay = g.phase === "ACT_1" || g.phase === "ACT_2" || g.phase === "ACT_3" || g.phase === "ACT_4";
  // a scene card, a roll or a decision has the screen: the tour waits until the table is clear
  const clear = inPlay && !g.sequence && !(g.roll && !g.roll.done) && !g.pending.some((w) => w.addressees.includes(g.viewerId));
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    if (playing || film || !clear || guideSeen(g.scenarioId)) return;
    const timer = setTimeout(() => { rememberGuide(g.scenarioId); setGuide(true); }, 600);
    return () => clearTimeout(timer);
  }, [playing, film, clear, g.scenarioId]);
  useEffect(() => {
    const replay = () => setGuide(true);
    window.addEventListener("fate:guide", replay);
    return () => window.removeEventListener("fate:guide", replay);
  }, []);
  const endGuide = useCallback(() => setGuide(false), []);
  // after the film this viewer goes straight to the recap; the server moves on once everyone has
  useEffect(() => {
    if (!filmDone || status !== "online" || g.phase !== "ENDING" || g.sequence?.acks.includes(g.viewerId) || acknowledging.current) return;
    acknowledging.current = true;
    void sendGame({ type: "ACK_SEQUENCE" }).finally(() => { acknowledging.current = false; });
  }, [filmDone, status, g.phase, g.sequence?.acks, g.viewerId]);

  // Acquire before child passive effects emit the first siren/paper cue.
  useLayoutEffect(() => audio.acquire(), []);
  useStageFx(g);
  useEffect(() => { if (playing) rememberOpening(key); }, [key, playing]);
  useEffect(() => {
    // The cinematic owns its mix until handoff; background server phase changes
    // must not reset an already-playing opening cue.
    if ((playing && !handoff) || film) return;
    audio.tension(.65);
    audio.setTheme(score);
  }, [playing, handoff, score, film]);
  useEffect(() => {
    // Existing readiness is acknowledged independently of cinematic playback.
    if (status !== "online" || g.phase !== "INTRO" || g.sequence?.acks.includes(g.viewerId) || acknowledging.current) return;
    acknowledging.current = true;
    void sendGame({ type: "ACK_SEQUENCE" }).finally(() => { acknowledging.current = false; });
  }, [status, g.phase, g.version, g.sequence?.acks, g.viewerId]);
  useEffect(() => { if (!playing && !film) game.current?.focus({ preventScroll: true }); }, [playing, film]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(false), 12000);
    return () => clearTimeout(timer);
  }, [hint]);

  const location = g.temporal?.locations[g.viewerId];
  const pressure = worldPressure(g);
  return <>
    <div ref={game} tabIndex={-1} inert={playing || !!film} aria-hidden={playing || !!film || undefined} data-pressure={pressure.band} style={{ "--pressure": pressure.level } as CSSProperties} className={`stage-root stage-${definition.variant} s3-game-entry game-entry-${definition.variant} ${playing ? handoff ? "is-entering" : "is-covered" : ""}`}>
      <div className="s3-game-audio">{inPlay && <button type="button" className="btn btn-ghost s3-audio-control" onClick={() => setGuide(true)} aria-label={t("guide.replay")}>?</button>}<AudioControl /></div>
      {hint && <aside className="s3-entry-hint" role="status">{location ? <><strong>{t("s3.open.started")}</strong><p>{t("s3.open.location", { year: t(`s3.year.short.${location.year}`), room: t(`s3.room.${location.roomId}`) })}</p><p>{t(definition.hint)}</p></> : <p>{t(definition.hint)}</p>}</aside>}
      <EndingFilmDone.Provider value={!!ending && filmDone}>{children}</EndingFilmDone.Provider>
    </div>
    {guide && clear && !playing && !film && <BubbleGuide scenario={g.scenarioId} onDone={endGuide} />}
    {film && <EndingFilm id={film} facts={endingFacts(g)} onDone={endFilm} />}
    {playing && <ScenarioOpening definition={definition} names={g.turnOrder.map((id) => g.players[id].nickname)} onComplete={finish} onHandoff={beginHandoff} />}
  </>;
}
