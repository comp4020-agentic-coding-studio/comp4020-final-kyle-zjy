// What each ending's scenes show. Composition and motion over the openings'
// own drawings (the carriage, the boat, the city's hexes, the 1996/2026 rooms,
// the auction table and gavel); every word is a catalog key. Only facts this
// viewer already has appear: their own name, the public boat list, their seat
// number and their own debt.
import type { CSSProperties, ReactNode } from "react";
import { ZONES } from "../../../shared/game/scenario02/map.ts";
import { useT } from "../../i18n/index.ts";
import { bounds, center, corners } from "../city/geometry.ts";
import { Icon } from "../Icon.tsx";
import { AuctionSetting, Gavel } from "../opening/AuctionOpening.tsx";
import { Boat } from "../opening/FloodOpening.tsx";
import { Carriage } from "../opening/TrainOpening.tsx";
import { RoomFeed } from "../scenario03/opening/OpeningScenes.tsx";
import type { EndingFacts, EndingId } from "./cinematics.ts";

type Props = { id: EndingId; scene: string; elapsed: number; facts: EndingFacts };
const at = (elapsed: number, from: number) => (elapsed >= from ? "is-on" : "");
const pct = (n: number) => ({ "--p": n } as CSSProperties);

/** A big station clock that turns over once, at `turn` seconds. */
function Clock({ from, to, elapsed, turn, sub }: { from: string; to: string; elapsed: number; turn: number; sub?: ReactNode }) {
  return <div className={`end-clock ${elapsed >= turn ? "is-turned" : ""}`}><strong aria-label={elapsed >= turn ? to : from}><span>{from}</span><span>{to}</span></strong>{sub}</div>;
}
function Stamp({ on, children, tone = "" }: { on: boolean; children: ReactNode; tone?: string }) {
  return <p className={`end-stamp ${tone} ${on ? "is-on" : ""}`}>{children}</p>;
}
function Figure({ className = "" }: { className?: string }) {
  return <svg className={`end-figure ${className}`} viewBox="0 0 60 120" aria-hidden="true"><circle cx="30" cy="16" r="11" /><path d="M14 36Q30 28 46 36L50 82H40L38 118H22L20 82H10Z" /></svg>;
}

function Train({ id, scene, elapsed, facts }: Props) {
  const t = useT();
  const ticket = id === "s01_ticket_true_end";
  switch (scene) {
    case "locks": return <div className="end-locks">{[0, 1, 2].map((i) => <div key={i} className={`end-lock ${at(elapsed, .8 + i * 1.4)}`}><span>{t("end.s1.lock", { n: `0${i + 1}` })}</span><b>{t("end.s1.connected")}</b></div>)}<p className={`end-route ${at(elapsed, 5)}`}>{t("end.s1.route")}</p></div>;
    case "slow": return <div className="end-tunnel" style={pct(Math.min(1, elapsed / 6))}><div className="end-tunnel-lights" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</div><Carriage /><p className={`end-platform-sign ${at(elapsed, 4)}`} aria-hidden="true">— — —</p></div>;
    case "clock": return <Clock from="00:17" to="00:18" elapsed={elapsed} turn={4} />;
    case "doors": return <div className="end-doors"><Carriage doors={elapsed > 3} /><p className="end-radio">{t("end.s1.announce")}</p><div className={`end-crowd ${at(elapsed, 4)}`}>{facts.names.map((n) => <span key={n}><Figure />{n}</span>)}</div></div>;
    case "lookback": return <div className={`end-lookback ${at(elapsed, 2)}`}><Carriage /><b className="end-n13">N13</b><Figure className="end-last" /></div>;
    case "ticket": return <div className="end-ticket-stage"><article className={`rail-paper end-blank-ticket ${at(elapsed, 1)}`}><div className="ticket-perforation" aria-hidden="true" /><p>{t("end.s1.passenger")}</p><span className="end-blank-line" aria-hidden="true" /><span>00:17 &nbsp; / &nbsp; N13</span></article></div>;
    case "figure": return <div className="end-nameless" style={pct(Math.min(1, elapsed / 6))}><Figure className="end-nameless-figure" /><p className="end-note">{t("end.s1.unregistered")}</p></div>;
    case "punch": return <div className="end-inspect"><div className="identity-file end-identity"><p className="end-mono">{t("identity.kicker")}</p><p className="end-nameless-name">— — — —</p><Stamp on={elapsed >= 4} tone="is-ok">{t("end.s1.verified")}</Stamp></div><Figure className="end-nameless-figure is-solid" /><article className={`rail-paper end-blank-ticket is-on ${elapsed >= 4 ? "is-punched" : ""}`}><p>{t("end.s1.passenger")}</p><div className="ticket-punches" aria-hidden="true">● ○ ○ ○ ○ ○</div></article></div>;
    case "exit": return <div className="end-doors"><Carriage doors /><div className="end-crowd is-on">{facts.names.map((n) => <span key={n}><Figure />{n}</span>)}<span className={`end-last-out ${at(elapsed, 3.5)}`}><Figure className="end-nameless-figure is-solid" /></span></div></div>;
    case "seat": return <div className={`end-empty-seat ${at(elapsed, 3)}`}><svg viewBox="0 0 300 200" aria-hidden="true"><path className="rail-window" d="M40 30H260V110H40Z" /><path className="end-seat" d="M95 120H205V170H95ZM95 120V60H115V120" /></svg><p className="end-note">{t(ticket ? "end.s1.seat" : "end.s1.route")}</p></div>;
    default: return null;
  }
}

