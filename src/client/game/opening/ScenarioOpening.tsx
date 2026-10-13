import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AudioControl } from "../../audio/AudioControl.tsx";
import { audio } from "../../audio/manager.ts";
import { useT } from "../../i18n/index.ts";
import { OpeningScenes } from "../scenario03/opening/OpeningScenes.tsx";
import type { OpeningScene } from "../scenario03/opening/timeline.ts";
import { TrainOpening } from "./TrainOpening.tsx";
import { FloodOpening } from "./FloodOpening.tsx";
import { AuctionOpening } from "./AuctionOpening.tsx";
import { frameAt, durationOf, runTimeline, type OpeningDefinition } from "./timeline.ts";
import "../../styles/opening03.css";
import "../../styles/openings.css";

export function ScenarioOpening({ definition, names = [], onComplete, onHandoff }: { definition: OpeningDefinition; names?: readonly string[]; onComplete: () => void; onHandoff: () => void }) {
  const t = useT();
  const reduced = useReducedMotion();
  const [seconds, setSeconds] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const played = useRef(new Set<string>());
  const dialog = useRef<HTMLDivElement>(null);
  const frame = frameAt(definition.scenes, seconds);

  useEffect(() => {
    stop.current = runTimeline(durationOf(definition.scenes), setSeconds, onComplete);
    return () => stop.current?.();
  }, [definition, onComplete]);
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, []);
  useEffect(() => {
    if (frame.id === "handoff") { onHandoff(); return; }
    if (leaving) return;
    const mix = definition.mix(frame.id, frame.elapsed);
    audio.tension(mix.level);
    audio.setTheme(mix.theme ?? definition.introTheme);
    for (const [at, cue] of definition.scenes[frame.index]?.sounds ?? []) {
      const key = `${frame.id}:${at}`;
      if (!leaving && frame.elapsed >= at && !played.current.has(key)) {
        played.current.add(key);
        audio.play(cue);
      }
    }
  }, [definition, frame.id, frame.index, frame.elapsed, leaving, onHandoff]);

  const skip = useCallback(() => {
    if (leaving) return;
    stop.current?.();
    setLeaving(true);
    onHandoff();
  }, [leaving, onHandoff]);

  return <div ref={dialog} className={`s3-film opening-${definition.variant} ${leaving ? "is-leaving" : ""} ${frame.id === "handoff" ? "is-handoff" : ""}`} role="dialog" aria-modal="true" aria-label={t(definition.label)} data-scene={frame.id}
    onAnimationEnd={(event) => { if (leaving && event.target === event.currentTarget) onComplete(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); skip(); }
      if (event.key === "Tab") {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), summary, a[href]")].filter((element) => element.getClientRects().length > 0);
        const index = buttons.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    }}>
    <div className="s3-film-controls"><AudioControl /><button className={`btn btn-ghost s3-film-skip ${seconds >= 2 ? "is-visible" : ""}`} disabled={leaving} onClick={skip}>{t("opening.skip")}</button></div>
    <div className="s3-film-letterbox" aria-hidden="true" />
    <div className="s3-film-stage">
      <AnimatePresence mode="wait">
        <motion.div key={frame.id} className="s3-film-scene" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? .12 : .45 }}>
          {definition.variant === "temporal" ? <OpeningScenes id={frame.id as OpeningScene} elapsed={frame.elapsed} /> : definition.variant === "train" ? <TrainOpening id={frame.id} elapsed={frame.elapsed} /> : definition.variant === "flood" ? <FloodOpening id={frame.id} elapsed={frame.elapsed} /> : <AuctionOpening id={frame.id} elapsed={frame.elapsed} names={names} />}
        </motion.div>
      </AnimatePresence>
    </div>
    <div className="s3-film-captions" role="status" aria-live="polite" aria-atomic="true">
      <p key={frame.caption}>{frame.caption ? t(frame.caption) : ""}</p>
    </div>
    <div className="s3-film-progress" aria-hidden="true">{Array.from({ length: definition.scenes.length - 1 }, (_, i) => <i key={i} className={i <= frame.index ? "is-current" : ""} />)}</div>
  </div>;
}
