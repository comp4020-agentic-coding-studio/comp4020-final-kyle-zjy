// ENDING phase: the closing scene everyone sees at once. The results follow
// when every passenger has pressed Continue or the scene's time runs out.
import { motion } from "motion/react";
import { endingText } from "../../shared/game/scenario01/content.ts";
import { useCountdown } from "../game/useCountdown.ts";
import { sendGame, useGame } from "../store.ts";

export function Ending() {
  const g = useGame();
  const left = useCountdown(g?.sequence?.until);
  if (!g?.outcome) return null;
  const text = endingText(g.outcome, g.failReason);
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  const tint = text.won ? (g.outcome === "NORMAL" ? "#1b2a4a" : "#2a1f05") : "#2a0707";
  return (
    <main
      className="flex min-h-dvh items-center justify-center px-6 py-10"
      style={{ background: `radial-gradient(circle at 50% 35%, ${tint}, #000000 72%)` }}
      role="dialog"
      aria-label={text.title}
    >
      <div className="w-full max-w-md text-center">
        <motion.p className={`label ${text.won ? "text-gold-bright" : "text-ember"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {text.kicker}
        </motion.p>
        <motion.h1
          className="mt-4 font-display text-4xl leading-tight font-semibold text-moon sm:text-5xl"
          initial={{ opacity: 0, filter: "blur(10px)", letterSpacing: "0.2em" }}
          animate={{ opacity: 1, filter: "blur(0px)", letterSpacing: "0em" }}
          transition={{ delay: 0.7, duration: 1.4 }}
        >
          {text.title}
        </motion.h1>
        {text.lines.map((l, i) => (
          <motion.p key={i} className="mt-2 text-mist" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 + i * 0.7 }}>
            {l}
          </motion.p>
        ))}
        <motion.button
          className="btn btn-gold mt-10 w-full"
          disabled={acked}
          onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 + text.lines.length * 0.7 }}
        >
          {acked ? `Waiting for the others… ${left ?? ""}s` : "See the results"}
        </motion.button>
      </div>
    </main>
  );
}
