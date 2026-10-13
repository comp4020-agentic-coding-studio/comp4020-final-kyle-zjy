import { useCallback, useEffect, useRef, useState } from "react";
import { AudioControl } from "../../../audio/AudioControl.tsx";
import { audio } from "../../../audio/manager.ts";
import { useT } from "../../../i18n/index.ts";
import { Scenario03Game } from "../../../screens/Scenario03Screens.tsx";
import { sendGame, useGame, useStore } from "../../../store.ts";
import { openingKey, rememberOpening, shouldOpen } from "./memory.ts";
import { Opening03 } from "./Opening03.tsx";

/** Stable across INTRO → ACT_1 and every authoritative snapshot. */
export function Experience03() {
  const g = useGame()!;
  const status = useStore((s) => s.status);
  const t = useT();
  const [playing, setPlaying] = useState(() => shouldOpen(g));
  const [handoff, setHandoff] = useState(false);
  const [hint, setHint] = useState(false);
  const acknowledging = useRef(false);
  const game = useRef<HTMLDivElement>(null);
  const key = openingKey(g);
  const year = g.temporal?.locations[g.viewerId]?.year;
  const finish = useCallback(() => { setPlaying(false); setHandoff(false); setHint(true); }, []);
  const beginHandoff = useCallback(() => setHandoff(true), []);

  useEffect(() => audio.acquire(), []);
  useEffect(() => { if (playing) rememberOpening(key); }, [key, playing]);
  useEffect(() => {
    if (!playing || handoff) audio.tension(.65);
    audio.setTheme(playing && !handoff ? "scenario03_intro" : year === "Y1996" ? "scenario03_1996_ambient" : "scenario03_2026_ambient");
  }, [playing, handoff, year]);
  useEffect(() => {
    // The existing readiness barrier is acknowledged immediately, independently
    // of playback/Skip. Cinematic duration never becomes a server deadline.
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
    <div ref={game} tabIndex={-1} inert={playing} aria-hidden={playing || undefined} className={`s3-game-entry ${playing ? handoff ? "is-entering" : "is-covered" : ""}`}>
      <div className="s3-game-audio"><AudioControl /></div>
      {hint && location && <aside className="s3-entry-hint" role="status"><strong>{t("s3.open.started")}</strong><p>{t("s3.open.location", { year: t(`s3.year.short.${location.year}`), room: t(`s3.room.${location.roomId}`) })}</p><p>{t("s3.open.hint")}</p></aside>}
      <Scenario03Game />
    </div>
    {playing && <Opening03 onComplete={finish} onHandoff={beginHandoff} />}
  </>;
}
