// Scenario 03 on the city layout: its top bar (act, cycle, temporal collapse,
// the year you are in, the causal revision, relic sources), its objective
// line and its room panel. The shells are scenario 02's (RunTopBar,
// ObjectiveLine, PlacePanel); only the contents are this scenario's.
import { useState } from "react";
import { NODE_IDS03, NODES03 } from "../../../shared/game/scenario03/nodes.ts";
import { NPCS03 } from "../../../shared/game/scenario03/story.ts";
import type { EndingRoute03 } from "../../../shared/game/scenario03/story.ts";
import { ADJACENT03, OPENS_IN_ACT03, type RoomId03, type Year03 } from "../../../shared/game/scenario03/map.ts";
import { RELIC_STORAGE03 } from "../../../shared/game/scenario03/items.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useItemText, useT } from "../../i18n/index.ts";
import type { S3Key } from "../../i18n/types.ts";
import { PlacePanel, RunTopBar } from "../RunTopBar.tsx";
import { actSteps03, routeSteps03 } from "./clarity03.ts";
import { roomKey03, roomState03 } from "./Map03.tsx";

const chip = "rounded-full border px-1.5 py-0.5 text-[10px] font-bold tracking-wider";

export function TopBar03({ g, onLog, onSecrets, secretsCount }: { g: PlayerView; onLog: () => void; onSecrets: () => void; secretsCount: number }) {
  const t = useT();
  const tp = g.temporal!;
  const year = tp.locations[g.viewerId]?.year ?? "Y2026";
  return (
    <RunTopBar
      act={t("s3.top.act", { act: t(`s3.act.${Math.min(Math.max(g.act, 1), 4) as 1 | 2 | 3 | 4}`) })}
      round={t("s3.top.round", { n: Math.max(1, g.round) })}
      gauge={{ label: t("s3.top.collapse"), value: g.collapse, max: g.collapseMax, fill: (i) => (i >= 8 ? "bg-ember" : "bg-violet") }}
      onLog={onLog}
      onSecrets={onSecrets}
      secretsCount={secretsCount}
      logLabel={t("s3.top.log")}
    >
      <span className={`${chip} ${year === "Y1996" ? "border-gold/60 text-gold-bright" : "border-signal/60 text-signal"}`}>{t(`s3.year.short.${year}`)}</span>
      <span className="font-mono text-[10px] text-mist">{t("s3.causal.revision", { n: tp.causalRevision })}</span>
      {tp.bootstrapProgress.total > 0 && <span className="font-mono text-[10px] text-gold">{t("s3.top.sources", { n: tp.bootstrapProgress.placed, total: tp.bootstrapProgress.total })}</span>}
    </RunTopBar>
  );
}

export function Objective03({ g }: { g: PlayerView }) {
  const t = useT();
  const [selectedRoute, setSelectedRoute] = useState<EndingRoute03>("OFFICIAL_HISTORY");
  const routes = g.temporal!.story.availableRoutes;
  const route = routes.includes(selectedRoute) ? selectedRoute : routes[0];
  const steps = g.act === 4 && route ? routeSteps03(g, route) : actSteps03(g);
  const ready = steps.length > 0 && steps.every((step) => step.done);
  return <section className="mx-auto mt-1 w-full max-w-6xl px-3 text-xs sm:px-4" aria-label={t("s3.guide.title")}>
    <div className="rounded-lg border border-signal/20 bg-[#0b1028]/75 px-3 py-2">
      <p className="text-mist"><span className="label mr-2 text-[10px] text-signal">{t("s3.guide.title")}</span>{t(`s3.objective.${Math.min(Math.max(g.act, 1), 4) as 1 | 2 | 3 | 4}`)}</p>
      {g.act === 4 && <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("s3.guide.route.select")}>
        {routes.map((id) => <button key={id} type="button" className={`btn min-h-12 min-w-0 px-2 text-xs ${route === id ? "btn-signal" : "btn-ghost"}`} aria-pressed={route === id} onClick={() => setSelectedRoute(id)}>{t(`s3.route.${id}`)}</button>)}
      </div>}
      <ul className="mt-1.5 grid min-w-0 gap-0.5 sm:grid-cols-2">
        {steps.map((step) => <li key={step.key} className={`min-w-0 break-words ${step.done ? "text-moss" : "text-moon"}`}>
          <span aria-hidden="true">{step.done ? "✓" : "□"} </span><span className="sr-only">{t(step.done ? "s3.guide.done" : "s3.guide.todo")}</span>
          {step.recommended && <span className="text-mist">{t("s3.guide.recommended")} </span>}{t(step.key)}
        </li>)}
      </ul>
      {g.act === 4 && <p className="mt-1.5 text-gold-bright">{t(ready ? "s3.guide.route.ready" : "s3.guide.route.pending")}</p>}
    </div>
  </section>;
}

