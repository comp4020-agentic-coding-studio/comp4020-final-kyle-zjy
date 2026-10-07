// Layer two: "what can I do". The player's own state (Sanity, Fate, action
// points, ability, items) and the action grid. Unavailable actions stay
// visible, greyed, and say why when tapped.
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import type { ActionAvailability, GameAction, GameActionType } from "../../shared/game/actions.ts";
import { ITEMS, MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import type { ItemId, PlayerView, PublicPlayerState } from "../../shared/game/state.ts";
import { Avatar } from "../components/Avatar.tsx";
import { sendGame } from "../store.ts";
import { Icon } from "./Icon.tsx";
import { statusShort as statusLabel } from "../../shared/game/scenario01/statuses.ts";

export const ACTION_LABEL: Record<GameActionType, string> = {
  MOVE: "Move",
  INVESTIGATE: "Investigate",
  SEARCH: "Search",
  REPAIR: "Repair",
  HELP: "Help",
  TRADE: "Trade",
  STABILIZE: "Steady",
  CONFRONT: "Confront",
  USE_SKILL: "Ability",
  USE_ITEM: "Item",
  END_TURN: "End turn",
  RESPOND: "Respond",
  ACK_SEQUENCE: "Continue",
};

const GRID: GameActionType[] = ["MOVE", "INVESTIGATE", "SEARCH", "REPAIR", "HELP", "TRADE", "STABILIZE", "CONFRONT"];

export type Mode = null | "MOVE" | "HELP" | "TRADE" | "CONFRONT" | "USE_SKILL" | "USE_ITEM" | "STABILIZE";

export function Dock({ g, mode, setMode }: { g: PlayerView; mode: Mode; setMode: (m: Mode) => void }) {
  const me = g.players[g.viewerId];
  const [why, setWhy] = useState<string | null>(null);
  if (!me) return null;
  const action = (t: GameActionType) => g.myActions.find((a) => a.type === t)!;
  const myTurn = g.step === "PLAYER_TURNS" && g.turnOrder[g.activeIndex] === g.viewerId;

  const press = (a: ActionAvailability) => {
    if (!a.enabled) {
      setWhy(`${ACTION_LABEL[a.type]}: ${a.reason}`);
      return;
    }
    setWhy(null);
    if (a.type === "INVESTIGATE" || a.type === "SEARCH" || a.type === "REPAIR" || a.type === "END_TURN") {
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
        <Hud g={g} me={me} />
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {mode ? (
              <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                <Picker g={g} me={me} mode={mode} availability={action(mode === "STABILIZE" ? "STABILIZE" : mode)} close={() => setMode(null)} />
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid grid-cols-4 gap-1.5">
                  {GRID.map((t) => (
                    <ActionButton key={t} a={action(t)} onPress={press} />
                  ))}
                </div>
                <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-1.5">
                  <ActionButton a={action("USE_SKILL")} onPress={press} wide label={getCharacterById(me.skill.borrowed ?? me.characterId).skill.name} />
                  <ActionButton a={action("USE_ITEM")} onPress={press} wide label={`Items (${me.items.length})`} />
                  <button
                    className={`btn min-h-12 min-w-0 rounded-xl px-2 text-sm whitespace-nowrap ${myTurn ? (me.ap === 0 ? "btn-signal" : "btn-ghost") : "btn-ghost opacity-40"}`}
                    onClick={() => press(action("END_TURN"))}
                    aria-disabled={!action("END_TURN").enabled}
                  >
                    <Icon name="END_TURN" size={18} /> End turn
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="mt-1.5 min-h-5 text-xs text-mist" role="status" aria-live="polite">
            {why ?? (myTurn ? (me.ap > 0 ? `${me.ap} action point${me.ap > 1 ? "s" : ""} left. Abilities and items are free.` : "Out of action points. Use an ability or item, or end your turn.") : "")}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ a, onPress, wide = false, label }: { a: ActionAvailability; onPress: (a: ActionAvailability) => void; wide?: boolean; label?: string }) {
  return (
    <button
      onClick={() => onPress(a)}
      data-action={a.type}
      aria-disabled={!a.enabled}
      title={a.enabled ? a.hint : a.reason}
      className={`group relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-center transition ${
        a.enabled ? "border-gold/40 bg-[#121a3a]/80 text-moon hover:border-gold-bright hover:bg-[#1d2657]" : "border-[#1d2657] bg-[#0a0f22]/60 text-ash"
      } ${wide ? "flex-row gap-2 px-2" : ""}`}
    >
      <Icon name={a.type} size={wide ? 18 : 20} className={a.enabled ? "text-gold-bright" : ""} />
      <span className={`truncate text-[11px] font-semibold sm:text-xs ${wide ? "max-w-[9rem]" : ""}`}>{label ?? ACTION_LABEL[a.type]}</span>
      {a.apCost > 0 && <span className={`absolute top-1 right-1.5 font-mono text-[9px] ${a.enabled ? "text-gold" : "text-ash/70"}`}>{a.apCost}AP</span>}
    </button>
  );
}

function Hud({ g, me }: { g: PlayerView; me: PublicPlayerState }) {
  const ch = getCharacterById(me.characterId);
  const skill = getCharacterById(me.skill.borrowed ?? me.characterId).skill;
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <Avatar zodiac={ch.zodiac} mbti={ch.mbti} size={52} className={`ring-2 ${me.lost ? "ring-ember" : "ring-gold/60"}`} />
        {me.lost && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-ember px-1 text-[9px] font-bold text-white">LOST</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {me.nickname} <span className="font-display text-gold-bright">· {ch.nickname}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stat label="Sanity" value={`${me.sanity}/${MAX_SANITY}`}>
            {Array.from({ length: MAX_SANITY }, (_, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < me.sanity ? "bg-signal shadow-[0_0_6px_#5ce1e6]" : "border border-ash/60"}`} />
            ))}
          </Stat>
          <Stat label="Fate" value={String(me.fate)}>
            <motion.span key={me.fate} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="h-3 w-3 rounded-full bg-gradient-to-br from-gold-bright to-gold shadow-[var(--glow-gold)]" />
          </Stat>
          <Stat label="AP" value={`${me.ap}`}>
            {Array.from({ length: Math.max(2, me.ap) }, (_, i) => (
              <span key={i} className={`h-2.5 w-1.5 rounded-sm ${i < me.ap ? "bg-gold-bright" : "bg-indigo"}`} />
            ))}
          </Stat>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${
              me.skill.state === "READY" ? "border-moss/60 text-moss" : me.skill.state === "LOCKED" ? "border-ash text-ash" : "border-ember/50 text-ember/80 line-through"
            }`}
            title={skill.description}
          >
            {skill.name} · {me.skill.state}
          </span>
          {me.helpBonus > 0 && <span className="rounded-full border border-signal/50 px-2 py-0.5 text-[10px] text-signal">+{me.helpBonus} next roll</span>}
          {me.shields > 0 && <span className="rounded-full border border-violet-soft/50 px-2 py-0.5 text-[10px] text-violet-soft">Shield ×{me.shields}</span>}
          {me.statuses.map((st) => (
            <span key={st.id} className={`rounded-full border px-2 py-0.5 text-[10px] ${st.polarity === "NEGATIVE" ? "border-ember/50 text-ember" : "border-gold/40 text-gold"}`}>
              {statusLabel(st.kind)}
              {st.hidden ? " (hidden)" : ""}
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
function Picker({ g, me, mode, availability, close }: { g: PlayerView; me: PublicPlayerState; mode: Exclude<Mode, null>; availability: ActionAvailability; close: () => void }) {
  const send = (action: GameAction) => {
    close();
    void sendGame(action);
  };
  const people = (ids: (string | number)[]) => ids.map(String).filter((id) => g.players[id]).map((id) => g.players[id]);
  let title = "";
  let body: React.ReactNode = null;

  if (mode === "MOVE") {
    title = "Move to which carriage? (or tap it on the train)";
    body = (
      <div className="flex gap-2">
        {(availability.targets ?? []).map((t) => (
          <button key={t} className="btn btn-ghost flex-1 text-sm" onClick={() => send({ type: "MOVE", toCarriage: Number(t) })}>
            {Number(t) < me.carriageIndex ? "← " : ""}
            {carriageName(g, Number(t))}
            {Number(t) > me.carriageIndex ? " →" : ""}
          </button>
        ))}
      </div>
    );
  } else if (mode === "HELP") {
    title = "Help whom? +1 to their next roll (+2 for your seat neighbour).";
    body = <PeopleRow people={people(availability.targets ?? [])} onPick={(id) => send({ type: "HELP", targetId: id })} />;
  } else if (mode === "CONFRONT") {
    title = "Confront what?";
    body = (
      <div className="flex flex-wrap gap-2">
        {(availability.targets ?? []).map((t) => (
          <button key={t} className="btn btn-ghost text-sm" onClick={() => send(t === "INSPECTOR" ? { type: "CONFRONT", target: "INSPECTOR" } : { type: "CONFRONT", target: "ENTITY", entityId: String(t) })}>
            {t === "INSPECTOR" ? "The Faceless Inspector" : g.entities.find((e) => e.id === t)?.kind === "ECHO" ? "Echo" : "Shadow passenger"}
          </button>
        ))}
      </div>
    );
  } else if (mode === "STABILIZE") {
    title = "Steady yourself (2 action points).";
    const negatives = me.statuses.filter((st) => st.polarity === "NEGATIVE" && st.ordinary);
    body = (
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost text-sm" disabled={me.sanity >= MAX_SANITY && !me.lost} onClick={() => send({ type: "STABILIZE", mode: "SANITY" })}>
          Recover 1 Sanity
        </button>
        {negatives.map((st) => (
          <button key={st.id} className="btn btn-ghost text-sm" onClick={() => send({ type: "STABILIZE", mode: "CLEANSE", statusId: st.id })}>
            Clear {statusLabel(st.kind)}
          </button>
        ))}
      </div>
    );
  } else if (mode === "USE_ITEM") {
    title = "Use which item? (free)";
    body = (
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {[...new Set(me.items)].map((item) => (
          <ItemButton key={item} item={item} count={me.items.filter((i) => i === item).length} g={g} me={me} onUse={(targetId) => send({ type: "USE_ITEM", item, targetId })} />
        ))}
      </div>
    );
  } else if (mode === "USE_SKILL") {
    body = <SkillPicker g={g} me={me} onUse={(targets) => send({ type: "USE_SKILL", targets })} />;
    title = "Use your ability? It burns after one use.";
  } else if (mode === "TRADE") {
    title = "Trade with someone in your carriage.";
    body = <TradeBuilder g={g} me={me} partners={people(availability.targets ?? [])} onSend={send} />;
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-[#0e1430]/90 p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm text-moon">{title}</p>
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-mist hover:text-moon" onClick={close} aria-label="Cancel">
          <Icon name="CLOSE" size={18} />
        </button>
      </div>
      {body}
    </div>
  );
}

const carriageName = (g: PlayerView, i: number) => {
  const c = g.carriages[i];
  return c ? ({ START: "Boarding", DINING: "Dining", LUGGAGE: "Luggage", MIRROR: "Mirror", ARCHIVE: "Archive", SLEEPER: "Sleeper", ENGINE_ROOM: "Engine", CAB: "Cab" } as const)[c.identity] : "?";
};

function PeopleRow({ people, onPick, selected = [] }: { people: PublicPlayerState[]; onPick: (id: string) => void; selected?: string[] }) {
  if (!people.length) return <p className="text-sm text-ash">Nobody is available.</p>;
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
  const info = ITEMS[item];
  const [choosing, setChoosing] = useState(false);
  const mates = Object.values(g.players).filter((p) => p.carriageIndex === me.carriageIndex && !p.away);
  if (choosing) return <PeopleRow people={mates} onPick={(id) => onUse(id)} />;
  return (
    <button className="flex min-h-12 items-start gap-2 rounded-lg border border-gold/30 bg-[#121a3a]/70 p-2 text-left hover:border-gold-bright" onClick={() => (info.needsTarget && mates.length > 1 ? setChoosing(true) : onUse())}>
      <Icon name="USE_ITEM" size={18} className="mt-0.5 shrink-0 text-gold" />
      <span>
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
  const skill = getCharacterById(me.skill.borrowed ?? me.characterId).skill;
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
        <span className="font-display text-lg text-gold-bright">{skill.name}</span> <span className="text-mist">{skill.description}</span>
      </p>
      {need > 0 && (
        <>
          <p className="mb-1 text-xs text-mist">{rule === "TWO_PLAYERS" ? "Choose two passengers." : rule === "UP_TO_THREE_PLAYERS" ? "Choose up to three passengers." : "Choose a passenger."}</p>
          <PeopleRow people={pool} selected={picked} onPick={toggle} />
          {need > 1 && picked.length > 1 && <p className="mt-1 text-xs text-mist">In this order: {picked.map((id) => g.players[id]?.nickname).join(", ")}</p>}
        </>
      )}
      <button className="btn btn-gold mt-2 w-full" disabled={!ready} onClick={() => onUse(picked)}>
        Burn it: use {skill.name}
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
  const them = partner ? g.players[partner] : null;
  const toggle = (list: number[], set: (v: number[]) => void, i: number) => set(list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);
  const empty = !give.length && !want.length && !giveFate && !wantFate;
  return (
    <div className="space-y-2">
      <PeopleRow people={partners} selected={partner ? [partner] : []} onPick={(id) => { setPartner(id); setWant([]); setWantFate(0); }} />
      {them && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <TradeSide title="You give" items={me.items} picked={give} onToggle={(i) => toggle(give, setGive, i)} fate={giveFate} maxFate={me.fate} setFate={setGiveFate} />
          <TradeSide title={`${them.nickname} gives`} items={them.items} picked={want} onToggle={(i) => toggle(want, setWant, i)} fate={wantFate} maxFate={them.fate} setFate={setWantFate} />
        </div>
      )}
      <button
        className="btn btn-gold w-full"
        disabled={!them || empty}
        onClick={() => them && onSend({ type: "TRADE", targetId: them.playerId, give: { items: give.map((i) => me.items[i]), fate: giveFate }, want: { items: want.map((i) => them.items[i]), fate: wantFate } })}
      >
        Offer trade (1 AP)
      </button>
    </div>
  );
}

function TradeSide({ title, items, picked, onToggle, fate, maxFate, setFate }: { title: string; items: ItemId[]; picked: number[]; onToggle: (i: number) => void; fate: number; maxFate: number; setFate: (n: number) => void }) {
  return (
    <div className="rounded-lg border border-indigo p-2">
      <p className="label mb-1 text-[10px]">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.length ? (
          items.map((item, i) => (
            <button key={i} onClick={() => onToggle(i)} aria-pressed={picked.includes(i)} className={`rounded-full border px-2 py-1 text-xs ${picked.includes(i) ? "border-signal text-signal" : "border-gold/30 text-mist"}`}>
              {ITEMS[item].name}
            </button>
          ))
        ) : (
          <span className="text-xs text-ash">No items</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-mist">Fate</span>
        <button className="h-12 w-12 rounded-full border border-gold/30" onClick={() => setFate(Math.max(0, fate - 1))} aria-label="Less Fate">−</button>
        <span className="font-mono">{fate}</span>
        <button className="h-12 w-12 rounded-full border border-gold/30" onClick={() => setFate(Math.min(maxFate, fate + 1))} aria-label="More Fate">+</button>
      </div>
    </div>
  );
}
