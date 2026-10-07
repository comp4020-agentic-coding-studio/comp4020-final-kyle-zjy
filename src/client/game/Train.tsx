// The map: the train, side-on, rear on the left. Passengers sit in their
// carriage (portraits animate between carriages when they move), with the
// Inspector, shadows and echoes drawn where they stand. Scrolls inside its own
// container so the page never scrolls sideways.
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { CARRIAGES, ESCAPE_LOCKS, KEY_FOR_LOCK, LOCK_AT } from "../../shared/game/scenario01/content.ts";
import type { AnchorId, Carriage, CarriageIdentity, EscapeLockId, PlayerView } from "../../shared/game/state.ts";
import { useScenarioText, useT } from "../i18n/index.ts";
import { Icon } from "./Icon.tsx";

const ANCHOR_AT: Partial<Record<CarriageIdentity, AnchorId>> = { ENGINE_ROOM: "POWER", ARCHIVE: "IDENTITY", SLEEPER: "MEMORY", MIRROR: "MEMORY" };
const LOCK_HERE: Partial<Record<CarriageIdentity, EscapeLockId>> = Object.fromEntries(ESCAPE_LOCKS.map((l) => [LOCK_AT[l], l]));

type Props = {
  g: PlayerView;
  moveTargets?: number[];
  onPick?: (index: number) => void;
};

export function Train({ g, moveTargets = [], onPick }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const t = useT();
  const me = g.players[g.viewerId];
  const focus = moveTargets.length ? moveTargets[0] : (me?.carriageIndex ?? 0);

  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-carriage="${focus}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focus]);

  return (
    <section aria-label={t("train.aria")} className="relative">
      <div ref={scroller} className="no-scrollbar overflow-x-auto overscroll-x-contain px-3 pt-2 pb-3 sm:px-4">
        <LayoutGroup>
          <ol className="mx-auto flex w-max items-stretch gap-0">
            {g.carriages.map((c, i) => (
              <li key={c.index} className="flex items-stretch [perspective:600px]">
                {i > 0 && <Coupler />}
                <FoldingCard g={g} c={c} target={moveTargets.includes(c.index)} onPick={onPick} />
              </li>
            ))}
          </ol>
        </LayoutGroup>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-void to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-void to-transparent" />
    </section>
  );
}

const Coupler = () => (
  <div className="flex w-3 items-center sm:w-4" aria-hidden="true">
    <div className="h-2 w-full rounded-sm bg-[#2a3158]" />
  </div>
);

/**
 * Holds the carriage it showed until the fold scene is dismissed, then turns
 * over to the new one, so the change happens where players can see it.
 */
function FoldingCard({ g, c, target, onPick }: { g: PlayerView; c: Carriage; target: boolean; onPick?: (i: number) => void }) {
  const folding = g.sequence?.kind === "FOLD";
  const [shown, setShown] = useState(c.identity);
  const [turns, setTurns] = useState(0);
  useEffect(() => {
    if (folding || shown === c.identity) return;
    setShown(c.identity);
    setTurns((n) => n + 1);
  }, [folding, c.identity, shown]);
  return (
    <motion.div
      key={turns}
      className="flex"
      initial={turns ? { rotateY: -180, opacity: 0.4 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ delay: 0.15 + c.index * 0.12, duration: 0.8, ease: "easeOut" }}
    >
      <CarriageCard g={g} c={{ ...c, identity: shown }} target={target} onPick={onPick} />
    </motion.div>
  );
}

