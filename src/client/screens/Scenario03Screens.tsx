// Closed-lobby development screens for Scenario 03's causal foundation.
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ADJACENT03, OPENS_IN_ACT03, ROOM_IDS, placeKey03, type RoomId03, type Year03 } from "../../shared/game/scenario03/map.ts";
import { NODES03, NODE_IDS03 } from "../../shared/game/scenario03/nodes.ts";
import { NPCS03, type StoryBeatId03 } from "../../shared/game/scenario03/story.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { characterSkill } from "../../shared/game/skills.ts";
import { CueFeed } from "../game/CueFeed.tsx";
import { DecisionLayer } from "../game/Decision.tsx";
import { DiceOverlay } from "../game/Dice.tsx";
import { EventPanel } from "../game/EventPanel.tsx";
import { HostSkip } from "../game/HostSkip.tsx";
import { Icon } from "../game/Icon.tsx";
import { useCharacterText, useFormat, useItemText, useT } from "../i18n/index.ts";
import type { S3Key } from "../i18n/types.ts";
import { sendGame, sendLobby, useGame, useMe } from "../store.ts";
import "../styles/scenario03.css";

const POINT: Record<RoomId03, [number, number]> = {
  CENTRAL_HALL: [295, 145],
  ARCHIVES: [145, 90],
  DIRECTOR_OFFICE: [0, 20],
  SECRET_ARCHIVE: [0, 190],
  RESEARCH_WING: [440, 90],
  MAIN_LAB: [590, 0],
  PROTOTYPE_ROOM: [590, 105],
  POWER_ROOM: [590, 220],
};

const MOBILE_POINT: Record<RoomId03, [number, number]> = {
  CENTRAL_HALL: [50, 16],
  ARCHIVES: [25, 125],
  RESEARCH_WING: [75, 125],
  DIRECTOR_OFFICE: [25, 237],
  MAIN_LAB: [75, 237],
  SECRET_ARCHIVE: [25, 349],
  PROTOTYPE_ROOM: [75, 349],
  POWER_ROOM: [75, 461],
};

const yearKey = (year: Year03): "s3.year.Y1996" | "s3.year.Y2026" => year === "Y1996" ? "s3.year.Y1996" : "s3.year.Y2026";
const roomKey = (room: RoomId03) => `s3.room.${room}` as const;
const evidenceKey03 = (id: string): S3Key => ({
  ARCHIVIST_NOTE: "s3.npc.note",
  CASE_FILE_A: "s3.causal.evidenceA",
  CASE_FILE_B: "s3.causal.evidenceB",
  SURVEILLANCE_TAPE: "s3.intruders.tapeEvidence",
  ACCESS_LEDGER: "s3.intruders.ledgerEvidence",
  PROTOTYPE_LOG: "s3.intruders.prototypeEvidence",
  FOUNDING_CHARTER: "s3.paradox.charterEvidence",
  FOUNDER_DISCREPANCY: "s3.paradox.founderEvidence",
  STAFF_DISCREPANCY: "s3.paradox.staffEvidence",
  PROTOTYPE_DISCREPANCY: "s3.paradox.prototypeEvidence",
  JI_MARGIN_NOTE: "s3.paradox.jiEvidence",
  ZERO_TRANSCRIPT: "s3.paradox.zeroEvidence",
} as Record<string, S3Key>)[id] ?? "s3.causal.evidenceA";

function Frame({ children }: { children: React.ReactNode }) {
  return <main className="night-sky relative min-h-dvh px-3 py-5 text-moon sm:px-6"><div className="mx-auto max-w-5xl">{children}</div></main>;
}

export function Scenario03Intro() {
  const g = useGame();
  const t = useT();
  if (!g) return null;
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  return <Frame>
    <section className="tarot s3-scene-card mx-auto mt-10 max-w-xl p-6 text-center">
      <p className="label text-signal">{t("s3.development")}</p>
      <p className="s3-scene-clock" aria-hidden="true">23:47</p>
      <h1 className="mt-4 font-display text-4xl text-gold-bright">{t("s3.title")}</h1>
      <p className="mt-3 text-mist italic">{t("s3.subtitle")}</p>
      <p className="mt-8 text-lg">{t("s3.intro")}</p>
      <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>
        {acked ? t("s3.waiting") : t("s3.begin")}
      </button>
    </section>
    <HostSkip g={g} />
  </Frame>;
}

