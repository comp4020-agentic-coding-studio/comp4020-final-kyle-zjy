// What a roll or event just did, as short floating notes everyone sees:
// fragments, items, core memories, Collapse, lost passengers, shadows, and
// in act 2 the Inspector, seat neighbours and anchor repairs.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { CharacterId } from "../../shared/characters/types.ts";
import { characterSkill } from "../../shared/game/skills.ts";
import type { AnchorId, FragmentType, ItemId, PlayerView } from "../../shared/game/state.ts";
import type { SkillVfx } from "../../shared/skills/types.ts";
import type { ScenarioText } from "../../shared/i18n/content-types.ts";
import { useCharacterText, useItemText, useScenarioText, useT, type TFunction } from "../i18n/index.ts";
import { useStore, type Cue } from "../store.ts";
import { Icon } from "./Icon.tsx";

const SHOW_MS = 4200;

const VFX: Record<SkillVfx, { icon: string; tone: string }> = {
  DICE: { icon: "DICE", tone: "text-gold-bright border-gold/60" },
  EYE: { icon: "SECRET", tone: "text-violet-soft border-violet/50" },
  SHIELD: { icon: "STABILIZE", tone: "text-signal border-signal/50" },
  SWAP: { icon: "TRADE", tone: "text-signal border-signal/50" },
  SPARK: { icon: "USE_SKILL", tone: "text-gold-bright border-gold/60" },
  CHAIN: { icon: "HELP", tone: "text-violet-soft border-violet/50" },
  STRIKE: { icon: "CONFRONT", tone: "text-ember border-ember/50" },
  CLOCK: { icon: "END_TURN", tone: "text-mist border-ash/50" },
};

function describe(c: Cue, g: PlayerView, t: TFunction, text: ScenarioText, skillName: (id: CharacterId) => string, itemName: (id: ItemId) => string): { icon: string; text: string; tone: string } | null {
  const who = (id: unknown) => (typeof id === "string" ? (g.players[id]?.nickname ?? t("common.Someone")) : t("common.Someone"));
  const anchor = (id: unknown) => text.anchors[String(id) as AnchorId] ?? String(id);
  const p = c.payload;
  switch (c.kind) {
    case "FRAGMENT":
      return { icon: "FRAGMENT", text: t("cue.fragment", { name: text.fragments[p.fragment as FragmentType].name }), tone: "text-violet-soft border-violet/50" };
    case "CORE_MEMORY":
      return { icon: "FRAGMENT", text: t("cue.core", { n: Number(p.total) }), tone: "text-gold-bright border-gold/60" };
    case "ITEM":
      return { icon: "USE_ITEM", text: p.playerId === g.viewerId ? t("cue.itemMine", { item: itemName(p.item as ItemId) }) : t("cue.itemTheirs", { name: who(p.playerId) }), tone: "text-gold border-gold/40" };
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
    case "SKILL": {
      // the scenario adapter's visual for this ability (src/shared/skills/types.ts)
      const look = VFX[characterSkill(p.characterId as CharacterId, g.scenarioId).vfx];
      return { icon: look.icon, text: t("cue.skill", { name: who(p.playerId), skill: skillName(p.characterId as CharacterId) }), tone: look.tone };
    }
    case "KEY":
      return { icon: "KEY", text: p.playerId === g.viewerId ? t("cue.keyMine", { key: itemName(p.item as ItemId) }) : t("cue.keyTheirs", { name: who(p.playerId), key: itemName(p.item as ItemId) }), tone: "text-gold-bright border-gold-bright/60" };
    // scenario 02
    case "SUNK":
      return { icon: "CONFRONT", text: t("s2.cue.sunk", { n: (p.zones as number[]).length }), tone: "text-ember border-ember/50" };
    case "FLOOD_STAGE":
      return { icon: "CONFRONT", text: t(`s2.cue.act${Number(p.act)}` as "s2.cue.act2"), tone: "text-signal border-signal/50" };
    case "PART":
      return { icon: "KEY", text: p.playerId === g.viewerId ? t("s2.cue.partMine") : t("s2.cue.part", { name: who(p.playerId) }), tone: "text-gold-bright border-gold/60" };
    case "PASS":
      return p.playerId === g.viewerId ? { icon: "KEY", text: t("s2.cue.passMine"), tone: "text-gold-bright border-gold/60" } : null;
    case "CAPACITY":
      return { icon: "ANCHOR", text: t("s2.cue.capacity", { n: Number(p.capacity) }), tone: "text-gold-bright border-gold/60" };
    case "OFFICE":
      return { icon: "ANCHOR", text: Number(p.added) === 1 ? t("s2.cue.office.one") : t("s2.cue.office.other", { n: Number(p.added) }), tone: "text-gold-bright border-gold/60" };
    case "AWAIT_START":
      return { icon: "REPAIR", text: t("s2.cue.awaitStart"), tone: "text-signal border-signal/50" };
    case "BOAT_READY":
      return { icon: "ANCHOR", text: t("s2.cue.ready"), tone: "text-moss border-moss/50" };
    case "LAUNCH":
      return { icon: "ANCHOR", text: t("s2.cue.launch"), tone: "text-moss border-moss/50" };
    case "RESCUE":
      return { icon: "HELP", text: t("s2.cue.rescue", { name: who(p.playerId) }), tone: "text-moss border-moss/50" };
    case "FACILITY":
      return { icon: "REPAIR", text: t(`s2.cue.facility.${String(p.facility)}` as "s2.cue.facility.POWER_STATION"), tone: "text-moss border-moss/50" };
    case "ROAD":
      return { icon: "CONFRONT", text: t("s2.cue.road"), tone: "text-ember border-ember/50" };
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
  const charText = useCharacterText();
  const items = useItemText();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const live = cues.filter((c) => now - c.at < SHOW_MS).map((c) => ({ c, d: describe(c, g, t, text, (id) => charText(id).skillName, (id) => items(id).name) })).filter((x) => x.d).slice(-4);
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