/** The real city's hexes; `lit` decides which zones still have power. */
function City({ lit, water = 0 }: { lit: (i: number) => boolean; water?: number }) {
  return <svg className="end-city" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} aria-hidden="true">
    {ZONES.map((zone, i) => <polygon key={zone.id} points={corners(center(i).x, center(i).y, 26)} className={`end-zone ${lit(i) ? "is-lit" : ""} ${zone.elevation === "LOW" || (water > 1 && zone.elevation === "MEDIUM") ? "is-flooded" : ""}`} />)}
  </svg>;
}
const POWER = ZONES.findIndex((z) => z.facility === "POWER_STATION");
const HARBOUR = ZONES.findIndex((z) => z.facility === "HARBOUR");

function Flood({ scene, elapsed, facts }: Props) {
  const t = useT();
  switch (scene) {
    case "aboard": return <div className="end-boat-scene"><Boat /><ul className="end-aboard">{facts.aboard.map((n) => <li key={n} className={n === facts.me ? "is-me" : ""}><Figure />{n}</li>)}</ul></div>;
    case "pier": return <div className="end-boat-scene is-leaving" style={pct(Math.min(1, elapsed / 6))}><div className="end-skyline" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ height: `${30 + ((i * 37) % 50)}%` }} />)}</div><div className="end-water" aria-hidden="true" /><Boat /></div>;
    case "radio": return <div className="flood-broadcast end-radio-scene"><div className={`radio-wave ${elapsed > 3.5 ? "is-cut" : ""}`} aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} style={{ height: `${12 + (i * 17 % 45)}px` }} />)}</div><h2>{t(elapsed < 3.5 ? "end.s2.weak" : "end.s2.lost")}</h2></div>;
    case "city": return <div className="end-recede" style={pct(Math.min(1, elapsed / 5))}><City lit={() => false} water={2} /></div>;
    case "dawn": return <div className="end-dawn" style={pct(Math.min(1, elapsed / 4))}><div className="end-horizon" aria-hidden="true" /><Boat /></div>;
    case "stay": return <div className="end-console-scene"><p className="end-alert">{t("end.s2.startup")}</p><p className="end-note">{facts.me}</p></div>;
    case "dark": { const off = Math.floor(elapsed / .3); return <div className="end-blackout"><City lit={(i) => i === POWER || (i * 7) % ZONES.length > off} /></div>; }
    case "console": return <div className="end-console-scene"><div className={`end-switch ${elapsed >= 3 ? "is-on" : ""}`}><span>{t("end.s2.off")}</span><span>{t("end.s2.on")}</span></div><p className="end-note">{t("end.s2.generator")}</p></div>;
    case "harbour": return <div className="end-blackout"><City lit={(i) => i === POWER || (i === HARBOUR && elapsed > 1)} /><div className={`end-boat-far ${at(elapsed, 2)}`}><Boat /></div></div>;
    case "water": return <div className="end-station-flood"><div className="end-water is-rising" style={pct(Math.min(1, elapsed / 5))} aria-hidden="true" /><p className="end-alert is-warning">{t("end.s2.warning")}</p></div>;
    case "light": return <div className="end-blackout"><City lit={(i) => i === POWER && elapsed < 4.5} /></div>;
    case "silence": return <div className="end-black" />;
    case "arrive": return <div className="end-boat-scene is-far"><div className="end-water" aria-hidden="true" /><Boat /><Figure className="end-shore-figure" /></div>;
    case "closed": return <div className="end-console-scene"><p className="end-alert">{t("end.s2.closed")}</p></div>;
    case "boat": return <div className="end-boat-scene is-leaving is-far" style={pct(Math.min(1, elapsed / 6))}><div className="end-water" aria-hidden="true" /><Boat /></div>;
    case "back": return <div className="end-recede is-near"><City lit={() => false} water={2} /><Figure className="end-shore-figure" /></div>;
    default: return null;
  }
}

