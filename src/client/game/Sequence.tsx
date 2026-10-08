// Cinematics everyone sees at once. The server holds the table until every
// connected passenger has pressed Continue (or the host skips): no clock.
import { motion } from "motion/react";
import type { CarriageIdentity, PlayerView } from "../../shared/game/state.ts";
import { useT, type MessageKey } from "../i18n/index.ts";
import { sendGame } from "../store.ts";
import { notYet } from "./waiting.ts";

// Each scene's copy lives under scene.<KIND>.{kicker,title,line1..3} in the catalogs.
const SCENES = {
  BLACKOUT: { tint: "#000000" },
  FOLD: { tint: "#1a0f3a" },
  CAB_OPEN: { tint: "#2a1a05" },
  // scenario 02
  FLOOD: { tint: "#04203a" },
  CAPACITY: { tint: "#0d2a33" },
} as const;

export function SequenceOverlay({ g }: { g: PlayerView }) {
  const t = useT();
  const seq = g.sequence;
  if (!seq || !(seq.kind in SCENES)) return null;
  const kind = seq.kind as keyof typeof SCENES;
  // scenario 02's scenes: one per flooded act, and the boat's seats
  const s2 = kind === "FLOOD" ? (`s2.scene.FLOOD${seq.stage ?? 2}` as const) : kind === "CAPACITY" ? "s2.scene.CAPACITY" : null;
  const words = { n: g.city?.boat.capacity ?? "?", total: g.turnOrder.length };
  const key = (part: string) => (s2 ? (`${s2}.${part}` as MessageKey) : (`scene.${kind}.${part}` as MessageKey));
  const scene = { ...SCENES[kind], kicker: t(key("kicker"), words), title: t(key("title"), words) };
  const base = [t(key("line1"), words), t(key("line2"), words), t(key("line3"), words)];
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
      {seq.kind === "FOLD" && !seq.fold && <FoldLines />}
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
        {seq.kind === "FOLD" && seq.fold && <FoldMap g={g} before={seq.fold.before} after={seq.fold.after} />}
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

/**
 * The fold, carriage by carriage: each node shows what it was, then turns over
 * to what it is now. "You" marks the node the viewer is standing on.
 */
function FoldMap({ g, before, after }: { g: PlayerView; before: CarriageIdentity[]; after: CarriageIdentity[] }) {
  const t = useT();
  const mine = g.players[g.viewerId]?.carriageIndex;
  return (
    <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label={t("scene.FOLD.mapAria")}>
      {after.map((now, i) => {
        const moved = now !== before[i];
        const name = (id: CarriageIdentity) => t(`dock.carriage.${id}`);
        return (
          <li key={i} className="min-w-0 [perspective:400px]" aria-label={moved ? t("scene.FOLD.nodeMoved", { from: name(before[i]), to: name(now) }) : name(now)}>
            <motion.div
              className={`flex min-h-12 flex-col items-center justify-center rounded-lg border px-1 py-1 text-center ${moved ? "border-violet-soft/70 bg-violet/15" : "border-ash/40 bg-white/5"} ${i === mine ? "ring-2 ring-gold" : ""}`}
              initial={moved ? { rotateY: 0 } : false}
              animate={moved ? { rotateY: [0, 90, 0] } : undefined}
              transition={{ delay: 1 + i * 0.18, duration: 0.7, times: [0, 0.5, 1] }}
            >
              {moved && (
                <motion.span className="block truncate text-[9px] text-ash line-through" initial={{ opacity: 1 }} animate={{ opacity: 0.55 }} transition={{ delay: 1.35 + i * 0.18 }}>
                  {name(before[i])}
                </motion.span>
              )}
              <motion.span className={`block w-full truncate text-[11px] font-semibold ${moved ? "text-violet-soft" : "text-mist"}`} initial={moved ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: 1.35 + i * 0.18 }}>
                {name(now)}
              </motion.span>
              {i === mine && <span className="block text-[9px] font-bold tracking-wider text-gold">{t("scene.FOLD.you")}</span>}
            </motion.div>
          </li>
        );
      })}
    </ol>
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
