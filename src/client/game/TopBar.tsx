// Layer one of the game screen: where we are (round, act), how much time is
// left (Collapse), and the run's progress (anchors, fragments, core memories).
// Every value is text as well as colour.
import { motion } from "motion/react";
import { FRAGMENTS, SCENARIO } from "../../shared/game/scenario01/content.ts";
import type { FragmentType, PlayerView } from "../../shared/game/state.ts";
import { Icon } from "./Icon.tsx";

const ACT_NAME = { 1: "Act I · Explore", 2: "Act II · The Inspector", 3: "Act III · Departure Protocol" } as const;

export function TopBar({ g, onLog, onSecrets, secretsCount }: { g: PlayerView; onLog: () => void; onSecrets: () => void; secretsCount: number }) {
  const danger = g.collapse >= 9;
  return (
    <header className="relative z-20 border-b border-gold/15 bg-[#05060d]/85 px-3 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur-md sm:px-4">
      <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-4">
        <div className="shrink-0">
          <p className="label text-[9px] leading-none sm:text-[10px]" title={ACT_NAME[g.act]}>
            {/* phones show "Act II"; the act's name joins it from sm up */}
            <span className="sm:hidden">{ACT_NAME[g.act].split(" · ")[0]}</span>
            <span className="hidden sm:inline">{ACT_NAME[g.act]}</span>
          </p>
          <p className="font-mono text-lg leading-tight text-moon sm:text-xl">
            R{Math.max(1, g.round)}
            <span className="text-ash">/{SCENARIO.rounds}</span>
          </p>
        </div>

        <div className="min-w-0 flex-1" role="meter" aria-label="Collapse" aria-valuenow={g.collapse} aria-valuemin={0} aria-valuemax={g.collapseMax}>
          <div className="flex items-baseline justify-between">
            <span className={`label text-[9px] sm:text-[10px] ${danger ? "text-ember" : ""}`}>Collapse</span>
            <span className={`font-mono text-sm whitespace-nowrap ${danger ? "text-ember" : "text-moon"}`}>
              {g.collapse} / {g.collapseMax}
            </span>
          </div>
          <div className="mt-1 flex gap-[2px]">
            {Array.from({ length: g.collapseMax }, (_, i) => (
              <motion.span
                key={i}
                className="h-2 flex-1 rounded-[1px]"
                initial={false}
                animate={{ backgroundColor: i < g.collapse ? (i >= 8 ? "#e2563f" : "#c9a55a") : "#1d2657", scaleY: i === g.collapse - 1 ? [1, 1.8, 1] : 1 }}
                transition={{ duration: 0.5 }}
              />
            ))}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <Anchors g={g} />
          <Fragments have={g.fragments} />
        </div>

        <button onClick={onSecrets} className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/30 text-mist hover:text-moon" aria-label={`Your secrets (${secretsCount})`}>
          <Icon name="SECRET" />
          {secretsCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet px-1 font-mono text-[10px] text-white">{secretsCount}</span>}
        </button>
        <button onClick={onLog} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/30 text-mist hover:text-moon" aria-label="Train log">
          <Icon name="LOG" />
        </button>
      </div>
      <div className="mx-auto mt-1.5 flex max-w-6xl items-center justify-between gap-3 sm:hidden">
        <Anchors g={g} />
        <Fragments have={g.fragments} />
      </div>
    </header>
  );
}

function Anchors({ g }: { g: PlayerView }) {
  const anchors = Object.values(g.anchors);
  const active = g.act >= 2;
  return (
    <div className="flex items-center gap-1.5" aria-label={active ? `Anchors repaired: ${anchors.filter((a) => a.repaired).length} of 3` : "Anchors appear in round 4"}>
      <Icon name="ANCHOR" size={14} className={active ? "text-gold" : "text-ash"} />
      {anchors.map((a) => (
        <span
          key={a.id}
          title={`${a.id.toLowerCase()} anchor ${a.progress}/${a.required}`}
          className={`h-3 w-3 rotate-45 border ${a.repaired ? "border-gold-bright bg-gold-bright shadow-[var(--glow-gold)]" : a.progress > 0 ? "border-gold bg-gold/40" : active ? "border-gold/60" : "border-ash/40"}`}
        />
      ))}
      <span className="font-mono text-[11px] text-mist">{active ? `${anchors.filter((a) => a.repaired).length}/3` : "—"}</span>
    </div>
  );
}

const ALL_FRAGMENTS = Object.keys(FRAGMENTS) as FragmentType[];

function Fragments({ have }: { have: FragmentType[] }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Memory fragments: ${have.length} (need 3)`}>
      {ALL_FRAGMENTS.map((f) => (
        <span key={f} title={FRAGMENTS[f].name} className={have.includes(f) ? "text-violet-soft" : "text-indigo"}>
          <Icon name="FRAGMENT" size={13} />
        </span>
      ))}
      <span className={`font-mono text-[11px] ${have.length >= 3 ? "text-violet-soft" : "text-mist"}`}>{have.length}/3</span>
    </div>
  );
}