function CarriageCard({ g, c, target, onPick }: { g: PlayerView; c: Carriage; target: boolean; onPick?: (i: number) => void }) {
  const t = useT();
  const words = useScenarioText().carriages[c.identity];
  const info = { ...CARRIAGES[c.identity], name: words.name, theme: words.theme };
  const here = g.turnOrder.map((id) => g.players[id]).filter((p) => p.carriageIndex === c.index);
  const activeId = g.step === "PLAYER_TURNS" ? g.turnOrder[g.activeIndex] : null;
  const mine = g.players[g.viewerId]?.carriageIndex === c.index;
  const inspectorHere = g.inspector.active && g.inspector.banishedUntilRound === null && g.inspector.carriageIndex === c.index;
  const entities = g.entities.filter((e) => e.carriageIndex === c.index);
  const anchor = g.act >= 2 ? ANCHOR_AT[c.identity] : undefined;
  const lock = g.act === 3 ? LOCK_HERE[c.identity] : undefined;
  const lockOn = lock && g.escape.round === g.round && g.escape[lock];
  const Tag = target ? motion.button : motion.div;

  return (
    <Tag
      data-carriage={c.index}
      layout
      onClick={target ? () => onPick?.(c.index) : undefined}
      aria-label={t("train.carriageAria", {
        name: info.name,
        locked: c.locked ? t("train.lockedAria") : "",
        mine: mine ? t("train.youHere") : "",
        count: here.length === 1 ? t("train.passengers.one") : t("train.passengers.other", { n: here.length }),
        move: target ? t("train.moveHere") : "",
      })}
      className={`relative flex h-[168px] w-[132px] flex-col overflow-hidden rounded-[14px] border text-left sm:h-[184px] sm:w-[156px] ${
        target ? "cursor-pointer border-signal shadow-[var(--glow-signal)]" : mine ? "border-gold/70" : "border-[#262d55]"
      }`}
      style={{ background: `linear-gradient(180deg, ${info.accent}1f 0%, #0c1129 38%, #090d20 100%)` }}
      animate={target ? { y: [0, -3, 0] } : { y: 0 }}
      transition={target ? { duration: 1.4, repeat: Infinity } : { duration: 0.3 }}
    >
      {/* roof light strip */}
      <div className="h-1 w-full" style={{ background: info.accent, opacity: c.locked ? 0.25 : 0.8 }} />
      <div className="px-2.5 pt-1.5">
        <AnimatePresence mode="wait">
          <motion.p key={c.identity} className="font-display text-[15px] leading-tight font-semibold text-moon sm:text-base" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {info.name}
          </motion.p>
        </AnimatePresence>
        <p className="truncate text-[10px] tracking-wide text-ash uppercase">{info.theme}</p>
      </div>
      {/* windows */}
      <div className="mt-1.5 flex gap-1 px-2.5" aria-hidden="true">
        {[0, 1, 2].map((w) => (
          <span key={w} className="h-4 flex-1 rounded-sm border border-[#2a3158] bg-[#0f1735]" style={{ boxShadow: c.locked ? undefined : `inset 0 0 8px ${info.accent}33` }} />
        ))}
      </div>

      {/* anchor / escape lock: in flow under the windows, so they never cover the name */}
      {(anchor || lock) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-2.5">
          {anchor && <AnchorBadge g={g} id={anchor} />}
          {lock && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${lockOn ? "bg-gold text-[#1a1206]" : "border border-gold/50 text-gold"}`}>
              {t(lockOn ? "train.lockOn" : "train.lockOff", { lock: t(`train.lock.${lock}`) })}
            </span>
          )}
          {lock && <KeyHolder g={g} lock={lock} />}
        </div>
      )}

      {/* occupants */}
      <div className="relative flex flex-1 flex-wrap content-end items-end gap-1 px-2 pb-2">
        {here.map((p) => {
          const ch = getCharacterById(p.characterId);
          return (
            <motion.span
              key={p.playerId}
              layoutId={`p-${p.playerId}`}
              transition={{ type: "spring", damping: 22, stiffness: 200 }}
              className={`relative block h-8 w-8 rounded-full sm:h-9 sm:w-9 ${p.playerId === activeId ? "ring-2 ring-signal" : p.playerId === g.viewerId ? "ring-2 ring-gold" : "ring-1 ring-white/20"}`}
              title={`${p.nickname}${p.lost ? t("train.lost") : ""}${p.away ? t("train.away") : ""}`}
            >
              <img src={ch.avatar} alt={p.nickname} className={`h-full w-full rounded-full ${p.lost || p.away ? "opacity-50 grayscale" : ""}`} draggable={false} />
              {p.playerId === activeId && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-pulse rounded-full bg-signal" />}
            </motion.span>
          );
        })}
        <AnimatePresence>
          {inspectorHere && (
            <motion.span key="inspector" layoutId="inspector" className="ml-auto block" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} title={t("train.inspector")}>
              <InspectorFigure distortion={g.inspector.distortion} />
            </motion.span>
          )}
          {entities.map((e) => (
            <motion.span key={e.id} layoutId={e.id} className="block" initial={{ opacity: 0 }} animate={{ opacity: [0.5, 0.9, 0.5] }} exit={{ opacity: 0, scale: 1.4 }} transition={{ duration: 2.4, repeat: Infinity }} title={t(e.kind === "SHADOW" ? "train.shadow" : "train.echo", { hp: e.hp })}>
              <Ghost kind={e.kind} />
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {c.locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#05060d]/70 text-ash">
          <Icon name="LOCK" size={26} />
          <span className="text-[10px] font-bold tracking-widest">{t("train.lockedBadge")}</span>
        </div>
      )}
    </Tag>
  );
}

/** Who carries this lock's key: only they can work it. */
function KeyHolder({ g, lock }: { g: PlayerView; lock: EscapeLockId }) {
  const t = useT();
  const holder = g.turnOrder.map((id) => g.players[id]).find((p) => p.items.includes(KEY_FOR_LOCK[lock]));
  return (
    <span className={`flex items-center gap-0.5 truncate font-mono text-[9px] ${holder ? "text-gold-bright" : "text-ash"}`}>
      <Icon name="KEY" size={10} />
      {holder ? t("train.keyWith", { name: holder.nickname }) : t("train.keyMissing")}
    </span>
  );
}

function AnchorBadge({ g, id }: { g: PlayerView; id: AnchorId }) {
  const a = g.anchors[id];
  const pct = a.progress / a.required;
  const t = useT();
  const name = useScenarioText().anchors[id];
  const short = t(`train.anchor.${id}`);
  return (
    <span className="flex items-center gap-1" title={t("game.anchorTitle", { name, progress: a.progress, required: a.required })}>
      <svg width="16" height="16" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="9" fill="none" stroke="#1d2657" strokeWidth="2.5" />
        <circle cx="11" cy="11" r="9" fill="none" stroke={a.repaired ? "#e8c97f" : "#c9a55a"} strokeWidth="2.5" strokeDasharray={`${pct * 56.5} 56.5`} transform="rotate(-90 11 11)" />
        <rect x="8" y="8" width="6" height="6" transform="rotate(45 11 11)" fill={a.repaired ? "#e8c97f" : "none"} stroke="#e8c97f" />
      </svg>
      <span className="font-mono text-[10px] text-gold">
        {a.repaired ? t("train.anchorOk", { anchor: short }) : t("train.anchorProgress", { anchor: short, progress: a.progress, required: a.required })}
      </span>
    </span>
  );
}

function InspectorFigure({ distortion }: { distortion: number }) {
  const t = useT();
  return (
    <svg width="30" height="40" viewBox="0 0 30 40" aria-label={t("train.inspectorAria", { n: distortion })}>
      <path d="M6 14h18l-2 26H8z" fill="#07080f" stroke="#c9a55a" strokeWidth=".8" />
      <path d="M5 13h20l-3-5H8z" fill="#0b0d18" stroke="#c9a55a" strokeWidth=".8" />
      <ellipse cx="15" cy="19" rx="5" ry="6" fill="#d9d9e3" />
      <rect x="12" y="27" width="6" height="2" fill="#c9a55a" />
      {Array.from({ length: distortion }, (_, i) => (
        <path key={i} d={`M${10 + i * 4} 15l2 8`} stroke="#e2563f" strokeWidth="1.2" />
      ))}
    </svg>
  );
}

function Ghost({ kind }: { kind: "SHADOW" | "ECHO" }) {
  const color = kind === "SHADOW" ? "#9c86ff" : "#5ce1e6";
  return (
    <svg width="24" height="32" viewBox="0 0 24 32" aria-hidden="true">
      <path d="M12 2a7 7 0 0 1 7 7v19l-3.5-3-3.5 3-3.5-3L5 28V9a7 7 0 0 1 7-7z" fill={`${color}33`} stroke={color} strokeWidth="1" />
      <circle cx="9.5" cy="10" r="1.3" fill={color} />
      <circle cx="14.5" cy="10" r="1.3" fill={color} />
    </svg>
  );
}
