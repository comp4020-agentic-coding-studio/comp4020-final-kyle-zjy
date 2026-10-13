import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AudioControl } from "../../audio/AudioControl.tsx";
import { audio } from "../../audio/manager.ts";
import { useT } from "../../i18n/index.ts";
import { sendGame, useGame, useStore } from "../../store.ts";
import { OPENINGS } from "./definitions.ts";
import { openingKey, rememberOpening, shouldOpen } from "./memory.ts";
import { ScenarioOpening } from "./ScenarioOpening.tsx";

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
  const year = g.temporal?.locations[g.viewerId]?.year;
  const finish = useCallback(() => { setPlaying(false); setHandoff(false); setHint(true); }, []);
  const beginHandoff = useCallback(() => setHandoff(true), []);

  // Acquire before child passive effects emit the first siren/paper cue.
  useLayoutEffect(() => audio.acquire(), []);
  useEffect(() => { if (playing) rememberOpening(key); }, [key, playing]);
  useEffect(() => {
    if (!playing || handoff) audio.tension(.65);
    const firstTheme = definition.mix(definition.scenes[0].id, 0).theme ?? definition.introTheme;
    const ambient = g.scenarioId === "S03_INCIDENT_ZERO" && year === "Y1996" ? "scenario03_1996_ambient" : definition.ambientTheme;
    audio.setTheme(playing && !handoff ? firstTheme : ambient);
  }, [definition, playing, handoff, year, g.scenarioId]);
  useEffect(() => {
    // Existing readiness is acknowledged independently of cinematic playback.
    if (status !== "online" || g.phase !== "INTRO" || g.sequence?.acks.includes(g.viewerId) || acknowledging.current) return;
    acknowledging.current = true;
    void sendGame({ type: "ACK_SEQUENCE" }).finally(() => { acknowledging.current = false; });
  }, [status, g.phase, g.version, g.sequence?.acks, g.viewerId]);
  useEffect(() => { if (!playing) game.current?.focus({ preventScroll: true }); }, [playing]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(false), 12000);
    return () => clearTimeout(timer);
  }, [hint]);

  const location = g.temporal?.locations[g.viewerId];
  return <>
    <div ref={game} tabIndex={-1} inert={playing} aria-hidden={playing || undefined} className={`s3-game-entry game-entry-${definition.variant} ${playing ? handoff ? "is-entering" : "is-covered" : ""}`}>
      <div className="s3-game-audio"><AudioControl /></div>
      {hint && <aside className="s3-entry-hint" role="status">{location ? <><strong>{t("s3.open.started")}</strong><p>{t("s3.open.location", { year: t(`s3.year.short.${location.year}`), room: t(`s3.room.${location.roomId}`) })}</p><p>{t(definition.hint)}</p></> : <p>{t(definition.hint)}</p>}</aside>}
      {children}
    </div>
    {playing && <ScenarioOpening definition={definition} names={g.turnOrder.map((id) => g.players[id].nickname)} onComplete={finish} onHandoff={beginHandoff} />}
  </>;
}
