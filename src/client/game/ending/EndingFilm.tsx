// Plays one ending cinematic on the openings' clock and film frame: scenes,
// captions, foley and score, then the ending card, then a fade to black. Skip
// (shown after 2 s, or Escape) fades the scene and the score out together.
// Nothing here talks to the server; `onDone` hands back to the run's screens.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioControl } from "../../audio/AudioControl.tsx";
import { audio } from "../../audio/manager.ts";
import { useT } from "../../i18n/index.ts";
import { durationOf, frameAt, runTimeline } from "../opening/timeline.ts";
import { ENDING_FILMS, reducedScenes, type EndingFacts, type EndingId } from "./cinematics.ts";
import { EndingScenes } from "./EndingScenes.tsx";
import "../../styles/opening03.css";
import "../../styles/openings.css";
import "../../styles/endings.css";

/** How long the score takes to fall away after the card, and after a skip. */
const OUTRO_S = 2.4;
const SKIP_S = 1;

/** `reduced`: force the still version (the developer preview); otherwise the system setting decides. */
export function EndingFilm({ id, facts, onDone, reduced }: { id: EndingId; facts: EndingFacts; onDone: () => void; reduced?: boolean }) {
  const t = useT();
  const system = useReducedMotion() ?? false;
  const reduce = reduced ?? system;
  const film = ENDING_FILMS[id];
  const scenes = useMemo(() => (reduce ? reducedScenes(film.scenes) : film.scenes), [film, reduce]);
  const [seconds, setSeconds] = useState(0);
  const [leaving, setLeaving] = useState<"skip" | "end" | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const played = useRef(new Set<string>());
  const dialog = useRef<HTMLDivElement>(null);
  const frame = frameAt(scenes, seconds);
  const current = scenes[frame.index];

  const leave = useCallback((how: "skip" | "end") => {
    stop.current?.();
    setLeaving((was) => was ?? how);
  }, []);
  useEffect(() => {
    stop.current = runTimeline(durationOf(scenes), setSeconds, () => leave("end"));
    return () => stop.current?.();
  }, [scenes, leave]);
  useEffect(() => {
    dialog.current?.focus({ preventScroll: true });
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // an effect still ringing when the film closes stops with it
    return () => { document.body.style.overflow = before; audio.hush(); };
  }, []);
  // the score follows the scene; foley fires once at its moment
  useEffect(() => {
    if (leaving || !current) return;
    audio.setTheme(current.theme);
    audio.tension(current.level, current.fade);
    for (const [when, cue] of current.sounds ?? []) {
      const key = `${current.id}:${when}`;
      if (frame.elapsed >= when && !played.current.has(key)) { played.current.add(key); audio.play(cue); }
    }
  }, [current, frame.elapsed, leaving]);
  // leaving: the score falls away, the frame fades to black, then the run's screens return
  useEffect(() => {
    if (!leaving) return;
    audio.hush();
    audio.tension(0, leaving === "skip" ? SKIP_S : OUTRO_S);
    const timer = setTimeout(onDone, (leaving === "skip" ? SKIP_S : reduce ? 1 : OUTRO_S) * 1000);
    return () => clearTimeout(timer);
  }, [leaving, onDone, reduce]);

  const onCard = current?.id === "card" || frame.done;
  return <div ref={dialog} tabIndex={-1} className={`s3-film opening-${film.variant} end-film end-${id} ${leaving ? "is-ending" : ""} ${reduce ? "is-still" : ""}`} role="dialog" aria-modal="true" aria-label={t(film.label)} data-ending={id} data-scene={onCard ? "card" : frame.id}
    onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); leave("skip"); } }}>
    <div className="s3-film-controls"><AudioControl /><button className={`btn btn-ghost s3-film-skip ${seconds >= 2 ? "is-visible" : ""}`} disabled={!!leaving} onClick={() => leave("skip")}>{t("end.skip")}</button></div>
    <div className="s3-film-letterbox" aria-hidden="true" />
    <div className="s3-film-stage">
      <AnimatePresence mode="wait">
        <motion.div key={onCard ? "card" : frame.id} className="s3-film-scene end-scene" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? .5 : .7 }}>
          {onCard ? <section className="end-card" aria-live="polite">
            <p className="end-card-kicker">{t(film.card.kicker)}</p>
            <h1>{t(film.card.title)}</h1>
            {film.card.lines.map((line, i) => <p key={line} className="end-card-line" style={{ animationDelay: `${.6 + i * .7}s` }}>{t(line)}</p>)}
            {film.card.tag && <p className="end-card-tag">{t(film.card.tag)}</p>}
          </section> : <EndingScenes id={id} scene={frame.id} elapsed={frame.elapsed} facts={facts} />}
        </motion.div>
      </AnimatePresence>
    </div>
    <div className="s3-film-captions" role="status" aria-live="polite" aria-atomic="true">
      <p key={frame.caption ?? ""}>{frame.caption && !onCard ? t(frame.caption) : ""}</p>
    </div>
    <div className="s3-film-progress" aria-hidden="true">{scenes.map((s, i) => <i key={s.id} className={i <= frame.index ? "is-current" : ""} />)}</div>
  </div>;
}
