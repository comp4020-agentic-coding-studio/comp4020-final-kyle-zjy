// Layer two: "what can I do". The player's own state (Sanity, Fate, action
// points, ability, items) and the action grid. Unavailable actions stay
// visible, greyed, and say why when tapped.
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { ActionAvailability, GameAction, GameActionType } from "../../shared/game/actions.ts";
import { isKeyItem, ITEMS, MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import type { ItemId, PlayerView, PublicPlayerState, S01ItemId } from "../../shared/game/state.ts";
import { ITEMS02, PART_IDS, type PartId, type S02ItemId } from "../../shared/game/scenario02/items.ts";
import { ZONES } from "../../shared/game/scenario02/map.ts";
import { Avatar } from "../components/Avatar.tsx";
import { sendGame } from "../store.ts";
import { useCharacterText, useFormat, useItemText, useScenario02Text, useScenarioText, useT, type MessageKey, type TFunction } from "../i18n/index.ts";
import { Icon } from "./Icon.tsx";
import { statusName } from "./status.ts";
import { characterSkill } from "../../shared/game/skills.ts";

const GRID: GameActionType[] = ["MOVE", "INVESTIGATE", "SEARCH", "REPAIR", "HELP", "TRADE", "STABILIZE", "CONFRONT"];
/** Scenario 02: the city's actions (abilities, items and ending the turn have their own row). */
const GRID02: GameActionType[] = ["MOVE", "SEARCH", "INVESTIGATE", "REPAIR", "OPERATE", "RESCUE", "SALVAGE", "HELP", "STABILIZE", "TRADE", "INSTALL", "REGISTER", "RESTART_GENERATOR", "SHARE_INTEL"];
/** Actions that need no choice: pressing them acts. */
const DIRECT = new Set<GameActionType>(["INVESTIGATE", "SEARCH", "REPAIR", "END_TURN", "OPERATE", "SALVAGE", "REGISTER", "RESTART_GENERATOR"]);

/** The action being chosen for (its picker is open), or null for the grid. */
export type Mode = null | GameActionType;

/**
 * A scenario's own dock (scenario 03): its action grid, the actions that act
 * on a single press, and the second step (title and choices) for its own
 * targeted actions. Without one, the dock is scenario 01's or 02's.
 */
export type DockExtension = {
  grid: GameActionType[];
  coreActions?: GameActionType[];
  direct: Set<GameActionType>;
  /** Tailwind classes for the grid's wide-screen columns. */
  columns: string;
  /** Hide shared skill, item and end-turn controls for a different turn model. */
  showSharedActions?: boolean;
  itemAction?: GameActionType;
  hudClassName?: string;
  effectChips?: (g: PlayerView, me: PublicPlayerState) => React.ReactNode;
  /** The picker's title (a catalog key) and choices for one of its actions, or null for the shared picker. */
  picker: (p: { g: PlayerView; me: PublicPlayerState; mode: GameActionType; availability: ActionAvailability; send: (a: GameAction) => void }) => { title: MessageKey; body: React.ReactNode } | null;
};

export function Dock({ g, mode, setMode, extension }: { g: PlayerView; mode: Mode; setMode: (m: Mode) => void; extension?: DockExtension }) {
  const me = g.players[g.viewerId];
  const [why, setWhy] = useState<string | null>(null);
  const t = useT();
  const fmt = useFormat();
  const charText = useCharacterText();
  if (!me) return null;
  const action = (t: GameActionType) => g.myActions.find((a) => a.type === t)!;
  const myTurn = g.step === "PLAYER_TURNS" && g.turnOrder[g.activeIndex] === g.viewerId;

  const press = (a: ActionAvailability) => {
    if (!a.enabled) {
      setWhy(t("dock.why", { action: t(`action.${a.type}`), reason: fmt(a.reason) }));
      return;
    }
    setWhy(null);
    if ((extension?.direct ?? DIRECT).has(a.type)) {
      setMode(null);
      void sendGame({ type: a.type } as GameAction);
      return;
    }
    if (a.type === "MOVE" && a.targets?.length === 1) {
      void sendGame({ type: "MOVE", toCarriage: Number(a.targets[0]) });
      return;
    }
    setMode(mode === a.type ? null : (a.type as Mode));
  };

  return (
    <div className="safe-bottom relative z-20 border-t border-gold/15 bg-[#05060d]/92 px-3 pt-2 backdrop-blur-md sm:px-4">
      <div className="mx-auto grid max-w-6xl gap-2 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-4">
        {extension?.hudClassName ? <div className={extension.hudClassName}><Hud g={g} me={me} extension={extension} /></div> : <Hud g={g} me={me} extension={extension} />}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {mode ? (
              <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                <Picker g={g} me={me} mode={mode} availability={action(mode === "STABILIZE" ? "STABILIZE" : mode)} close={() => setMode(null)} extension={extension} />
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {extension?.coreActions && <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                  {extension.coreActions.map((type) => <ActionButton key={type} a={action(type)} onPress={press} compact wide />)}
                </div>}
                <div className={`grid grid-cols-4 gap-1.5 ${extension ? extension.columns : g.city ? "lg:grid-cols-7" : ""}`}>
                  {(extension?.grid ?? (g.city ? GRID02 : GRID)).filter((type) => !extension?.coreActions?.includes(type)).map((type) => (
                    <ActionButton key={type} a={action(type)} onPress={press} compact={!!g.city || !!extension} />
                  ))}
                </div>
                {extension?.showSharedActions !== false && <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-1.5">
                  <ActionButton a={action("USE_SKILL")} onPress={press} wide wrap={!!g.auction} label={charText(me.skill.borrowed ?? me.characterId).skillName} />
                  <ActionButton a={action(extension?.itemAction ?? "USE_ITEM")} onPress={press} wide label={t("dock.items", { n: g.auction ? g.auction.players[g.viewerId].items.length : me.items.length })} />
                  <button
                    data-action="END_TURN"
                    className={`btn min-h-12 min-w-0 rounded-xl px-2 text-sm whitespace-nowrap ${myTurn ? (me.ap === 0 ? "btn-signal" : "btn-ghost") : "btn-ghost opacity-40"}`}
                    onClick={() => press(action("END_TURN"))}
                    aria-disabled={!action("END_TURN").enabled}
                  >
                    <Icon name="END_TURN" size={18} /> <span className="min-w-0 truncate">{t("action.END_TURN")}</span>
                  </button>
                </div>}
              </motion.div>
            )}
          </AnimatePresence>
          <p className="mt-1.5 min-h-5 text-xs text-mist" role="status" aria-live="polite">
            {why ?? (myTurn ? (me.ap > 0 ? (me.ap === 1 ? t("dock.apLeft.one") : t("dock.apLeft.other", { n: me.ap })) : t("dock.noAp")) : "")}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ a, onPress, wide = false, compact = false, wrap = false, label }: { a: ActionAvailability; onPress: (a: ActionAvailability) => void; wide?: boolean; compact?: boolean; wrap?: boolean; label?: string }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <button
      onClick={() => onPress(a)}
      data-action={a.type}
      aria-disabled={!a.enabled}
      title={fmt(a.enabled ? a.hint : a.reason) || undefined}
      className={`group relative flex ${compact ? "min-h-[52px]" : "min-h-[58px]"} min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-center transition ${
        a.enabled ? "border-gold/40 bg-[#121a3a]/80 text-moon hover:border-gold-bright hover:bg-[#1d2657]" : "border-[#1d2657] bg-[#0a0f22]/60 text-ash"
      } ${wide ? "flex-row gap-2 px-2" : ""}`}
    >
      <Icon name={a.type} size={wide ? 18 : 20} className={a.enabled ? "text-gold-bright" : ""} />
      <span className={`${wrap ? "line-clamp-2 min-w-0 break-words leading-tight" : "truncate"} text-[11px] font-semibold sm:text-xs ${wide && !wrap ? "max-w-[9rem]" : ""}`}>{label ?? t(`action.${a.type}`)}</span>
      {a.apCost > 0 && <span className={`absolute top-1 right-1.5 font-mono text-[9px] ${a.enabled ? "text-gold" : "text-ash/70"}`}>{t("dock.apCost", { n: a.apCost })}</span>}
    </button>
  );
}

