// What a roll or event just did, as short floating notes everyone sees:
// fragments, items, core memories, Collapse, lost passengers, shadows, and
// in act 2 the Inspector, seat neighbours and anchor repairs.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { FRAGMENTS, ITEMS } from "../../shared/game/scenario01/content.ts";
import type { FragmentType, ItemId, PlayerView } from "../../shared/game/state.ts";
import { useStore, type Cue } from "../store.ts";
import { Icon } from "./Icon.tsx";

const SHOW_MS = 4200;
const ANCHOR_NAMES: Record<string, string> = { POWER: "Power Anchor", IDENTITY: "Identity Anchor", MEMORY: "Memory Anchor" };

function describe(c: Cue, g: PlayerView): { icon: string; text: string; tone: string } | null {
  const who = (id: unknown) => (typeof id === "string" ? (g.players[id]?.nickname ?? "Someone") : "Someone");
  const p = c.payload;
  switch (c.kind) {
    case "FRAGMENT":
      return { icon: "FRAGMENT", text: `Memory fragment: ${FRAGMENTS[p.fragment as FragmentType].name}`, tone: "text-violet-soft border-violet/50" };
    case "CORE_MEMORY":
      return { icon: "FRAGMENT", text: `A core memory wakes (${p.total}/6)`, tone: "text-gold-bright border-gold/60" };
    case "ITEM":
      return { icon: "USE_ITEM", text: p.playerId === g.viewerId ? `You found: ${ITEMS[p.item as ItemId].name}` : `${who(p.playerId)} found an item`, tone: "text-gold border-gold/40" };
    case "COLLAPSE":
      return Number(p.to) > Number(p.from) ? { icon: "CONFRONT", text: `Collapse ${p.to} / ${g.collapseMax}`, tone: "text-ember border-ember/50" } : { icon: "ANCHOR", text: `Collapse eases to ${p.to}`, tone: "text-moss border-moss/50" };
    case "LOST":
      return { icon: "STABILIZE", text: `${who(p.playerId)} is lost`, tone: "text-ember border-ember/50" };
    case "FOUND":
      return { icon: "STABILIZE", text: `${who(p.playerId)} is back on their feet`, tone: "text-signal border-signal/50" };
    case "ENTITY_SPAWN":
      return { icon: "SECRET", text: p.kind === "ECHO" ? "Echoes walk the train" : "A shadow passenger appears", tone: "text-violet-soft border-violet/50" };
    case "SECRET":
      return p.all ? { icon: "SECRET", text: "Everyone received a private message", tone: "text-violet-soft border-violet/50" } : p.playerId === g.viewerId ? { icon: "SECRET", text: "A dream card: open your secrets", tone: "text-violet-soft border-violet/50" } : null;
    case "INSPECTOR_APPEARS":
      return { icon: "INSPECTOR", text: "The Faceless Inspector is aboard", tone: "text-ember border-ember/50" };
    case "INSPECTOR_BANISHED":
      return { icon: "INSPECTOR", text: "The Inspector is banished for a round", tone: "text-signal border-signal/50" };
    case "DISTORTION":
      return { icon: "CONFRONT", text: `Inspector distortion ${Math.min(3, Number(p.distortion))} / 3`, tone: "text-signal border-signal/50" };
    case "NEIGHBOURS": {
      const mine = (p.groups as string[][]).find((grp) => grp.includes(g.viewerId))?.filter((id) => id !== g.viewerId) ?? [];
      return mine.length ? { icon: "HELP", text: `Your seat neighbour: ${mine.map(who).join(" and ")}`, tone: "text-signal border-signal/50" } : null;
    }
    case "ANCHOR":
      return { icon: "ANCHOR", text: `${ANCHOR_NAMES[String(p.anchor)]} ${p.progress} / ${p.required}`, tone: "text-gold border-gold/40" };
    case "ANCHOR_DONE":
      return { icon: "ANCHOR", text: `${ANCHOR_NAMES[String(p.anchor)]} restored`, tone: "text-moss border-moss/50" };
    case "SHIELD":
      return { icon: "ANCHOR", text: `${who(p.playerId)}'s protection holds`, tone: "text-signal border-signal/50" };
    default:
      return null;
  }
}

export function CueFeed({ g }: { g: PlayerView }) {
  const cues = useStore((s) => s.cues);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const live = cues.filter((c) => now - c.at < SHOW_MS).map((c) => ({ c, d: describe(c, g) })).filter((x) => x.d).slice(-4);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+250px)] z-30 flex flex-col items-center gap-1.5 px-4" aria-live="polite">
      <AnimatePresence>
        {live.map(({ c, d }) => (
          <motion.div key={c.key} layout initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`flex items-center gap-2 rounded-full border bg-[#0a0f22]/95 px-3 py-1.5 text-sm ${d!.tone}`}>
            <Icon name={d!.icon} size={16} />
            {d!.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