/** Match the server's investigation order using only the viewer's evidence. */
export function investigationAt03(g: PlayerView, roomId: RoomId03, year: Year03): S3Key | null {
  const tp = g.temporal!;
  const has = (id: string) => tp.myEvidence.includes(id);
  if (roomId === "ARCHIVES" && year === "Y2026") {
    if (!tp.myEvidence.some((id) => id.startsWith("CASE_FILE_"))) return "s3.causal.investigate";
    return g.act >= 3 && !has("FOUNDING_CHARTER") ? "s3.paradox.charter" : null;
  }
  if (g.act < 2) return null;
  if (roomId === "DIRECTOR_OFFICE") {
    if (year === "Y2026") return !has("SURVEILLANCE_TAPE") ? "s3.intruders.surveillance" : g.act >= 3 && !has("FOUNDER_DISCREPANCY") ? "s3.paradox.founder" : null;
    return !has("ACCESS_LEDGER") ? "s3.intruders.ledger" : g.act >= 3 && !has("JI_MARGIN_NOTE") ? "s3.paradox.ji" : null;
  }
  if (roomId === "MAIN_LAB" && year === "Y1996") return has("PROTOTYPE_LOG") ? null : "s3.intruders.prototype";
  if (g.act >= 3 && year === "Y2026" && roomId === "MAIN_LAB") return has("STAFF_DISCREPANCY") ? null : "s3.paradox.staff";
  if (g.act >= 3 && year === "Y2026" && roomId === "PROTOTYPE_ROOM") return has("PROTOTYPE_DISCREPANCY") ? null : "s3.paradox.prototype";
  return null;
}

export function investigateLabel03(g: PlayerView): S3Key | null {
  const here = g.temporal!.locations[g.viewerId];
  return investigationAt03(g, here.roomId, here.year);
}

