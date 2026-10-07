// What a roll or event just did, as short floating notes everyone sees:
// fragments, items, core memories, Collapse, lost passengers, shadows, and
// in act 2 the Inspector, seat neighbours and anchor repairs.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { AnchorId, FragmentType, ItemId, PlayerView } from "../../shared/game/state.ts";
import type { ScenarioText } from "../../shared/i18n/content-types.ts";
import { useScenarioText, useT, type TFunction } from "../i18n/index.ts";
import { useStore, type Cue } from "../store.ts";
import { Icon } from "./Icon.tsx";

const SHOW_MS = 4200;

function describe(c: Cue, g: PlayerView, t: TFunction, text: ScenarioText): { icon: string; text: string; tone: string } | null {
  const who = (id: unknown) => (typeof id === "string" ? (g.players[id]?.nickname ?? t("common.Someone")) : t("common.Someone"));
  const anchor = (id: unknown) => text.anchors[String(id) as AnchorId] ?? String(id);
  const p = c.payload;
  switch (c.kind) {
    case "FRAGMENT":
      return { icon: "FRAGMENT", text: t("cue.fragment", { name: text.fragments[p.fragment as FragmentType].name }), tone: "text-violet-soft border-violet/50" };
    case "CORE_MEMORY":
      return { icon: "FRAGMENT", text: t("cue.core", { n: Number(p.total) }), tone: "text-gold-bright border-gold/60" };
    case "ITEM":
      return { icon: "USE_ITEM", text: p.playerId === g.viewerId ? t("cue.itemMine", { item: text.items[p.item as ItemId].name }) : t("cue.itemTheirs", { name: who(p.playerId) }), tone: "text-gold border-gold/40" };
    case "COLLAPSE":
      return Number(p.to) > Number(p.from) ? { icon: "CONFRONT", text: t("cue.collapseUp", { n: Number(p.to), max: g.collapseMax }), tone: "text-ember border-ember/50" } : { icon: "ANCHOR", text: t("cue.collapseDown", { n: Number(p.to) }), tone: "text-moss border-moss/50" };
    case "LOST":
      return { icon: "STABILIZE", text: t("cue.lost", { name: who(p.playerId) }), tone: "text-ember border-ember/50" };
    case "FOUND":
      return { icon: "STABILIZE", text: t("cue.found", { name: who(p.playerId) }), tone: "text-signal border-signal/50" };
    case "ENTITY_SPAWN":
      return { icon: "SECRET", text: t(p.kind === "ECHO" ? "cue.echoes" : "cue.shadow"), tone: "text-violet-soft border-violet/50" };
    case "SECRET":
      return p.all ? { icon: "SECRET", text: t("cue.secretAll"), tone: "text-violet-soft border-violet/50" } : p.playerId === g.viewerId ? { icon: "SECRET", text: t("cue.dream"), tone: "text-violet-soft border-violet/50" } : null;
    case "INSPECTOR_APPEARS":
      return { icon: "INSPECTOR", text: t("cue.inspectorAppears"), tone: "text-ember border-ember/50" };
    case "INSPECTOR_BANISHED":
      return { icon: "INSPECTOR", text: t("cue.inspectorBanished"), tone: "text-signal border-signal/50" };
    case "DISTORTION":
      return { icon: "CONFRONT", text: t("cue.distortion", { n: Math.min(3, Number(p.distortion)) }), tone: "text-signal border-signal/50" };
    case "NEIGHBOURS": {
      const mine = (p.groups as string[][]).find((grp) => grp.includes(g.viewerId))?.filter((id) => id !== g.viewerId) ?? [];
      return mine.length ? { icon: "HELP", text: t("cue.neighbour", { names: mine.map(who).join(t("common.andSep")) }), tone: "text-signal border-signal/50" } : null;
    }
    case "ANCHOR":
      return { icon: "ANCHOR", text: t("cue.anchor", { anchor: anchor(p.anchor), progress: Number(p.progress), required: Number(p.required) }), tone: "text-gold border-gold/40" };
    case "ANCHOR_DONE":
      return { icon: "ANCHOR", text: t("cue.anchorDone", { anchor: anchor(p.anchor) }), tone: "text-moss border-moss/50" };
    case "SHIELD":
      return { icon: "ANCHOR", text: t("cue.shield", { name: who(p.playerId) }), tone: "text-signal border-signal/50" };
    default:
      return null;
  }
}

export function CueFeed({ g }: { g: PlayerView }) {
  const cues = useStore((s) => s.cues);
  const t = useT();
  const text = useScenarioText();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const live = cues.filter((c) => now - c.at < SHOW_MS).map((c) => ({ c, d: describe(c, g, t, text) })).filter((x) => x.d).slice(-4);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+250px)] z-30 flex flex-col items-center gap-1.5 px-4" aria-live="polite">
      <AnimatePresence>
        {live.map(({ c, d }) => (
          <motion.div key={c.key} layout initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`flex max-w-full items-center gap-2 rounded-full border bg-[#0a0f22]/95 px-3 py-1.5 text-sm ${d!.tone}`}>
            <Icon name={d!.icon} size={16} />
            {d!.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