function Map03({ g, year, ripple }: { g: PlayerView; year: Year03; ripple: boolean }) {
  const t = useT();
  const current = g.temporal!.locations[g.viewerId];
  const move = g.myActions.find((a) => a.type === "MOVE");
  const targets = new Set(move?.enabled ? move.targets?.map(Number) : []);
  const edges = ROOM_IDS.flatMap((room) => ADJACENT03[room]
    .filter((next) => ROOM_IDS.indexOf(room) < ROOM_IDS.indexOf(next))
    .map((next) => [room, next] as const));
  return <section aria-label={t("s3.map")} className={`s3-map-shell ${year === "Y1996" ? "s3-past" : "s3-present"} ${ripple ? "s3-map-rewritten" : ""}`}>
    <div className="s3-map-grid">
      <svg className="s3-map-lines-desktop" viewBox="0 0 720 360" aria-hidden="true">
        {edges.map(([a, b]) => <line key={`${a}-${b}`} x1={POINT[a][0] + 65} y1={POINT[a][1] + 31} x2={POINT[b][0] + 65} y2={POINT[b][1] + 31} />)}
      </svg>
      <svg className="s3-map-lines-mobile" viewBox="0 0 300 550" preserveAspectRatio="none" aria-hidden="true">
        <path d="M150 56 L75 165 M150 56 L225 165 M75 165 L75 277 M75 165 L75 389 M225 165 L225 277 M225 165 L225 389 M225 165 L225 501" />
      </svg>
      {ROOM_IDS.map((room) => {
        const [x, y] = POINT[room];
        const [mobileX, mobileY] = MOBILE_POINT[room];
        const here = current.roomId === room && current.year === year;
        const erased = room === "POWER_ROOM" && year === "Y2026" && !g.temporal!.present.powerRoomExists;
        const open = !erased && (g.act >= OPENS_IN_ACT03[room] || (room === "SECRET_ARCHIVE" && year === "Y2026" && g.temporal!.present.secretArchiveOpen));
        const target = targets.has(placeKey03(room, year)) && current.year === year;
        const people = g.turnOrder.map((id) => g.players[id]).filter((p) => g.temporal!.locations[p.playerId]?.roomId === room && g.temporal!.locations[p.playerId]?.year === year);
        const label = t(roomKey(room));
        const marker = room === "RESEARCH_WING" && year === "Y2026" && g.temporal!.present.researchFacility === "TEMPORAL_CONTAINMENT" ? t("s3.map.containment") : room === "SECRET_ARCHIVE" && year === "Y2026" && g.temporal!.present.secretArchiveOpen ? t("s3.map.rewritten") : room === "POWER_ROOM" && erased ? t("s3.map.erased") : room === "ARCHIVES" && year === "Y1996" ? t("s3.map.archivist") : room === "CENTRAL_HALL" && year === "Y2026" && g.act >= 3 ? t("s3.map.zero") : null;
        const content = <>
          <span className="s3-room-heading"><span className="s3-room-title">{label}</span>{here && <span className="s3-room-here">{t("s3.map.here")}</span>}</span>
          <span className="s3-room-subtitle">{erased ? t("s3.map.erased") : !open ? t("s3.map.locked", { act: OPENS_IN_ACT03[room] }) : marker ?? (people.length ? t("s3.map.occupied", { n: people.length }) : t("s3.map.empty"))}</span>
          {people.length > 0 && <span className="s3-room-players" aria-label={people.map((person) => person.nickname).join(", ")}>{people.slice(0, 3).map((person) => <span key={person.playerId} className={`s3-player-dot ${person.playerId === g.viewerId ? "s3-player-me" : ""}`} title={person.nickname}>{person.nickname.slice(0, 1)}</span>)}{people.length > 3 && <span className="s3-player-extra">+{people.length - 3}</span>}</span>}
        </>;
        const cls = `s3-room-node ${here ? "s3-room-current" : target ? "s3-room-target" : open ? "s3-room-open" : "s3-room-locked"}`;
        const style = { "--s3-x": `${x}px`, "--s3-y": `${y}px`, "--s3-mobile-x": `${mobileX}%`, "--s3-mobile-y": `${mobileY}px` } as React.CSSProperties;
        return target
          ? <button key={room} className={cls} style={style} aria-label={t("s3.map.move", { room: label })} onClick={() => void sendGame({ type: "MOVE", toCarriage: placeKey03(room, year) })}>{content}</button>
          : <div key={room} className={cls} style={style}>{content}</div>;
      })}
    </div>
  </section>;
}