function Temporal({ scene, elapsed }: Props) {
  const t = useT();
  switch (scene) {
    case "dual": return <div className={`end-dual ${elapsed > 4 ? "is-aligned" : ""}`}><div className="end-era is-past"><p className="end-mono">1996</p><RoomFeed past /></div><div className="end-era"><p className="end-mono">2026</p><RoomFeed /></div></div>;
    case "archive": return <article className="s3-film-dossier end-record"><div className="s3-film-file-header"><span>{t("end.s3.record")}</span><span>1996</span></div><p className={`end-redacted ${elapsed > 3 ? "is-restored" : ""}`} aria-hidden="true">████ ███ ██████ ████</p><Stamp on={elapsed > 5} tone="is-ok">{t("end.s3.consistent")}</Stamp></article>;
    case "accident": return <div className="end-era is-past end-solo"><p className="end-mono">1996 · {t("end.s3.official")}</p><RoomFeed past room="PROTOTYPE_ROOM" /></div>;
    case "bureau": return <div className="end-era end-solo is-steady"><p className="end-mono">2026</p><RoomFeed /></div>;
    case "clock": return <Clock from="23:47" to="23:48" elapsed={elapsed} turn={3} />;
    case "core": return <div className="end-era is-past end-solo end-core-stop" style={pct(Math.min(1, elapsed / 6))}><RoomFeed past room="PROTOTYPE_ROOM" /></div>;
    case "records": return <article className="s3-film-dossier end-record end-fading" style={pct(Math.min(1, elapsed / 7))}><div className="s3-film-file-header"><span>{t("end.s3.record")}</span><span>1996</span></div>{[0, 1, 2, 3].map((i) => <p key={i} className="end-line" style={{ "--i": i } as CSSProperties}>{t(`end.s3.line${i}` as "end.s3.line0")}</p>)}</article>;
    case "dissolve": return <div className="end-era end-solo end-dissolve" style={pct(Math.min(1, elapsed / 7))}><p className="end-mono">2026</p><RoomFeed /><p className="end-note">{t("end.s3.unwritten")}</p></div>;
    case "white": return <div className="end-white" style={pct(Math.min(1, elapsed / 3))}><p className="end-mono">{t("end.s3.nosignal")}</p></div>;
    case "alarm": return <div className="end-era is-past end-solo is-alarm"><p className="end-mono">1996 · {t("end.s3.alarm")}</p><RoomFeed past room="PROTOTYPE_ROOM" /></div>;
    case "montage": return <ul className="end-montage">{(["staff", "ji", "hidden", "record"] as const).map((k, i) => <li key={k} className={at(elapsed, 1.5 + i * 2)}><Icon name="REGISTER" size={18} />{t(`end.s3.fact.${k}`)}</li>)}</ul>;
    case "check": return <article className="s3-film-dossier end-record"><div className="s3-film-file-header"><span>{t("end.s3.check")}</span><span>2026</span></div><p className="end-mono">{t("end.s3.scanning")}</p><Stamp on={elapsed > 5} tone="is-ok">{t("end.s3.history")}</Stamp></article>;
    case "hidden": return <div className={`end-hidden ${at(elapsed, 6)}`}><RoomFeed past room="PROTOTYPE_ROOM" /><p className="end-note">{t("end.s3.sealed")}</p></div>;
    default: return null;
  }
}

