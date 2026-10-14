// Plays a scenario's first-view guide: the page dims a little, one region is
// outlined, and a small bubble beside it says what it is for. Notes advance on
// their own (GUIDE_STEP_MS), or with Next; Skip or Escape ends it. A note whose
// region isn't on screen is passed over. Nothing here blocks the game itself.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ScenarioId } from "../../../shared/game/state.ts";
import { useT } from "../../i18n/index.ts";
import { GUIDE_STEP_MS, GUIDES, guideTarget } from "./steps.ts";
import "./bubble-guide.css";

type Box = { top: number; left: number; width: number; height: number };
const PAD = 6;
const BUBBLE_W = 300;

/** Where the bubble sits: below the region if it fits, else above, clamped to the screen. */
export function placeBubble(box: Box, view: { width: number; height: number }, bubble: { width: number; height: number }) {
  const width = Math.min(bubble.width, view.width - 24);
  const left = Math.max(12, Math.min(view.width - width - 12, box.left + box.width / 2 - width / 2));
  const below = box.top + box.height + 12;
  const above = box.top - bubble.height - 12;
  const side = below + bubble.height <= view.height - 12 || above < 12 ? "below" : "above";
  const top = side === "below" ? Math.min(below, view.height - bubble.height - 12) : above;
  return { left, top: Math.max(12, top), width, side } as const;
}

export function BubbleGuide({ scenario, onDone }: { scenario: ScenarioId; onDone: () => void }) {
  const t = useT();
  const reduce = useReducedMotion();
  const steps = GUIDES[scenario];
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [bubbleH, setBubbleH] = useState(120);
  const bubble = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ width: window.innerWidth, height: window.innerHeight });
  const step = steps[index];

  const next = useCallback(() => setIndex((i) => i + 1), []);
  const finished = useRef(false);
  const finish = useCallback(() => { if (!finished.current) { finished.current = true; onDone(); } }, [onDone]);
  useEffect(() => { if (index >= steps.length) finish(); }, [index, steps.length, finish]);

  // find this note's region; pass over one that isn't on screen
  useLayoutEffect(() => {
    if (!step) return;
    const el = guideTarget(step.target);
    setBox(null);
    if (!el) { const skip = setTimeout(next, 0); return () => clearTimeout(skip); }
    const r0 = el.getBoundingClientRect();
    if (r0.top < 0 || r0.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
      setView({ width: window.innerWidth, height: window.innerHeight });
    };
    measure();
    const settle = setTimeout(measure, reduce ? 0 : 360);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { clearTimeout(settle); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [step, next, reduce]);
  useLayoutEffect(() => { if (bubble.current) setBubbleH(bubble.current.offsetHeight); }, [index, box]);
  // each note moves on by itself
  useEffect(() => {
    if (!box) return;
    const timer = setTimeout(next, GUIDE_STEP_MS);
    return () => clearTimeout(timer);
  }, [box, index, next]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); finish(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  if (!step) return null;
  const place = box ? placeBubble(box, view, { width: BUBBLE_W, height: bubbleH }) : null;
  return <div className={`bubble-guide bubble-${scenario}`} data-guide-step={step.id}>
    {box && <div className="bubble-guide-ring" style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }} aria-hidden="true" />}
    <AnimatePresence mode="wait">
      {place && <motion.div key={step.id} ref={bubble} role="dialog" aria-modal="false" aria-labelledby="bubble-guide-title" aria-describedby="bubble-guide-body"
        className={`bubble-guide-bubble is-${place.side}`} style={{ top: place.top, left: place.left, width: place.width }}
        initial={{ opacity: 0, y: reduce ? 0 : place.side === "below" ? -6 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .25 }}>
        <p className="bubble-guide-count">{t("guide.count", { n: index + 1, total: steps.length })}</p>
        <h2 id="bubble-guide-title">{t(step.title)}</h2>
        <p id="bubble-guide-body" aria-live="polite">{t(step.body)}</p>
        <div className="bubble-guide-actions">
          <button type="button" className="bubble-guide-btn" onClick={finish}>{t("guide.skip")}</button>
          <button type="button" className="bubble-guide-btn is-next" onClick={next}>{t(index === steps.length - 1 ? "guide.done" : "guide.next")}</button>
        </div>
        <span className="bubble-guide-progress" style={{ animationDuration: `${GUIDE_STEP_MS}ms` }} aria-hidden="true" />
      </motion.div>}
    </AnimatePresence>
  </div>;
}
