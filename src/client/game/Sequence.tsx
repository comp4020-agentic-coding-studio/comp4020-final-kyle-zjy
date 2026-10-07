// Cinematics everyone sees at once. The server holds the table until every
// present passenger has pressed Continue or the scene's time runs out.
import { motion } from "motion/react";
import type { PlayerView } from "../../shared/game/state.ts";
import { sendGame } from "../store.ts";
import { useCountdown } from "./useCountdown.ts";

const SCENES = {
  BLACKOUT: {
    kicker: "End of Act I",
    title: "Identity registration complete.",
    lines: ["The lights die all at once.", "\"Anomaly detected.\"", "A conductor's whistle, somewhere up front."],
    tint: "#000000",
  },
  FOLD: {
    kicker: "Round 7 · Reality Fold",
    title: "The train turns inside out.",
    lines: ["You haven't moved.", "The carriage around you has.", "Check the map: every middle carriage is somewhere new."],
    tint: "#1a0f3a",
  },
  CAB_OPEN: {
    kicker: "Act III · Departure Protocol",
    title: "Driver's cab access restored.",
    lines: ["Engage the Power, Route and Drive locks.", "All three. In the same round.", "Echoes start walking the train."],
    tint: "#2a1a05",
  },
} as const;

export function SequenceOverlay({ g }: { g: PlayerView }) {
  const seq = g.sequence;
  const left = useCountdown(seq?.until);
  if (!seq || !(seq.kind in SCENES)) return null;
  const scene = SCENES[seq.kind as keyof typeof SCENES];
  const acked = seq.acks.includes(g.viewerId);
  const lines: readonly string[] =
    seq.kind !== "CAB_OPEN"
      ? scene.lines
      : [...scene.lines, g.config.inspectorStepsAct3 > 1 ? "The Inspector now walks twice as fast." : "", g.config.act3BonusAp ? `There are only ${g.config.playerCount} of you: +${g.config.act3BonusAp} action point each round.` : ""].filter(Boolean);
  return (
    <motion.div
      key={seq.kind}
      className="fixed inset-0 z-[55] flex items-center justify-center px-6"
      style={{ background: `radial-gradient(circle at 50% 40%, ${scene.tint}ee, #000000f5 70%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={scene.title}
    >
      {seq.kind === "FOLD" && <FoldLines />}
      <div className="relative max-w-md text-center">
        <motion.p className="label text-signal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {scene.kicker}
        </motion.p>
        <motion.h2
          className="mt-3 font-display text-4xl leading-tight font-semibold text-moon"
          initial={{ opacity: 0, filter: "blur(8px)", letterSpacing: "0.2em" }}
          animate={{ opacity: 1, filter: "blur(0px)", letterSpacing: "0em" }}
          transition={{ delay: 0.6, duration: 1.2 }}
        >
          {scene.title}
        </motion.h2>
        {lines.map((l, i) => (
          <motion.p key={i} className="mt-2 text-mist" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 + i * 0.6 }}>
            {l}
          </motion.p>
        ))}
        <motion.button
          className="btn btn-gold mt-8 w-full"
          disabled={acked}
          onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6 }}
        >
          {acked ? `Waiting for the others… ${left ?? ""}s` : "Continue"}
        </motion.button>
      </div>
    </motion.div>
  );
}

function FoldLines() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <motion.rect
          key={i}
          x={20 + i * 52}
          y="360"
          width="44"
          height="80"
          rx="8"
          fill="none"
          stroke="#9c86ff"
          strokeOpacity=".4"
          initial={{ x: 0 }}
          animate={{ x: [0, (i % 2 ? 1 : -1) * 120, ((i * 37) % 5 - 2) * 40], rotate: [0, i % 2 ? 8 : -8, 0] }}
          transition={{ duration: 2.4, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}