function Auction({ id, scene, elapsed, facts }: Props) {
  const t = useT();
  switch (scene) {
    case "table": return <div className="end-hall" style={pct(Math.min(1, elapsed / 6))}><AuctionSetting /><div className="end-exit-card"><Icon name="S4_EXIT" size={40} /><p>{t("end.s4.exit")}</p></div></div>;
    case "gavel": return <div className="end-gavel-scene"><Gavel /><div className={`auction-metal-door end-door ${elapsed > (id === "s04_debt_follows" ? 2.5 : 3) ? "is-open" : ""}`} aria-hidden="true"><i /></div></div>;
    case "stairs": return <div className="end-stairs" style={pct(Math.min(1, elapsed / 6))}><div className="auction-stairs" aria-hidden="true" /><Figure className="end-climber" /></div>;
    case "door": return <div className={`end-street ${at(elapsed, 3)}`}><div className="end-street-lights" aria-hidden="true"><i /><i /><i /></div><div className="end-exit-card is-small"><Icon name="S4_EXIT" size={28} /></div></div>;
    case "paper": return <div className="end-stairs is-stopped"><div className="auction-stairs" aria-hidden="true" /><Figure className="end-climber" /><span className={`end-slip ${at(elapsed, 1)}`} aria-hidden="true" /></div>;
    case "figure": return <div className="end-suit"><div className="s4-debt-figure end-suit-figure" aria-hidden="true"><Figure /></div><p className="end-note">{t("s4.ending.debt.figure")}</p></div>;
    case "ledger": return <article className="end-ledger"><p className="end-mono">{t("end.s4.ledger")}</p><p className="end-ledger-row"><span>{t("end.s4.balance")}</span><b>{facts.debt > 0 ? facts.debt : "—"}</b></p><Stamp on={elapsed > 5} tone="is-due">{t("end.s4.payable")}</Stamp></article>;
    case "street": return <div className="end-street is-on"><div className="end-street-lights" aria-hidden="true"><i /><i /><i /></div><div className={`end-invite ${at(elapsed, 4)}`} aria-hidden="true" /></div>;
    case "leave": return <div className="end-hall"><AuctionSetting /><div className={`auction-metal-door end-door ${elapsed > 1 && elapsed < 4.5 ? "is-open" : ""}`} aria-hidden="true"><i /></div><p className="end-note">{t("end.s4.someone")}</p></div>;
    case "dim": return <div className="end-hall is-dim" style={pct(Math.min(1, elapsed / 5))}><AuctionSetting /></div>;
    case "reset": return <div className="end-hall is-dim is-reset"><AuctionSetting /><div className="end-reset" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={at(elapsed, 1 + i)} />)}</div></div>;
    case "bidder": return <div className="end-bidder"><p className="end-mono">{t("end.s4.bidder")}</p><strong>{String(facts.seat).padStart(2, "0")}</strong></div>;
    case "lot": case "again": return <div className="end-new-lot"><div className="end-lot-back" aria-hidden="true"><Icon name="USE_LOT" size={42} /></div><Gavel /></div>;
    default: return null;
  }
}

export function EndingScenes(props: Props) {
  return props.id.startsWith("s01") ? <Train {...props} /> : props.id.startsWith("s02") ? <Flood {...props} /> : props.id.startsWith("s03") ? <Temporal {...props} /> : <Auction {...props} />;
}
