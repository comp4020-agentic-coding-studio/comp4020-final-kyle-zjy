import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AudioControl } from "../../../audio/AudioControl.tsx";
import { audio, type OpeningSfx } from "../../../audio/manager.ts";
import { useT } from "../../../i18n/index.ts";
import { OpeningScenes } from "./OpeningScenes.tsx";
import { openingFrame, runOpening, type OpeningScene } from "./timeline.ts";
import "../../../styles/opening03.css";

const SOUNDS: Partial<Record<OpeningScene, readonly (readonly [number, OpeningSfx])[]>> = {
  sync: [[2, "temporal_sync_error"]],
  lockdown: [[1.4, "security_lock"], [2.8, "security_lock"], [4.2, "security_lock"], [5.6, "security_lock"]],
  archive: [[0, "archive_scan"], [7, "low_impact"]],
  dual: [[0, "crt_noise"], [5, "crt_noise"]],
  jump: [[1, "timeline_rewind"]],
  causal: [[1.3, "timeline_shift"], [4.9, "timeline_shift"], [8.5, "timeline_shift"]],
  records: [[0, "record_corruption"], [4.5, "record_corruption"]],
  title: [[0, "title_reveal"]],
};

export function Opening03({ onComplete, onHandoff }: { onComplete: () => void; onHandoff: () => void }) {
  const t = useT();
  const reduced = useReducedMotion();
  const [seconds, setSeconds] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const played = useRef(new Set<string>());
  const dialog = useRef<HTMLDivElement>(null);
  const frame = openingFrame(seconds);

  useEffect(() => {
    stop.current = runOpening(setSeconds, onComplete);
    return () => stop.current?.();
  }, [onComplete]);
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, []);
  useEffect(() => {
    if (frame.id === "handoff") { onHandoff(); return; }
    if (leaving) return;
    audio.tension(frame.id === "records" ? (frame.elapsed >= 9.5 ? 0 : 1.3) : frame.id === "sync" ? .4 : .7);
    for (const [at, cue] of SOUNDS[frame.id] ?? []) {
      const key = `${frame.id}:${at}`;
      if (!leaving && frame.elapsed >= at && !played.current.has(key)) {
        played.current.add(key);
        audio.play(cue);
      }
    }
  }, [frame.id, frame.elapsed, leaving, onHandoff]);

  const skip = useCallback(() => {
    if (leaving) return;
    stop.current?.();
    setLeaving(true);
    onHandoff();
  }, [leaving, onHandoff]);

  return <div ref={dialog} className={`s3-film ${leaving ? "is-leaving" : ""} ${frame.id === "handoff" ? "is-handoff" : ""}`} role="dialog" aria-modal="true" aria-label={t("s3.open.aria")} data-scene={frame.id}
    onAnimationEnd={(event) => { if (leaving && event.target === event.currentTarget) onComplete(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); skip(); }
      if (event.key === "Tab") {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    }}>
    <div className="s3-film-controls"><AudioControl /><button className={`btn btn-ghost s3-film-skip ${seconds >= 2 ? "is-visible" : ""}`} disabled={leaving} onClick={skip}>{t("s3.open.skip")}</button></div>
    <div className="s3-film-letterbox" aria-hidden="true" />
    <div className="s3-film-stage">
      <AnimatePresence mode="wait">
        <motion.div key={frame.id} className="s3-film-scene" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? .12 : .45 }}>
          <OpeningScenes id={frame.id} elapsed={frame.elapsed} />
        </motion.div>
      </AnimatePresence>
    </div>
    <div className="s3-film-captions" role="status" aria-live="polite" aria-atomic="true">
      <p key={frame.caption}>{frame.caption ? t(frame.caption) : ""}</p>
    </div>
    <div className="s3-film-progress" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} className={i <= frame.index ? "is-current" : ""} />)}</div>
  </div>;
}