export function Scenario03Game() {
  const g = useGame();
  const t = useT();
  const fmt = useFormat();
  const itemText = useItemText();
  const charText = useCharacterText();
  const [viewYear, setViewYear] = useState<Year03>("Y2026");
  const [tradeTarget, setTradeTarget] = useState("");
  const [skillTargets, setSkillTargets] = useState<string[]>([]);
  const [ripple, setRipple] = useState(false);
  const priorRevision = useRef<number | null>(null);
  const current = g?.temporal?.locations[g.viewerId];
  useEffect(() => { if (current) setViewYear(current.year); }, [current?.year]);
  useEffect(() => {
    const revision = g?.temporal?.causalRevision;
    if (revision === undefined) return;
    if (priorRevision.current !== null && revision > priorRevision.current) {
      setRipple(true);
      const timer = setTimeout(() => setRipple(false), 1200);
      priorRevision.current = revision;
      return () => clearTimeout(timer);
    }
    priorRevision.current = revision;
  }, [g?.temporal?.causalRevision]);
  if (!g?.temporal || !current) return null;
  const me = g.players[g.viewerId];
  const jump = g.myActions.find((a) => a.type === "TIME_JUMP");
  const end = g.myActions.find((a) => a.type === "END_TURN");
  const investigate = g.myActions.find((a) => a.type === "INVESTIGATE");
  const resolveHistory = g.myActions.find((a) => a.type === "RESOLVE_HISTORY");
  const interactNpc = g.myActions.find((a) => a.type === "INTERACT_NPC");
  const intervene = g.myActions.find((a) => a.type === "INTERVENE");
  const pickup = g.myActions.find((a) => a.type === "PICK_UP");
  const store = g.myActions.find((a) => a.type === "STORE_ITEM");
  const trade = g.myActions.find((a) => a.type === "TRADE");
  const search = g.myActions.find((a) => a.type === "SEARCH");
  const useItem = g.myActions.find((a) => a.type === "USE_ITEM");
  const scan = g.myActions.find((a) => a.type === "SCAN");
  const help = g.myActions.find((a) => a.type === "HELP");
  const useSkill = g.myActions.find((a) => a.type === "USE_SKILL");
  const skillId = me.skill.borrowed ?? me.characterId;
  const skill = characterSkill(skillId, g.scenarioId);
  const skillWords = charText(skillId);
  const targetRule = skill.target;
  const chosenCount = targetRule === "TWO_PLAYERS" ? 2 : targetRule === "UP_TO_THREE_PLAYERS" ? 3 : ["ANY_PLAYER", "OTHER_PLAYER", "SAME_CARRIAGE"].includes(targetRule) ? 1 : 0;
  const legalPlayers = g.turnOrder.filter((id) => {
    const player = g.players[id];
    return !player.away && (targetRule !== "OTHER_PLAYER" && targetRule !== "SAME_CARRIAGE" || id !== g.viewerId) && (targetRule !== "SAME_CARRIAGE" || player.carriageIndex === me.carriageIndex);
  });
  const targetsReady = chosenCount === 0 || (targetRule === "UP_TO_THREE_PLAYERS" ? skillTargets.length >= 1 && skillTargets.length <= 3 : skillTargets.length === chosenCount);
  const myTurn = g.step === "PLAYER_TURNS" && g.turnOrder[g.activeIndex] === g.viewerId;
  const other: Year03 = current.year === "Y1996" ? "Y2026" : "Y1996";
  return <Frame>
    <header className="safe-top flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-gold/20 pb-3">
      <div className="min-w-0">
        <p className="label text-signal">{t("s3.development")}</p>
        <h1 className="truncate font-display text-2xl text-gold-bright">{t("s3.title")}</h1>
      </div>
      <div className="text-right font-mono text-sm">
        <p>{t(`s3.act.${g.act}`)} · {t("s3.round", { n: g.round })}</p>
        <p className="text-ember">{t("s3.collapse")} {g.collapse} / {g.collapseMax}</p>
      </div>
    </header>
    <p className="mt-3 text-sm text-moon">{t("s3.location", { room: t(roomKey(current.roomId)), year: t(yearKey(current.year)) })}</p>
    <EventPanel g={g} />
    <section className="s3-story mt-3 rounded-xl border border-gold/20 bg-deep/60 p-3" aria-label={t("s3.story.title")}>
      <h2 className="label text-gold">{t("s3.story.title")}</h2>
      <ol className="s3-story-list mt-2">{g.temporal.story.revealed.map((id: StoryBeatId03, index) => <li key={id} className={`s3-story-entry ${index === g.temporal!.story.revealed.length - 1 ? "s3-story-latest" : ""}`}><span className="s3-story-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>{t(`s3.story.${id}`)}</span></li>)}</ol>
    </section>
    {g.act >= 3 && <section className="mt-3 rounded-xl border border-signal/30 bg-deep/60 p-3" aria-label={t("s3.paradox.title")}>
      <h2 className="label text-signal">{t("s3.paradox.title")}</h2>
      <p className="mt-2 text-sm">{t(g.temporal.present.administrationIntegrity === "FADING" ? "s3.paradox.fading" : "s3.paradox.stable")}</p>
      <p className="mt-1 text-sm">{t(g.temporal.present.powerRoomExists ? "s3.paradox.powerHere" : "s3.paradox.powerGone")}</p>
      {g.temporal.discoveredFacts.length > 0 && <div className="mt-3"><h3 className="label text-gold">{t("s3.fact.title")}</h3><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{g.temporal.discoveredFacts.map((id) => <div key={id} className="min-w-0 rounded-lg border border-gold/20 p-2 text-sm"><p>{t(`s3.fact.${id}.official`)}</p><p className="mt-1 text-signal">{t(`s3.fact.${id}.observed`)}</p></div>)}</div></div>}
      <div className="mt-3"><h3 className="label text-gold">{t("s3.route.title")}</h3><ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">{g.temporal.story.availableRoutes.map((id) => <li key={id} className="min-w-0 rounded-lg border border-gold/20 p-2 text-sm">{t(`s3.route.${id}`)}</li>)}</ul></div>
      {current.year === "Y2026" && current.roomId === "CENTRAL_HALL" && <div className="mt-3 rounded-lg border border-gold/20 p-2"><p className="text-sm text-gold-bright">{t("s3.paradox.zero")}</p><button className="btn btn-ghost mt-2 w-full" disabled={!interactNpc?.enabled || !interactNpc.targets?.includes("ZERO")} onClick={() => void sendGame({ type: "INTERACT_NPC", npcId: "ZERO" })}>{t("s3.paradox.askZero")}</button></div>}
    </section>}
    {g.act >= 4 && <section className="mt-3 rounded-xl border border-gold/30 bg-deep/70 p-3" aria-label={t("s3.final.title")}>
      <h2 className="label text-gold-bright">{t("s3.final.title")}</h2>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
        <li>{t(`s3.final.record.${g.temporal.present.accidentRecord}`)}</li>
        <li>{t(g.temporal.present.staffEvacuated ? "s3.final.staffSafe" : "s3.final.staffUnsafe")}</li>
        <li>{t(g.temporal.present.jiStaged ? "s3.final.jiStaged" : "s3.final.jiExposed")}</li>
        <li>{t(g.temporal.present.prototypeHidden ? "s3.final.prototypeHidden" : "s3.final.prototypeExposed")}</li>
        <li>{t("s3.final.bootstrap", { n: g.temporal.bootstrapProgress.placed, total: g.temporal.bootstrapProgress.total })}</li>
      </ul>
      <p className="mt-3 text-sm text-mist">{t("s3.final.where")}</p>
      {current.year === "Y1996" && current.roomId === "ARCHIVES" && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{g.temporal.story.availableRoutes.map((route) => <button key={route} className="btn btn-gold min-w-0" disabled={!resolveHistory?.enabled || !resolveHistory.targets?.includes(route)} title={fmt(resolveHistory?.reason)} onClick={() => void sendGame({ type: "RESOLVE_HISTORY", route })}>{t("s3.final.commit")} · {t(`s3.route.${route}`)}</button>)}</div>}
      {current.year === "Y1996" && current.roomId === "ARCHIVES" && !resolveHistory?.enabled && <p className="mt-2 text-sm text-ember">{t("s3.final.unready")}</p>}
    </section>}
    <div className="s3-timeline-switch mt-3" aria-label={t("s3.timeline.title")}>
      <div className="s3-timeline-caption"><span>{t("s3.timeline.past")}</span><span>{t("s3.timeline.present")}</span></div>
      <div className="s3-timeline-axis" aria-hidden="true"><span /><span /></div>
      <div className="grid grid-cols-2 gap-2">
      {(["Y1996", "Y2026"] as const).map((year) => <button key={year} className={`btn min-w-0 ${year === viewYear ? "btn-gold" : "btn-ghost"}`} aria-pressed={year === viewYear} onClick={() => setViewYear(year)}>{t("s3.map.year", { year: t(`s3.year.short.${year}`) })}</button>)}
      </div>
    </div>
    <div className="mt-2"><Map03 g={g} year={viewYear} ripple={ripple} /></div>
    {g.act >= 2 && <section className="mt-3 rounded-xl border border-gold/20 bg-deep/60 p-3" aria-label={t("s3.intruders.title")}>
      <h2 className="label text-gold">{t("s3.intruders.title")}</h2>
      {current.roomId === "DIRECTOR_OFFICE" && <button className="btn btn-ghost mt-3 w-full" disabled={!investigate?.enabled} onClick={() => void sendGame({ type: "INVESTIGATE" })}>{t(current.year === "Y2026" ? g.act >= 3 && g.temporal.myEvidence.includes("SURVEILLANCE_TAPE") ? "s3.paradox.founder" : "s3.intruders.surveillance" : g.act >= 3 && g.temporal.myEvidence.includes("ACCESS_LEDGER") ? "s3.paradox.ji" : "s3.intruders.ledger")}</button>}
      {current.roomId === "MAIN_LAB" && current.year === "Y1996" && <button className="btn btn-ghost mt-3 w-full" disabled={!investigate?.enabled} onClick={() => void sendGame({ type: "INVESTIGATE" })}>{t("s3.intruders.prototype")}</button>}
      {g.act >= 3 && current.year === "Y2026" && current.roomId === "MAIN_LAB" && <button className="btn btn-ghost mt-3 w-full" disabled={!investigate?.enabled} onClick={() => void sendGame({ type: "INVESTIGATE" })}>{t("s3.paradox.staff")}</button>}
      {g.act >= 3 && current.year === "Y2026" && current.roomId === "PROTOTYPE_ROOM" && <button className="btn btn-ghost mt-3 w-full" disabled={!investigate?.enabled} onClick={() => void sendGame({ type: "INVESTIGATE" })}>{t("s3.paradox.prototype")}</button>}
      {g.temporal.surveillanceReviewed && <div className="mt-3 space-y-2">
        {g.temporal.surveillance.length === 0 && <p className="text-sm text-mist">{t("s3.intruders.noTrace")}</p>}
        {g.temporal.surveillance.map((trace) => <div key={trace.seq} className="rounded-lg border border-gold/20 p-2 text-sm">
          <p>{t(`s3.intruders.trace.${trace.kind}`, { signature: trace.signature, room: t(roomKey(trace.roomId)), round: trace.round })}</p>
          {trace.nodeId && trace.choiceId && <p className="mt-1 text-xs text-mist">{t("s3.intruders.detail.intervention", { node: t(`s3.node.${trace.nodeId}`), choice: t(`s3.choice.${trace.nodeId}.${trace.choiceId}` as S3Key) })}</p>}
          {trace.instanceId && <p className="mt-1 text-xs text-mist">{t("s3.intruders.detail.relic", { id: trace.instanceId })}</p>}
        </div>)}
      </div>}
      {g.temporal.story.revealed.includes("INTRUDERS_IDENTIFIED") && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{g.temporal.identityMatches.map((match) => <p key={match.signature} className="rounded-lg border border-signal/40 p-2 text-sm text-signal">{t("s3.intruders.match", { signature: match.signature, name: g.players[match.playerId].nickname })}</p>)}</div>}
    </section>}
    <section className={`mt-3 rounded-xl border p-3 transition-colors duration-700 ${ripple ? "border-signal bg-signal/20" : "border-gold/20 bg-deep/60"}`} aria-label={t("s3.causal.title")}>
      <p className="label text-gold">{t("s3.causal.title")} · {t("s3.causal.revision", { n: g.temporal.causalRevision })}</p>
      {g.temporal.interventions.length > 0 && <div className="s3-causal-history"><p className="label text-mist">{t("s3.causal.history")}</p><ol>{[...g.temporal.interventions].sort((a, b) => b.seq - a.seq).slice(0, 4).map((entry) => <li key={entry.seq}><span className="s3-causal-year">1996</span><span className="s3-causal-decision">{t(`s3.node.${entry.nodeId}`)} · {t(`s3.choice.${entry.nodeId}.${entry.choiceId}` as S3Key)}</span><span className="s3-causal-arrow" aria-hidden="true">→</span><span className="s3-causal-year">2026</span></li>)}</ol></div>}
      <p className="mt-1 text-sm">{t("s3.causal.case", { id: g.temporal.present.caseFile })}</p>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
        <li>{t(g.temporal.present.secretArchiveOpen ? "s3.causal.gateOpen" : "s3.causal.gateClosed")}</li>
        <li>{t(g.temporal.present.workerPresent ? "s3.causal.workerHere" : "s3.causal.workerAbsent")}</li>
        <li>{t(g.temporal.present.badgeCache ? "s3.causal.badgeHere" : "s3.causal.badgeAbsent")}</li>
        <li>{t(g.temporal.present.report === "CORRECTED" ? "s3.causal.reportCorrected" : "s3.causal.reportOfficial")}</li>
        {g.act >= 3 && <li>{t(g.temporal.present.administrationIntegrity === "FADING" ? "s3.causal.integrityFading" : "s3.causal.integrityStable")}</li>}
      </ul>
      {ripple && <p className="mt-2 text-sm text-signal" role="status">{t("s3.causal.ripple")}</p>}
      {current.year === "Y2026" && current.roomId === "ARCHIVES" && <button className="btn btn-ghost mt-3 w-full" disabled={!investigate?.enabled} title={fmt(investigate?.reason)} onClick={() => void sendGame({ type: "INVESTIGATE" })}>{t(g.act >= 3 && g.temporal.myEvidence.includes(g.temporal.present.caseFile === "A" ? "CASE_FILE_A" : "CASE_FILE_B") ? "s3.paradox.charter" : "s3.causal.investigate")}</button>}
      {current.year === NPCS03.ARCHIVIST_00.year && current.roomId === NPCS03.ARCHIVIST_00.roomId && <div className="mt-3 rounded-lg border border-gold/20 p-2"><p className="text-sm text-gold-bright">{t("s3.npc.ARCHIVIST_00")}</p><p className="mt-1 text-sm">{t("s3.npc.intro")}</p><button className="btn btn-ghost mt-2 w-full" disabled={!interactNpc?.enabled || !interactNpc.targets?.includes("ARCHIVIST_00")} onClick={() => void sendGame({ type: "INTERACT_NPC", npcId: "ARCHIVIST_00" })}>{t("s3.npc.ask")}</button></div>}
      {g.temporal.myEvidence.map((id) => <p key={id} className="mt-2 rounded-lg border border-gold/20 p-2 text-sm">{t(evidenceKey03(id))}</p>)}
      {current.year === "Y1996" && NODE_IDS03.filter((id) => NODES03[id].roomId === current.roomId && g.act >= NODES03[id].minAct).map((id) => {
        const done = g.temporal!.interventions.some((item) => item.nodeId === id);
        return <div key={id} className="mt-3 border-t border-gold/20 pt-3">
          <p className="text-sm">{t(`s3.node.${id}`)} · {done ? t("s3.causal.resolved") : t("s3.causal.unresolved")}</p>
          {!done && <div className="mt-2 grid grid-cols-2 gap-2">{NODES03[id].choices.map((choiceId) => <button key={choiceId} className="btn btn-ghost min-w-0" disabled={!intervene?.enabled || !intervene.targets?.includes(id)} onClick={() => void sendGame({ type: "INTERVENE", nodeId: id, choiceId })}>{t(`s3.choice.${id}.${choiceId}` as S3Key)}</button>)}</div>}
        </div>;
      })}
    </section>
    <section className="mt-3 rounded-xl border border-gold/20 bg-deep/60 p-3" aria-label={t("s3.items.title")}>
      <p className="label text-gold">{t("s3.items.title")}</p>
      {current.roomId === "RESEARCH_WING" && <p className="mt-1 text-sm text-mist">{t(current.year === "Y2026" && g.temporal.present.researchFacility === "TEMPORAL_CONTAINMENT" ? "s3.items.containment" : "s3.items.researchCabinet")}</p>}
      {current.year === "Y2026" && g.temporal.worldItems.filter((item) => item.roomId === current.roomId).map((item) => <div key={item.instanceId} className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/20 p-2">
        <div className="min-w-0"><p className="text-sm">{itemText(item.itemId).name} · {item.instanceId}</p><p className="text-xs text-mist">{t(item.storedBy ? "s3.items.sourced" : "s3.items.unsourced")}</p></div>
        <button className="btn btn-ghost shrink-0" disabled={!pickup?.enabled || !pickup.targets?.includes(item.instanceId)} onClick={() => void sendGame({ type: "PICK_UP", instanceId: item.instanceId })}>{t("s3.items.pickup")}</button>
      </div>)}
      {current.year === "Y2026" && current.roomId === "RESEARCH_WING" && <button className="btn btn-ghost mt-2 w-full" disabled={!search?.enabled} onClick={() => void sendGame({ type: "SEARCH" })}>{t("s3.items.search")}</button>}
      <p className="mt-3 text-sm text-gold-bright">{t("s3.items.held")}</p>
      {g.temporal.myItems.length === 0 && <p className="mt-1 text-sm text-mist">{t("s3.items.none")}</p>}
      {g.temporal.myItems.map((item) => <div key={item.instanceId} className="mt-2 min-w-0 rounded-lg border border-gold/20 p-2">
        <p className="text-sm">{itemText(item.itemId).name} · {item.instanceId}</p>
        <p className="text-xs text-mist">{t("s3.items.storageRoom", { room: t(roomKey(item.roomId)) })}</p>
        {current.year === "Y1996" && <button className="btn btn-ghost mt-2 w-full" disabled={!store?.enabled || !store.targets?.includes(item.instanceId)} onClick={() => void sendGame({ type: "STORE_ITEM", instanceId: item.instanceId })}>{t("s3.items.store")}</button>}
        {!!trade?.targets?.length && <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className="min-h-12 min-w-0 rounded-lg border border-gold/30 bg-night px-3 text-moon" aria-label={t("s3.items.tradeTarget")} value={tradeTarget} onChange={(event) => setTradeTarget(event.target.value)}>
            <option value="">{t("s3.items.tradeTarget")}</option>
            {trade.targets.map((id) => <option key={id} value={id}>{g.players[String(id)]?.nickname}</option>)}
          </select>
          <button className="btn btn-ghost min-w-0" disabled={!trade.enabled || !tradeTarget || !trade.targets.includes(tradeTarget)} onClick={() => void sendGame({ type: "TRADE", targetId: tradeTarget, give: { items: [], fate: 0, instances: [item.instanceId] }, want: { items: [], fate: 0 } })}>{t("s3.items.offer")}</button>
        </div>}
      </div>)}
      {g.temporal.myObligations.map((entry) => <p key={entry.instanceId} className="mt-2 text-xs text-mist">{entry.placedBy ? t("s3.items.obligationDone", { id: entry.instanceId }) : t("s3.items.obligation", { id: entry.instanceId, room: t(roomKey(entry.storageRoom)) })}</p>)}
      {me.items.map((item, index) => <div key={`${item}-${index}`} className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/20 p-2"><span className="text-sm">{itemText(item).name}</span><button className="btn btn-ghost" disabled={!useItem?.enabled || !useItem.targets?.includes(item)} onClick={() => void sendGame({ type: "USE_ITEM", item })}>{t("s3.items.use")}</button></div>)}
    </section>
    <section className="mt-3 rounded-xl border border-gold/20 bg-deep/60 p-3" aria-label={t("s3.team")}>
      <p className="label text-gold">{t("s3.team")}</p>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {g.turnOrder.map((id) => {
          const loc = g.temporal!.locations[id];
          return <li key={id} className="min-w-0 truncate">{t("s3.team.member", { name: g.players[id].nickname, room: t(roomKey(loc.roomId)), year: t(`s3.year.short.${loc.year}`) })}</li>;
        })}
      </ul>
    </section>
    <section className="mt-3 min-w-0 rounded-xl border border-violet/40 bg-deep/70 p-3" aria-label={t("s3.skill.title")}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet/50 text-signal"><Icon name={skill.vfx === "DICE" ? "DICE" : skill.vfx === "EYE" ? "SECRET" : skill.vfx === "SHIELD" ? "STABILIZE" : skill.vfx === "CHAIN" ? "HELP" : skill.vfx === "CLOCK" ? "END_TURN" : "USE_SKILL"} size={26} /></span>
        <div className="min-w-0"><h2 className="font-display text-xl text-gold-bright">{skillWords.skillName}</h2><p className="text-xs text-mist">{t(`s3.skill.type.${skill.type}`)} · {t("s3.skill.uses", { n: me.skill.usesLeft })}</p><p className="mt-1 text-sm">{skillWords.skillDescription}</p></div>
      </div>
      {skill.type === "ACTIVE" && chosenCount > 0 && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{legalPlayers.map((id) => <button key={id} className={`btn min-w-0 ${skillTargets.includes(id) ? "btn-gold" : "btn-ghost"}`} aria-pressed={skillTargets.includes(id)} onClick={() => setSkillTargets((prior) => prior.includes(id) ? prior.filter((x) => x !== id) : chosenCount === 1 ? [id] : [...prior, id].slice(0, chosenCount))}>{g.players[id].nickname}</button>)}</div>}
      {skill.type === "ACTIVE" && <button className="btn btn-gold mt-3 w-full" disabled={!useSkill?.enabled || !targetsReady} title={fmt(useSkill?.reason)} onClick={() => { void sendGame({ type: "USE_SKILL", targets: skillTargets }); setSkillTargets([]); }}>{t("s3.skill.use")}</button>}
    </section>
    <section className="safe-bottom sticky bottom-0 mt-3 grid grid-cols-2 gap-2 rounded-xl border border-gold/20 bg-void/95 p-3 backdrop-blur-md">
      <p className="col-span-2 font-mono text-sm">{t("s3.ap", { n: me.ap })} · {myTurn ? t("s3.location", { room: t(roomKey(current.roomId)), year: t(yearKey(current.year)) }) : t("s3.notYourTurn")}</p>
      <div className="col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-3">{(["ARCHIVE", "FIELD", "STABILIZE"] as const).map((protocol) => <button key={protocol} className="btn btn-ghost min-w-0" disabled={!scan?.enabled} title={fmt(scan?.reason)} onClick={() => void sendGame({ type: "SCAN", protocol })}>{t(`s3.scan.${protocol}`)}</button>)}</div>
      {!!help?.targets?.length && <div className="col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{help.targets.map((id) => <button key={id} className="btn btn-ghost min-w-0" disabled={!help.enabled} onClick={() => void sendGame({ type: "HELP", targetId: String(id) })}>{t("s3.help", { name: g.players[String(id)]?.nickname ?? "" })}</button>)}</div>}
      <button className="btn btn-gold min-w-0" disabled={!jump?.enabled} title={fmt(jump?.reason)} onClick={() => void sendGame({ type: "TIME_JUMP" })}>{t("s3.jump", { year: t(`s3.year.short.${other}`) })}</button>
      <button className="btn btn-ghost min-w-0" disabled={!end?.enabled} onClick={() => void sendGame({ type: "END_TURN" })}>{t("s3.endTurn")}</button>
    </section>
    <section className="mt-3 pb-4 text-xs text-mist" aria-label={t("s3.development")}>
      {g.log.slice(-3).map((line) => <p key={line.seq}>{fmt(line.msg)}</p>)}
    </section>
    <HostSkip g={g} />
    <CueFeed g={g} />
    <DiceOverlay g={g} />
    <DecisionLayer g={g} />
    {g.sequence?.kind === "S3_IDENTITY" && <IdentitySequence03 g={g} />}
    {g.sequence?.kind === "S3_THIRD_ROUTE" && <ThirdRouteSequence03 g={g} />}
  </Frame>;
}

function IdentitySequence03({ g }: { g: PlayerView }) {
  const t = useT();
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  return <motion.div className="s3-reveal s3-identity fixed inset-0 z-[60] overflow-y-auto bg-void px-4 py-6 text-moon" role="dialog" aria-modal="true" aria-label={t("s3.identity.title")} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="s3-reveal-content mx-auto flex min-h-full max-w-xl flex-col justify-center py-6 text-center">
      <p className="label text-signal">{t("s3.identity.kicker")}</p>
      <motion.h2 className="mt-4 font-display text-4xl leading-tight text-gold-bright" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>{t("s3.identity.title")}</motion.h2>
      <p className="mt-4 text-mist">{t("s3.identity.body")}</p>
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">{g.temporal!.identityMatches.map((match, index) => <motion.p key={match.signature} className="min-w-0 rounded-xl border border-signal/40 bg-signal/10 p-3 font-mono text-sm" initial={{ opacity: 0, filter: "blur(8px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ delay: 0.6 + index * 0.2 }}>{t("s3.intruders.match", { signature: match.signature, name: g.players[match.playerId].nickname })}</motion.p>)}</div>
      <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>{acked ? t("s3.waiting") : t("s3.identity.next")}</button>
    </div>
  </motion.div>;
}

function ThirdRouteSequence03({ g }: { g: PlayerView }) {
  const t = useT();
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  return <motion.div className="s3-reveal s3-third-route fixed inset-0 z-[60] overflow-y-auto bg-void px-4 py-6 text-moon" role="dialog" aria-modal="true" aria-label={t("s3.route.sceneTitle")} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="s3-reveal-content mx-auto flex min-h-full max-w-xl flex-col justify-center py-6 text-center">
      <p className="label text-signal">{t("s3.route.kicker")}</p>
      <motion.h2 className="mt-4 font-display text-4xl leading-tight text-gold-bright" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>{t("s3.route.sceneTitle")}</motion.h2>
      <p className="mt-4 text-mist">{t("s3.route.body")}</p>
      <ul className="mt-6 grid grid-cols-1 gap-2">{g.temporal!.story.availableRoutes.map((id) => <li key={id} className="rounded-xl border border-signal/40 bg-signal/10 p-3 text-sm">{t(`s3.route.${id}`)}</li>)}</ul>
      <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>{acked ? t("s3.waiting") : t("s3.route.next")}</button>
    </div>
  </motion.div>;
}

export function Scenario03Ending() {
  const g = useGame();
  const t = useT();
  if (!g) return null;
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  const ending = g.outcome === "S03_OFFICIAL_HISTORY" || g.outcome === "S03_NO_TOMORROW" || g.outcome === "S03_DECEIVE_HISTORY" ? g.outcome : "FAILED";
  return <Frame>
    <section className={`tarot s3-scene-card s3-ending-card s3-ending-${ending} mx-auto mt-16 max-w-xl p-6 text-center`}>
      <p className="label text-signal">{t("s3.development")}</p>
      <h1 className="mt-4 font-display text-4xl">{t(`s3.ending.${ending}.title`)}</h1>
      <p className="mt-4 text-mist">{t(`s3.ending.${ending}.body`)}</p>
      <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>{acked ? t("s3.waiting") : t("s3.results")}</button>
    </section>
    <HostSkip g={g} />
  </Frame>;
}

export function Scenario03Results() {
  const g = useGame();
  const t = useT();
  const fmt = useFormat();
  const me = useMe();
  if (!g?.temporal) return null;
  const ending = g.outcome === "S03_OFFICIAL_HISTORY" || g.outcome === "S03_NO_TOMORROW" || g.outcome === "S03_DECEIVE_HISTORY" ? g.outcome : "FAILED";
  return <Frame>
    <section className={`tarot s3-scene-card s3-ending-card s3-ending-${ending} mx-auto mt-16 max-w-xl p-6 text-center`}>
      <p className="label text-signal">{t("s3.development")}</p>
      <h1 className="mt-4 font-display text-4xl">{t("s3.results.title")}</h1>
      <p className="mt-4 text-xl text-gold-bright">{t(`s3.ending.${ending}.title`)}</p>
      <p className="mt-3 text-mist">{t(`s3.ending.${ending}.body`)}</p>
      <p className="mt-4 text-sm">{t("s3.results.relics", { n: g.temporal.bootstrapProgress.placed, total: g.temporal.bootstrapProgress.total })}</p>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{g.results?.map((result) => <div key={result.playerId} className="min-w-0 rounded-xl border border-gold/20 p-3 text-left text-sm"><p className="text-gold-bright">{t("s3.results.player", { name: g.players[result.playerId].nickname, title: fmt(result.title) })}</p>{result.highlights.map((line, index) => <p key={index} className="mt-1 text-mist">{fmt(line)}</p>)}</div>)}</div>
      {me?.isHost ? <button className="btn btn-gold mt-8 w-full" onClick={() => void sendLobby({ type: "RESTART" })}>{t("s3.results.back")}</button> : <p className="mt-8 text-sm text-mist">{t("s3.results.wait")}</p>}
    </section>
  </Frame>;
}