function Hud({ g, me, extension }: { g: PlayerView; me: PublicPlayerState; extension?: DockExtension }) {
  const ch = getCharacterById(me.characterId);
  const t = useT();
  const charText = useCharacterText();
  const text = useScenarioText();
  const skill = charText(me.skill.borrowed ?? me.characterId);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative shrink-0">
        <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={52} className={`ring-2 ${me.lost ? "ring-ember" : "ring-gold/60"}`} />
        {me.lost && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-ember px-1 text-[9px] font-bold whitespace-nowrap text-white">{t("dock.lost")}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {me.nickname} <span className="font-display text-gold-bright">· {charText(ch.id).title}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stat label={t("common.sanity")} value={`${me.sanity}/${MAX_SANITY}`}>
            {Array.from({ length: MAX_SANITY }, (_, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < me.sanity ? "bg-signal shadow-[0_0_6px_#5ce1e6]" : "border border-ash/60"}`} />
            ))}
          </Stat>
          <Stat label={t("common.fate")} value={String(me.fate)}>
            <motion.span key={me.fate} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="h-3 w-3 rounded-full bg-gradient-to-br from-gold-bright to-gold shadow-[var(--glow-gold)]" />
          </Stat>
          <Stat label={t("common.ap")} value={`${me.ap}`}>
            {Array.from({ length: Math.max(2, me.ap) }, (_, i) => (
              <span key={i} className={`h-2.5 w-1.5 rounded-sm ${i < me.ap ? "bg-gold-bright" : "bg-indigo"}`} />
            ))}
          </Stat>
          {g.auction && <>
            <Stat label={t("s4.hud.chips")} value={String(g.auction.players[g.viewerId]?.blackChips ?? 0)}><span aria-hidden="true">●</span></Stat>
            <Stat label={t("s4.hud.debt")} value={String(g.auction.players[g.viewerId]?.debt ?? 0)}><span aria-hidden="true">◆</span></Stat>
          </>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${
              me.skill.state === "READY" ? "border-moss/60 text-moss" : me.skill.state === "LOCKED" ? "border-ash text-ash" : "border-ember/50 text-ember/80 line-through"
            }`}
            title={skill.skillDescription}
          >
            {t("dock.skillChip", { skill: skill.skillName, state: t(`skill.state.${me.skill.state}`) })}
          </span>
          {extension?.effectChips?.(g, me)}
          {me.items.filter(isKeyItem).map((k) => (
            <motion.span key={k} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1 rounded-full border border-gold-bright/70 bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold-bright">
              <Icon name="KEY" size={11} />
              {text.items[k].name}
            </motion.span>
          ))}
          {me.helpBonus > 0 && <span className="rounded-full border border-signal/50 px-2 py-0.5 text-[10px] text-signal">{t("dock.helpBonus", { n: me.helpBonus })}</span>}
          {me.shields > 0 && <span className="rounded-full border border-violet-soft/50 px-2 py-0.5 text-[10px] text-violet-soft">{t("dock.shield", { n: me.shields })}</span>}
          {me.statuses.map((st) => (
            <span key={st.id} className={`rounded-full border px-2 py-0.5 text-[10px] ${st.polarity === "NEGATIVE" ? "border-ember/50 text-ember" : "border-gold/40 text-gold"}`}>
              {statusName(text, st.kind)}
              {st.hidden ? t("dock.hidden") : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${label} ${value}`}>
      <span className="text-[10px] font-bold tracking-wider text-mist uppercase">{label}</span>
      <span className="flex items-center gap-0.5">{children}</span>
      <span className="font-mono text-xs text-moon">{value}</span>
    </span>
  );
}

/** The second step of a targeted action: choose who / where / what. */
function Picker({ g, me, mode, availability, close, extension }: { g: PlayerView; me: PublicPlayerState; mode: Exclude<Mode, null>; availability: ActionAvailability; close: () => void; extension?: DockExtension }) {
  const send = (action: GameAction) => {
    close();
    void sendGame(action);
  };
  const people = (ids: (string | number)[]) => ids.map(String).filter((id) => g.players[id]).map((id) => g.players[id]);
  // `t` is a target below, so the translator is `tr` here
  const tr = useT();
  const text = useScenarioText();
  const fmt = useFormat();
  const city = useScenario02Text();
  const zoneName = (i: number) => city.zones[ZONES[i].id].name;
  const npcName = (id: string) => city.npcs[id]?.name ?? id;
  const partName = (id: string) => city.parts[id]?.name ?? id;
  let title = "";
  let body: React.ReactNode = null;
  const own = extension?.picker({ g, me, mode, availability, send });

  if (own) {
    title = tr(own.title);
    body = own.body;
  } else if (mode === "MOVE" && g.city) {
    title = tr("s2.pick.move");
    body = (
      <div className="flex flex-wrap gap-2">
        {(availability.targets ?? []).map((t) => (
          <button key={t} className="btn btn-ghost text-sm" onClick={() => send({ type: "MOVE", toCarriage: Number(t) })}>
            {zoneName(Number(t))}
            {g.city!.zones[Number(t)].status === "FLOODED" ? tr("s2.pick.wade") : ""}
          </button>
        ))}
      </div>
    );
  } else if (mode === "RESCUE") {
    title = tr("s2.pick.rescue");
    const npcs = (availability.targets ?? []).map(String).filter((id) => !g.players[id]);
    body = (
      <div className="flex flex-wrap gap-2">
        {npcs.map((id) => (
          <button key={id} className="btn btn-ghost text-sm" onClick={() => send({ type: "RESCUE", npcId: id })}>
            {npcName(id)}
          </button>
        ))}
        <PeopleRow people={people(availability.targets ?? [])} onPick={(id) => send({ type: "RESCUE", targetId: id })} />
      </div>
    );
  } else if (mode === "INSTALL") {
    title = tr("s2.pick.install");
    body = (
      <div className="flex flex-wrap gap-2">
        {(availability.targets ?? []).map(String).map((part) => (
          <button key={part} className="btn btn-ghost text-sm" onClick={() => send({ type: "INSTALL", part: part as PartId | "BATTERIES" })}>
            {part === "BATTERIES" ? tr("s2.pick.batteries") : partName(part)}
          </button>
        ))}
      </div>
    );
  } else if (mode === "SHARE_INTEL") {
    title = tr("s2.pick.intel");
    body = (
      <div className="grid grid-cols-1 gap-1.5">
        {(availability.targets ?? []).map(String).map((id) => (
          <button key={id} className="btn btn-ghost min-h-12 justify-start text-left text-sm" onClick={() => send({ type: "SHARE_INTEL", intelId: id })}>
            {fmt(g.mySecrets?.peeks.find((p) => p.id === id)?.text)}
          </button>
        ))}
      </div>
    );
  } else if (mode === "MOVE") {
    title = tr("dock.pick.move");
    body = (
      <div className="flex gap-2">
        {(availability.targets ?? []).map((t) => (
          <button key={t} className="btn btn-ghost flex-1 text-sm" onClick={() => send({ type: "MOVE", toCarriage: Number(t) })}>
            {Number(t) < me.carriageIndex ? "← " : ""}
            {carriageName(g, Number(t), tr)}
            {Number(t) > me.carriageIndex ? " →" : ""}
          </button>
        ))}
      </div>
    );
  } else if (mode === "HELP") {
    title = tr("dock.pick.help");
    body = <PeopleRow people={people(availability.targets ?? [])} onPick={(id) => send({ type: "HELP", targetId: id })} />;
  } else if (mode === "CONFRONT") {
    title = tr("dock.pick.confront");
    body = (
      <div className="flex flex-wrap gap-2">
        {(availability.targets ?? []).map((t) => (
          <button key={t} className="btn btn-ghost text-sm" onClick={() => send(t === "INSPECTOR" ? { type: "CONFRONT", target: "INSPECTOR" } : { type: "CONFRONT", target: "ENTITY", entityId: String(t) })}>
            {tr(t === "INSPECTOR" ? "dock.confront.inspector" : g.entities.find((e) => e.id === t)?.kind === "ECHO" ? "dock.confront.echo" : "dock.confront.shadow")}
          </button>
        ))}
      </div>
    );
  } else if (mode === "STABILIZE") {
    title = tr("dock.pick.steady");
    const negatives = me.statuses.filter((st) => st.polarity === "NEGATIVE" && st.ordinary);
    body = (
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost text-sm" disabled={me.sanity >= MAX_SANITY && !me.lost} onClick={() => send({ type: "STABILIZE", mode: "SANITY" })}>
          {tr("dock.recoverSanity")}
        </button>
        {negatives.map((st) => (
          <button key={st.id} className="btn btn-ghost text-sm" onClick={() => send({ type: "STABILIZE", mode: "CLEANSE", statusId: st.id })}>
            {tr("dock.clearStatus", { status: statusName(text, st.kind) })}
          </button>
        ))}
      </div>
    );
  } else if (mode === "USE_ITEM") {
    title = tr("dock.pick.item");
    body = (
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {[...new Set(me.items)].map((item) => (
          <ItemButton key={item} item={item} count={me.items.filter((i) => i === item).length} g={g} me={me} onUse={(targetId) => send({ type: "USE_ITEM", item, targetId })} />
        ))}
      </div>
    );
  } else if (mode === "USE_SKILL") {
    body = <SkillPicker g={g} me={me} onUse={(targets) => send({ type: "USE_SKILL", targets })} />;
    title = tr("dock.pick.skill");
  } else if (mode === "TRADE") {
    title = tr("dock.pick.trade");
    body = <TradeBuilder g={g} me={me} partners={people(availability.targets ?? [])} onSend={send} />;
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-[#0e1430]/90 p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm text-moon">{title}</p>
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-mist hover:text-moon" onClick={close} aria-label={tr("common.cancel")}>
          <Icon name="CLOSE" size={18} />
        </button>
      </div>
      {body}
    </div>
  );
}

const carriageName = (g: PlayerView, i: number, t: TFunction) => {
  const c = g.carriages[i];
  return c ? t(`dock.carriage.${c.identity}`) : "?";
};

export function PeopleRow({ people, onPick, selected = [] }: { people: PublicPlayerState[]; onPick: (id: string) => void; selected?: string[] }) {
  const t = useT();
  if (!people.length) return <p className="text-sm text-ash">{t("dock.nobody")}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => {
        const ch = getCharacterById(p.characterId);
        const on = selected.includes(p.playerId);
        return (
          <button key={p.playerId} onClick={() => onPick(p.playerId)} aria-pressed={on} className={`flex min-h-12 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm ${on ? "border-signal bg-signal/10" : "border-gold/30 hover:border-gold-bright"}`}>
            <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={36} />
            {p.nickname}
          </button>
        );
      })}
    </div>
  );
}

function ItemButton({ item, count, g, me, onUse }: { item: ItemId; count: number; g: PlayerView; me: PublicPlayerState; onUse: (targetId?: string) => void }) {
  const words = useItemText()(item);
  const info = { ...(ITEMS[item as S01ItemId] ?? ITEMS02[item as S02ItemId]), name: words.name, text: words.text };
  const [choosing, setChoosing] = useState(false);
  const t = useT();
  const mates = Object.values(g.players).filter((p) => p.carriageIndex === me.carriageIndex && !p.away);
  if (isKeyItem(item))
    return (
      <div className="flex min-h-12 items-start gap-2 rounded-lg border border-gold-bright/50 bg-gold/10 p-2 text-left">
        <Icon name="KEY" size={18} className="mt-0.5 shrink-0 text-gold-bright" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gold-bright">{info.name}</span>
          <span className="block text-[10px] font-bold tracking-wider text-gold">{t("dock.keyItem")}</span>
          <span className="block text-xs text-mist">{info.text}</span>
        </span>
      </div>
    );
  if (choosing) return <PeopleRow people={mates} onPick={(id) => onUse(id)} />;
  return (
    <button className="flex min-h-12 items-start gap-2 rounded-lg border border-gold/30 bg-[#121a3a]/70 p-2 text-left hover:border-gold-bright" onClick={() => (info.needsTarget && mates.length > 1 ? setChoosing(true) : onUse())}>
      <Icon name="USE_ITEM" size={18} className="mt-0.5 shrink-0 text-gold" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">
          {info.name}
          {count > 1 ? ` ×${count}` : ""}
        </span>
        <span className="block text-xs text-mist">{info.text}</span>
      </span>
    </button>
  );
}

function SkillPicker({ g, me, onUse }: { g: PlayerView; me: PublicPlayerState; onUse: (targets: string[]) => void }) {
  const skill = characterSkill(me.skill.borrowed ?? me.characterId, g.scenarioId);
  const words = useCharacterText()(me.skill.borrowed ?? me.characterId);
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const all = Object.values(g.players).filter((p) => !p.away);
  const rule = skill.target;
  const pool =
    rule === "OTHER_PLAYER" ? all.filter((p) => p.playerId !== me.playerId) : rule === "SAME_CARRIAGE" ? all.filter((p) => p.playerId !== me.playerId && p.carriageIndex === me.carriageIndex) : all;
  const need = rule === "TWO_PLAYERS" ? 2 : rule === "UP_TO_THREE_PLAYERS" ? 3 : rule === "ANY_PLAYER" || rule === "OTHER_PLAYER" || rule === "SAME_CARRIAGE" ? 1 : 0;
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : need === 1 ? [id] : cur.length < need ? [...cur, id] : cur));
  const ready = need === 0 || (rule === "UP_TO_THREE_PLAYERS" ? picked.length >= 1 : picked.length === need);
  return (
    <div>
      <p className="mb-2 text-sm">
        <span className="font-display text-lg text-gold-bright">{words.skillName}</span> <span className="text-mist">{words.skillDescription}</span>
      </p>
      {need > 0 && (
        <>
          <p className="mb-1 text-xs text-mist">{t(rule === "TWO_PLAYERS" ? "dock.chooseTwo" : rule === "UP_TO_THREE_PLAYERS" ? "dock.chooseUpToThree" : "dock.chooseOne")}</p>
          <PeopleRow people={pool} selected={picked} onPick={toggle} />
          {need > 1 && picked.length > 1 && <p className="mt-1 text-xs text-mist">{t("dock.order", { names: picked.map((id) => g.players[id]?.nickname).join(t("common.listSep")) })}</p>}
        </>
      )}
      <button data-skill-confirm className="btn btn-gold mt-2 w-full" disabled={!ready} onClick={() => onUse(picked)}>
        {t("dock.burn", { skill: words.skillName })}
      </button>
    </div>
  );
}

function TradeBuilder({ g, me, partners, onSend }: { g: PlayerView; me: PublicPlayerState; partners: PublicPlayerState[]; onSend: (a: GameAction) => void }) {
  const [partner, setPartner] = useState<string | null>(partners[0]?.playerId ?? null);
  const [give, setGive] = useState<number[]>([]);
  const [want, setWant] = useState<number[]>([]);
  const [giveFate, setGiveFate] = useState(0);
  const [wantFate, setWantFate] = useState(0);
  const [giveParts, setGiveParts] = useState<PartId[]>([]);
  const [wantParts, setWantParts] = useState<PartId[]>([]);
  const [givePasses, setGivePasses] = useState(0);
  const [wantPasses, setWantPasses] = useState(0);
  const city = g.city;
  const myParts = city?.holdings[me.playerId]?.parts ?? [];
  const myPasses = city?.holdings[me.playerId]?.passes ?? 0;
  const togglePart = (list: PartId[], set: (v: PartId[]) => void, p: PartId) => set(list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);
  const them = partner ? g.players[partner] : null;
  const t = useT();
  const toggle = (list: number[], set: (v: number[]) => void, i: number) => set(list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);
  const empty = !give.length && !want.length && !giveFate && !wantFate && !giveParts.length && !wantParts.length && !givePasses && !wantPasses;
  return (
    <div className="space-y-2">
      <PeopleRow people={partners} selected={partner ? [partner] : []} onPick={(id) => { setPartner(id); setWant([]); setWantFate(0); }} />
      {them && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <TradeSide title={t("dock.youGive")} items={me.items} picked={give} onToggle={(i) => toggle(give, setGive, i)} fate={giveFate} maxFate={me.fate} setFate={setGiveFate} />
          <TradeSide title={t("dock.theyGive", { name: them.nickname })} items={them.items} picked={want} onToggle={(i) => toggle(want, setWant, i)} fate={wantFate} maxFate={them.fate} setFate={setWantFate} />
        </div>
      )}
      {them && city && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <CitySide parts={myParts} picked={giveParts} onToggle={(p) => togglePart(giveParts, setGiveParts, p)} passes={givePasses} maxPasses={myPasses} setPasses={setGivePasses} />
          <CitySide parts={PART_IDS} picked={wantParts} onToggle={(p) => togglePart(wantParts, setWantParts, p)} passes={wantPasses} maxPasses={9} setPasses={setWantPasses} hint={t("s2.trade.theyMayNot")} />
        </div>
      )}
      <button
        className="btn btn-gold w-full"
        disabled={!them || empty}
        onClick={() =>
          them &&
          onSend({
            type: "TRADE",
            targetId: them.playerId,
            give: { items: give.map((i) => me.items[i]), fate: giveFate, ...(city ? { parts: giveParts, passes: givePasses } : {}) },
            want: { items: want.map((i) => them.items[i]), fate: wantFate, ...(city ? { parts: wantParts, passes: wantPasses } : {}) },
          })
        }
      >
        {t("dock.offerTrade")}
      </button>
    </div>
  );
}

/** Scenario 02: boat parts and passes on one side of an offer. What the other side carries is hidden: you can ask, they may not have it. */
function CitySide({ parts, picked, onToggle, passes, maxPasses, setPasses, hint }: { parts: PartId[]; picked: PartId[]; onToggle: (p: PartId) => void; passes: number; maxPasses: number; setPasses: (n: number) => void; hint?: string }) {
  const t = useT();
  const text = useScenario02Text();
  return (
    <div className="min-w-0 rounded-lg border border-indigo p-2">
      <p className="label mb-1 truncate text-[10px]">{t("s2.trade.parts")}</p>
      <div className="flex flex-wrap gap-1">
        {parts.length ? (
          parts.map((p) => (
            <button key={p} onClick={() => onToggle(p)} aria-pressed={picked.includes(p)} className={`min-h-12 rounded-full border px-2 py-1 text-xs ${picked.includes(p) ? "border-signal text-signal" : "border-gold/30 text-mist"}`}>
              {text.parts[p].name}
            </button>
          ))
        ) : (
          <span className="text-xs text-ash">{t("s2.secrets.none")}</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-mist">{t("s2.trade.passes")}</span>
        <button className="h-12 w-12 rounded-full border border-gold/30" onClick={() => setPasses(Math.max(0, passes - 1))} aria-label={t("s2.trade.lessPasses")}>−</button>
        <span className="font-mono">{passes}</span>
        <button className="h-12 w-12 rounded-full border border-gold/30" onClick={() => setPasses(Math.min(maxPasses, passes + 1))} aria-label={t("s2.trade.morePasses")}>+</button>
      </div>
      {hint && <p className="mt-1 text-[10px] text-ash">{hint}</p>}
    </div>
  );
}

function TradeSide({ title, items, picked, onToggle, fate, maxFate, setFate }: { title: string; items: ItemId[]; picked: number[]; onToggle: (i: number) => void; fate: number; maxFate: number; setFate: (n: number) => void }) {
  const t = useT();
  const names = useItemText();
  return (
    <div className="min-w-0 rounded-lg border border-indigo p-2">
      <p className="label mb-1 truncate text-[10px]">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.length ? (
          items.map((item, i) => (
            <button key={i} onClick={() => onToggle(i)} aria-pressed={picked.includes(i)} className={`rounded-full border px-2 py-1 text-xs ${picked.includes(i) ? "border-signal text-signal" : "border-gold/30 text-mist"}`}>
              {names(item).name}
            </button>
          ))
        ) : (
          <span className="text-xs text-ash">{t("dock.noItems")}</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-mist">{t("common.fate")}</span>
        <button className="h-12 w-12 rounded-full border border-gold/30" onClick={() => setFate(Math.max(0, fate - 1))} aria-label={t("dock.lessFate")}>−</button>
        <span className="font-mono">{fate}</span>
        <button className="h-12 w-12 rounded-full border border-gold/30" onClick={() => setFate(Math.min(maxFate, fate + 1))} aria-label={t("dock.moreFate")}>+</button>
      </div>
    </div>
  );
}