/** The selected room in the year on view: its state, what is there, who is there, and what you could do there now. */
export function RoomPanel03({ g, room, year, onBack }: { g: PlayerView; room: RoomId03; year: Year03; onBack: () => void }) {
  const t = useT();
  const itemText = useItemText();
  const tp = g.temporal!;
  const current = tp.locations[g.viewerId];
  const mine = current.roomId === room && current.year === year;
  const { erased, open } = roomState03(g, room, year);
  const people = g.turnOrder.map((id) => g.players[id]).filter((p) => tp.locations[p.playerId]?.roomId === room && tp.locations[p.playerId]?.year === year);
  const sep = t("common.listSep");
  const describe: S3Key[] = [];
  if (room === "RESEARCH_WING") describe.push(year === "Y2026" && tp.present.researchFacility === "TEMPORAL_CONTAINMENT" ? "s3.items.containment" : "s3.items.researchCabinet");
  if (room === NPCS03.ARCHIVIST_00.roomId && year === NPCS03.ARCHIVIST_00.year) describe.push("s3.npc.intro");
  if (room === NPCS03.ZERO.roomId && year === NPCS03.ZERO.year && g.act >= NPCS03.ZERO.minAct) describe.push("s3.paradox.zero");
  if (room === "SECRET_ARCHIVE" && year === "Y2026") describe.push(tp.present.secretArchiveOpen ? "s3.causal.gateOpen" : "s3.causal.gateClosed");
  if (room === "POWER_ROOM" && year === "Y2026" && g.act >= 3) describe.push(tp.present.powerRoomExists ? "s3.paradox.powerHere" : "s3.paradox.powerGone");
  const nodes = year === "Y1996" && open ? NODE_IDS03.filter((id) => NODES03[id].roomId === room && g.act >= NODES03[id].minAct) : [];
  const unresolved = nodes.filter((id) => !tp.interventions.some((entry) => entry.nodeId === id));
  const relics = year === "Y2026" ? tp.worldItems.filter((item) => item.roomId === room) : [];
  const here: string[] = [];
  let specialCount = 0;
  if (open) {
    const inv = investigationAt03(g, room, year);
    if (inv) here.push(t("s3.panel.canInvestigate", { lead: t(inv) }));
    if (unresolved.length) here.push(t("s3.panel.canIntervene"));
    if (room === NPCS03.ARCHIVIST_00.roomId && year === NPCS03.ARCHIVIST_00.year && !tp.myEvidence.includes("ARCHIVIST_NOTE")) here.push(t("s3.panel.canSpeak", { name: t("s3.npc.ARCHIVIST_00") }));
    if (room === NPCS03.ZERO.roomId && year === NPCS03.ZERO.year && g.act >= NPCS03.ZERO.minAct && !tp.myEvidence.includes("ZERO_TRANSCRIPT")) here.push(t("s3.panel.canSpeak", { name: t("s3.npc.ZERO") }));
    if (mine && room === "RESEARCH_WING" && year === "Y2026" && g.myActions.find((a) => a.type === "SEARCH")?.enabled) here.push(t("s3.panel.canSearch"));
    for (const item of tp.myItems.filter((item) => year === "Y1996" && RELIC_STORAGE03[item.itemId] === room && (item.itemId === "OLD_BADGE" || tp.myObligations.some((entry) => entry.instanceId === item.instanceId)))) {
      here.push(t("s3.panel.canSeal", { name: itemText(item.itemId).name, id: item.instanceId }));
    }
    if (year === "Y2026" && relics.some((item) => item.itemId === "TIME_MARKER" || item.itemId === "AUTHORITY_CARD")) here.push(t("s3.panel.canPickup"));
    if (year === "Y2026" && relics.some((item) => item.itemId === "OLD_BADGE")) here.push(t("s3.panel.canPickupOther"));
    if (year === "Y1996" && room === "ARCHIVES" && g.act >= 4) here.push(t("s3.panel.finalHere"));
    specialCount = here.length;
    if (mine) {
      const next = ADJACENT03[room].filter((id) => roomState03(g, id, year).open);
      if (next.length) here.push(t("s3.panel.canMove", { rooms: next.map((id) => t(roomKey03(id))).join(sep) }));
      const other = year === "Y1996" ? "Y2026" : "Y1996";
      if (roomState03(g, room, other).open) here.push(t("s3.panel.canJump", { year: t(`s3.year.short.${other}`) }));
    }
  }
  return (
    <PlacePanel
      ariaLabel={t("s3.panel.aria")}
      kicker={t(mine ? "s3.panel.here" : "s3.panel.selected")}
      name={t(roomKey03(room))}
      meta={
        <>
          {t(`s3.year.short.${year}`)} · {erased ? t("s3.map.erased") : open ? t("s3.panel.open") : t("s3.map.locked", { act: OPENS_IN_ACT03[room] })}
        </>
      }
      back={mine ? undefined : { label: t("s3.panel.back"), onClick: onBack }}
    >
      {describe.map((k) => (
        <p key={k} className="mt-0.5 text-mist">
          {t(k)}
        </p>
      ))}
      {nodes.map((id) => (
        <p key={id} className="mt-0.5 text-gold">
          {t("s3.panel.node", { node: t(`s3.node.${id}`), state: t(tp.interventions.some((x) => x.nodeId === id) ? "s3.causal.resolved" : "s3.causal.unresolved") })}
        </p>
      ))}
      {relics.map((item) => (
        <p key={item.instanceId} className="mt-0.5 text-gold">
          {t("s3.panel.relic", { name: itemText(item.itemId).name, id: item.instanceId, source: t(item.storedBy ? "s3.items.sourced" : "s3.items.unsourced") })}
        </p>
      ))}
      <p className="mt-0.5 text-mist">{people.length ? t("s3.panel.people", { names: people.map((p) => p.nickname).join(sep) }) : t("s3.panel.nobody")}</p>
      <p className="label mt-1 text-signal">{t("s3.panel.what")}</p>
      {(!open || specialCount === 0) && <p className="mt-0.5 text-mist">{t(open ? "s3.panel.noNew" : "s3.panel.notOpen")}</p>}
      {here.map((line) => (
        <p key={line} className="mt-0.5 font-semibold text-gold-bright">
          › {line}
        </p>
      ))}
    </PlacePanel>
  );
}
