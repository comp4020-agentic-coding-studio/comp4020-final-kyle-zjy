// Cinematics everyone sees at once. The server holds the table until every
// connected passenger has pressed Continue (or the host skips): no clock.
import { motion } from "motion/react";
import type { PlayerView } from "../../shared/game/state.ts";
import { useT } from "../i18n/index.ts";
import { sendGame } from "../store.ts";
import { notYet } from "./waiting.ts";

// Each scene's copy lives under scene.<KIND>.{kicker,title,line1..3} in the catalogs.
const SCENES = {
  BLACKOUT: { tint: "#000000" },
  FOLD: { tint: "#1a0f3a" },
  CAB_OPEN: { tint: "#2a1a05" },
} as const;

export function SequenceOverlay({ g }: { g: PlayerView }) {
  const t = useT();
  const seq = g.sequence;
  if (!seq || !(seq.kind in SCENES)) return null;
  const kind = seq.kind as keyof typeof SCENES;
  const scene = { ...SCENES[kind], kicker: t(`scene.${kind}.kicker`), title: t(`scene.${kind}.title`) };
  const base = [t(`scene.${kind}.line1`), t(`scene.${kind}.line2`), t(`scene.${kind}.line3`)];
  const acked = seq.acks.includes(g.viewerId);
  const bonus = g.config.act3BonusAp;
  const lines: readonly string[] =
    kind !== "CAB_OPEN"
      ? base
      : [
          ...base,
          g.config.inspectorStepsAct3 > 1 ? t("scene.CAB_OPEN.faster") : "",
          bonus ? t(bonus === 1 ? "scene.CAB_OPEN.smallTable.one" : "scene.CAB_OPEN.smallTable.other", { n: g.config.playerCount, ap: bonus }) : "",
        ].filter(Boolean);
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
          {acked ? t("common.waitingFor", { names: notYet(g, t) }) : t("common.continue")}
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
