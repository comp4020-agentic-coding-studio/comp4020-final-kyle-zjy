// The roll, shown to everyone: the die tumbles and lands on the server's raw
// value, then the chain raw → modifiers → Fate → final appears, ending in the
// tier word. The roller makes their Fate decision right here.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { RollTier } from "../../shared/characters/types.ts";
import type { PlayerView, PublicWindow } from "../../shared/game/state.ts";
import { sendGame } from "../store.ts";
import { useCountdown } from "./useCountdown.ts";

export const TIER: Record<RollTier, { word: string; color: string }> = {
  DISASTER: { word: "Disaster", color: "#e2563f" },
  FAIL: { word: "Failure", color: "#a3a9c7" },
  SUCCESS: { word: "Success", color: "#5bc489" },
  PERFECT: { word: "Perfect", color: "#e8c97f" },
};

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export function Die({ value, size = 84, color = "#f4ecd6" }: { value: number; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Die showing ${value}`}>
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#141a3a" stroke={color} strokeWidth="3" />
      <rect x="10" y="10" width="80" height="80" rx="14" fill="none" stroke={color} strokeOpacity=".25" />
      {(PIPS[value] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="8" fill={color} />
      ))}
    </svg>
  );
}

const HOLD_MS = 2600;

export function DiceOverlay({ g }: { g: PlayerView }) {
  const roll = g.roll;
  const reduce = useReducedMotion();
  const [tumbling, setTumbling] = useState(false);
  const [face, setFace] = useState(1);
  const rollId = roll?.id;
  const raw = roll?.raw ?? 1;

  // a new roll: tumble for a moment, then land on the server's value
  useEffect(() => {
    if (!rollId || reduce) return;
    setTumbling(true);
    let n = 0;
    const t = setInterval(() => {
      setFace(1 + ((n++ * 5 + raw) % 6)); // decorative only: the result is the server's
      if (n > 7) {
        clearInterval(t);
        setTumbling(false);
      }
    }, 90);
    return () => {
      clearInterval(t);
      setTumbling(false);
    };
  }, [rollId, raw, reduce]);

  // a finished roll lingers, then the overlay clears
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  useEffect(() => {
    if (!roll?.done) return;
    const t = setTimeout(() => setHiddenId(roll.id), HOLD_MS);
    return () => clearTimeout(t);
  }, [roll?.done, roll?.id]);

  const fateWindow = g.pending.find((w) => w.kind === "FATE_SPEND");
  const visible = !!roll && roll.id !== hiddenId && (roll.purpose !== "EVENT");
  const roller = roll ? g.players[roll.playerId] : null;
  const tier = roll ? TIER[roll.tier] : null;

  return (
    <AnimatePresence>
      {visible && roll && roller && tier && (
        <motion.div
          key={roll.id}
          className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center bg-black/45 px-4 pt-[22vh]"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          <div className="tarot pointer-events-auto w-full max-w-sm p-4 text-center" role="dialog" aria-label={`${roller.nickname}'s ${roll.label}`} aria-live="polite">
            <p className="label">
              {roll.playerId === g.viewerId ? "Your" : `${roller.nickname}'s`} {roll.label}
            </p>
            <div className="mt-3 flex items-center justify-center gap-4">
              <motion.div animate={tumbling ? { rotate: [0, 90, 200, 320, 360], scale: [1, 0.9, 1.05, 0.95, 1] } : { rotate: 0 }} transition={{ duration: 0.7 }}>
                <Die value={tumbling ? face : roll.raw} />
              </motion.div>
              {!tumbling && (
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-left">
                  <p className="font-mono text-sm text-mist">raw {roll.raw}</p>
                  {roll.modifiers.map((m, i) => (
                    <p key={i} className={`font-mono text-sm ${m.delta >= 0 ? "text-signal" : "text-ember"}`}>
                      {m.delta >= 0 ? "+" : ""}
                      {m.delta} {m.source}
                    </p>
                  ))}
                  {roll.fateSpent > 0 && <p className="font-mono text-sm text-gold-bright">+{roll.fateSpent} Fate</p>}
                  <p className="mt-1 font-mono text-3xl text-moon">= {roll.final}</p>
                </motion.div>
              )}
            </div>
            {!tumbling && (
              <motion.p initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 font-display text-3xl font-semibold" style={{ color: tier.color }}>
                {roll.done ? tier.word : `${tier.word}…`}
              </motion.p>
            )}
            {!tumbling && fateWindow && <FateChoice g={g} w={fateWindow} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FateChoice({ g, w }: { g: PlayerView; w: PublicWindow }) {
  const left = useCountdown(w.deadlineAt);
  const mine = w.addressees.includes(g.viewerId) && !w.myAnswer;
  if (!mine) return <p className="mt-2 text-sm text-mist">Deciding whether to spend Fate… {left}s</p>;
  return (
    <div className="mt-3">
      <p className="text-sm text-mist">{w.prompt}</p>
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${w.options.length}, minmax(0, 1fr))` }}>
        {w.options.map((o) => (
          <button key={o.id} className={`btn min-h-14 flex-col gap-0 rounded-xl px-2 text-sm ${o.id === "0" ? "btn-ghost" : "btn-gold"}`} onClick={() => void sendGame({ type: "RESPOND", windowId: w.id, optionId: o.id })}>
            <span>{o.label}</span>
            <span className="text-[11px] font-normal opacity-80">{o.detail}</span>
          </button>
        ))}
      </div>
      <p className="mt-1 font-mono text-xs text-ash">{left}s</p>
    </div>
  );
}
