import { useEffect, useRef, useState } from "react";
import type { ToolboxView, ToolAction, Poker } from "../../shared/toolbox/types.ts";
import { T } from "../../shared/toolbox/text.ts";
import { session } from "../net/session.ts";
import { api } from "../net/api.ts";
import { navigate } from "../router.ts";
import { connectRoom, disconnectRoom } from "../store.ts";
import "./toolbox.css";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function diceCounts(values: number[]): string {
  return [1, 2, 3, 4, 5, 6].flatMap(face => {
    const count = values.filter(value => value === face).length;
    return count ? [T.diceCount.replace("{count}", String(count)).replace("{face}", DICE_FACES[face - 1])] : [];
  }).join(T.diceSeparator);
}

const errorText = (e: unknown) => e instanceof Error && Object.values(T).includes(e.message as never) ? e.message : T.network;

export default function ToolboxScreen({ code }: { code: string }) {
  const [view, setView] = useState<ToolboxView | null>(null);
  const [error, setError] = useState(""); const [join, setJoin] = useState(false);
  const [nickname, setNickname] = useState(session.nickname());
  const [busy, setBusy] = useState(false); const inflight = useRef(false); const acting = useRef(false);
  const [config, setConfig] = useState(false); const [amount, setAmount] = useState(0);
  const [rolling, setRolling] = useState(false); const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  async function fetchView(action?: ToolAction) {
    const response = await fetch(`/api/tools/${code}${action ? "/action" : ""}`, { method: action ? "POST" : "GET", headers: { Authorization: `Bearer ${session.token() ?? ""}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000), body: action ? JSON.stringify({ version: view?.version, requestId: crypto.randomUUID(), action }) : undefined });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401 || response.status === 403) setJoin(true); throw new Error(data.message ?? T.network); }
    if (alive.current) { setView(data); setJoin(false); }
  }
  useEffect(() => {
    alive.current = true; const abort = new AbortController();
    const poll = async () => {
      if (inflight.current || abort.signal.aborted) return;
      inflight.current = true;
      try {
        const r = await fetch(`/api/tools/${code}`, { headers: { Authorization: `Bearer ${session.token() ?? ""}` }, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(6000)]) });
        const data = await r.json(); if (abort.signal.aborted) return;
        if (!r.ok) { if ([401, 403, 404].includes(r.status)) setJoin(true); throw new Error(data.message ?? T.network); }
        setView(data); setError("");
      } catch (e) { if (!abort.signal.aborted) setError(errorText(e)); }
      finally { inflight.current = false; }
    };
    void poll(); const timer = setInterval(() => void poll(), 1000);
    return () => { alive.current = false; abort.abort(); clearInterval(timer); if (rollTimer.current) clearTimeout(rollTimer.current); };
  }, [code]);
  async function act(action: ToolAction) {
    if (acting.current) return;
    acting.current = true; setBusy(true);
    while (inflight.current && alive.current) await new Promise(resolve => setTimeout(resolve, 25));
    if (!alive.current) { acting.current = false; return; }
    inflight.current = true; setError("");
    if (action.type === "ROLL") setRolling(true);
    try { await fetchView(action); if (action.type === "RAISE") setAmount(0); if (action.type === "CONFIG") setConfig(false); }
    catch (e) { if (alive.current) setError(errorText(e)); }
    finally {
      inflight.current = false; acting.current = false;
      if (alive.current) { setBusy(false); if (action.type === "ROLL") rollTimer.current = setTimeout(() => setRolling(false), 550); }
    }
  }
  useEffect(() => { if (!view?.viewer) return; connectRoom(code); return () => disconnectRoom(); }, [code, view?.viewer]);
  const name = (id: string | null) => view?.members.find(m => m.playerId === id)?.nickname ?? "—";
  const host = view?.members.some(m => m.playerId === view.viewer && m.isHost) ?? false;
  const p = view?.poker; const mine = p?.seats.find(s => s.id === view?.viewer);
  const turn = p?.stage === "betting" && p.actor === view?.viewer;
  const owe = Math.max(0, (p?.price ?? 0) - (mine?.bet ?? 0));
  const raised = view?.poker.raised?.includes(view.viewer) ?? false;
  const minimum = (p?.price ?? 0) + (p?.raise ?? 0);
  useEffect(() => setAmount(0), [p?.hand, p?.street, p?.actor]);
  return <main className="toolbox" lang="zh-CN">
    <header className="tool-header"><div><small>{T.room} {code}</small><h1>{T.title}</h1></div><button onClick={() => navigate(`/room/${code}`)}>{T.back}</button></header>
    {error && <p className="tool-error" role="alert">{error}</p>}
    {join ? <form className="tool-panel" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await api.joinRoom(code, nickname); session.setNickname(nickname); await fetchView(); setError(""); } catch { setError(T.network); } finally { setBusy(false); } }}><label>{T.nickname}<input value={nickname} maxLength={16} required onChange={e => setNickname(e.target.value)} /></label><button disabled={busy}>{T.join}</button></form> : !view ? <p>{T.connecting}</p> : <>
      <nav className="tool-tabs" aria-label={T.title}>{(["chips", "dice"] as const).map(tool => <button key={tool} aria-pressed={view.tool === tool} disabled={busy || (!host && view.tool !== tool)} onClick={() => { if (tool !== view.tool && confirm(T.switchConfirm)) void act({ type: "SWITCH", tool }); }}>{T[tool]}</button>)}</nav>
      <p className="tool-note">{host ? T.intro : T.hostHint}</p>
      {view.tool === "dice" ? <section className="tool-panel tool-dice-panel"><h2>{T.dice}</h2><p className="tool-note">{T.private}</p>
        <div className={`tool-dice ${rolling ? "is-rolling" : ""}`} aria-live="polite" aria-label={T.dice}>
          {Array.from({ length: 5 }, (_, i) => <div className="tool-die" key={i} aria-label={`${T.diceLabel}${i + 1}：${view.mine[0]?.values[i] ?? "—"}`}><span aria-hidden="true">{view.mine[0] ? DICE_FACES[view.mine[0].values[i] - 1] : "?"}</span><small>{view.mine[0]?.values[i] ?? "—"}</small></div>)}
        </div>
        <p className="tool-dice-counts">{view.mine[0] ? diceCounts(view.mine[0].values) : T.noRoll}</p>
        <button className="tool-primary tool-roll" disabled={busy || rolling} onClick={() => void act({ type: "ROLL" })}>{rolling ? T.rolling : T.roll}</button>
        {view.mine.length > 1 && <details><summary>{T.history}</summary>{view.mine.slice(1).map((r, i) => <p key={i} className="tool-history">{diceCounts(r.values)}</p>)}</details>}
      </section> : p && <>
        <section className="tool-panel tool-pot"><small>{T.hand} {p.hand} · {T.streets[p.street]}</small><strong>{T.pot} {p.stage === "settlement" || p.stage === "waiting" ? p.pots.filter(x => !x.winners.length).reduce((n, x) => n + x.amount, 0) : p.seats.reduce((n, s) => n + s.total, 0)}</strong><span>{p.stage === "betting" ? `${name(p.actor)} · ${T.thinking}` : T[p.stage]}</span><small>{T.price} {p.price}</small></section>
        <ol className="tool-seats">{p.seats.map(s => <li key={s.id} className={s.id === p.actor ? "is-actor" : s.folded ? "is-folded" : ""}><div><b>{name(s.id)}</b><small>{s.id === view.viewer ? T.me : ""} {s.id === p.dealer ? T.dealer : ""}</small></div><strong>{s.stack}</strong><small>{T.bet} {s.bet} · {T.total} {s.total}</small>{!!p.rebuys?.[s.id] && <small className="block">{T.rebuyTotal} {p.rebuys[s.id]}</small>}<span>{s.folded ? T.folded : s.stack === 0 ? T.allInState : s.id === p.actor ? T.thinking : ""}</span></li>)}</ol>
        {p.pots.length > 0 && <div className="tool-pots">{p.pots.map((pot, index) => <PotPanel key={`${p.hand}-${index}`} p={p} index={index} host={host} name={name} busy={busy} award={winners => act({ type: "AWARD", pot: index, winners })} />)}</div>}
        {host && <section className="tool-panel tool-host">
          {p.stage === "waiting" && p.seats.filter(s => s.stack > 0).length >= 2 && <button className="tool-primary" disabled={busy} onClick={() => void act({ type: "START" })}>{T.start}</button>}
          {p.stage === "between" && <button className="tool-primary" disabled={busy} onClick={() => void act({ type: "NEXT" })}>{T.next}</button>}
          <label className="tool-choice"><input type="checkbox" checked={!!p.allowRebuy} disabled={busy} onChange={e => void act({ type: "SET_REBUY", allowed: e.target.checked })} />{T.allowRebuy}</label>
          <button disabled={busy} onClick={() => setConfig(!config)}>{p.seats.length ? T.reset : T.config}</button>
        </section>}
        {mine && <section className="tool-panel tool-host"><p className="tool-note">{!p.allowRebuy ? T.rebuyClosed : p.stage !== "waiting" ? T.rebuyBetween : `${T.rebuy} +${p.buyIn}`}</p><button disabled={busy || !p.allowRebuy || p.stage !== "waiting" || mine.stack + p.buyIn > 10_000_000} onClick={() => { if (confirm(T.rebuyConfirm)) void act({ type: "REBUY" }); }}>{T.rebuy} +{p.buyIn}</button></section>}
        {host && (config || !p.seats.length) && <Config view={view} busy={busy} save={a => { if (!p.seats.length || confirm(T.resetConfirm)) void act(a); }} />}
        {p.log.length > 0 && <details className="tool-panel"><summary>{T.logs}</summary>{p.log.slice(-12).reverse().map((line, i) => { const [id, type, bet] = line.split("|"); const label = ({ FOLD: T.fold, CHECK: T.check, CALL: T.call, RAISE: T.raise, ALL_IN: T.allIn } as Record<string, string>)[type]; return <p className="tool-history" key={i}>{name(id)} · {label} · {bet}</p>; })}</details>}
        <p className="tool-note">{T.noCards} {T.raiseRule}</p>
        {turn && mine && <section className="tool-actions" aria-label={T.thinking}><div className="tool-action-title"><strong>{T.me} · {T.thinking}</strong><span>{T.owe} {Math.min(owe, mine.stack)}</span></div><div className="tool-action-grid">
          <button disabled={busy} onClick={() => { if (confirm(T.fold + "？")) void act({ type: "FOLD" }); }}>{T.fold}</button>
          <button className="tool-primary" disabled={busy} onClick={() => void act({ type: owe ? "CALL" : "CHECK" })}>{owe ? `${T.call} ${Math.min(owe, mine.stack)}` : T.check}</button>
          <button disabled={busy || (raised && mine.bet + mine.stack > p.price)} onClick={() => { if (confirm(T.allIn + ` ${mine.stack}？`)) void act({ type: "ALL_IN" }); }}>{T.allIn}</button>
        </div><form onSubmit={e => { e.preventDefault(); if (!raised && amount >= minimum && amount <= mine.bet + mine.stack) void act({ type: "RAISE", to: amount }); }}>
          <div className="tool-bet-total"><span>{T.to}</span><output aria-label={T.to} aria-live="polite">{amount}</output></div>
          <button className="tool-primary" disabled={busy || raised || amount < minimum || amount > mine.bet + mine.stack}>{T.raise}</button>
          <div className="tool-chip-row" role="group" aria-label={T.addChips}>{[5, 10, 20, 50, 100].map(value => <button type="button" key={value} className={`tool-chip tool-chip-${value}`} aria-label={`${T.addChips} ${value}`} disabled={busy || raised || amount + value > mine.bet + mine.stack} onClick={() => setAmount(current => current + value)}>{value}</button>)}</div>
          <div className="tool-bet-hint"><small>{raised ? T.raiseUsed : `${T.minRaise} ${minimum}`}</small><button type="button" disabled={busy || amount === 0} onClick={() => setAmount(0)}>{T.clearChips}</button></div>
        </form></section>}
      </>}
    </>}
  </main>;
}
function Config({ view, busy, save }: { view: ToolboxView; busy: boolean; save: (a: ToolAction) => void }) {
  const [buyIn, setBuyIn] = useState(view.poker.buyIn); const [small, setSmall] = useState(view.poker.small); const [big, setBig] = useState(view.poker.big);
  const [ids, setIds] = useState<string[]>(view.members.map(m => m.playerId)); const [dealer, setDealer] = useState(view.members[0]?.playerId ?? "");
  return <form className="tool-panel tool-config" onSubmit={e => { e.preventDefault(); save({ type: "CONFIG", buyIn, small, big, ids, dealer }); }}><h2>{T.config}</h2>
    {([[T.buyIn, buyIn, setBuyIn], [T.small, small, setSmall], [T.big, big, setBig]] as const).map(([label, value, set]) => <label key={label}>{label}<input type="number" inputMode="numeric" required min={1} max={1000000} value={value} onChange={e => set(Number(e.target.value))} /></label>)}
    <fieldset><legend>{T.players}</legend>{view.members.map(m => <label className="tool-choice" key={m.playerId}><input type="checkbox" checked={ids.includes(m.playerId)} onChange={e => setIds(e.target.checked ? view.members.filter(x => ids.includes(x.playerId) || x.playerId === m.playerId).map(x => x.playerId) : ids.filter(id => id !== m.playerId))} />{m.nickname}</label>)}</fieldset>
    <label>{T.dealer}<select value={dealer} onChange={e => setDealer(e.target.value)}>{view.members.filter(m => ids.includes(m.playerId)).map(m => <option key={m.playerId} value={m.playerId}>{m.nickname}</option>)}</select></label><button className="tool-primary" disabled={busy || ids.length < 2 || !ids.includes(dealer)}>{T.save}</button>
  </form>;
}
function PotPanel({ p, index, host, name, busy, award }: { p: Poker; index: number; host: boolean; name: (id: string) => string; busy: boolean; award: (ids: string[]) => Promise<void> }) {
  const pot = p.pots[index]; const [selected, setSelected] = useState<string[]>([]);
  return <section className="tool-panel"><h3>{index === 0 ? T.mainPot : `${T.sidePot} ${index}`} · {pot.amount}</h3>{pot.winners.length ? <p>{T.paid} · {pot.winners.map(name).join("、")}</p> : host ? <><p className="tool-note">{T.winners}</p>{pot.eligible.map(id => <label key={id} className="tool-choice"><input type="checkbox" checked={selected.includes(id)} onChange={e => setSelected(e.target.checked ? [...selected, id] : selected.filter(x => x !== id))} />{name(id)}</label>)}<button disabled={busy || !selected.length} onClick={() => { if (confirm(`${T.award}：${selected.map(name).join("、")}？`)) void award(selected); }}>{T.award}</button></> : <p>{T.settlement}</p>}</section>;
}
