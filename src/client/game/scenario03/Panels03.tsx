// Scenario 03 on the city layout: its top bar (act, cycle, temporal collapse,
// the year you are in, the causal revision, relic sources), its objective
// line and its room panel. The shells are scenario 02's (RunTopBar,
// ObjectiveLine, PlacePanel); only the contents are this scenario's.
import { NODE_IDS03, NODES03 } from "../../../shared/game/scenario03/nodes.ts";
import { NPCS03 } from "../../../shared/game/scenario03/story.ts";
import { OPENS_IN_ACT03, type RoomId03, type Year03 } from "../../../shared/game/scenario03/map.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useItemText, useT } from "../../i18n/index.ts";
import type { S3Key } from "../../i18n/types.ts";
import { ObjectiveLine, PlacePanel, RunTopBar } from "../RunTopBar.tsx";
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
  return <ObjectiveLine>{t(`s3.objective.${Math.min(Math.max(g.act, 1), 4) as 1 | 2 | 3 | 4}`)}</ObjectiveLine>;
}

/** What Investigate does in your room and year, as the old screen labelled it (null: nothing to investigate here). */
export function investigateLabel03(g: PlayerView): S3Key | null {
  const tp = g.temporal!;
  const { roomId, year } = tp.locations[g.viewerId];
  const has = (id: string) => tp.myEvidence.includes(id);
  if (roomId === "ARCHIVES" && year === "Y2026") return g.act >= 3 && has(tp.present.caseFile === "A" ? "CASE_FILE_A" : "CASE_FILE_B") ? "s3.paradox.charter" : "s3.causal.investigate";
  if (g.act < 2) return null;
  if (roomId === "DIRECTOR_OFFICE") return year === "Y2026" ? (g.act >= 3 && has("SURVEILLANCE_TAPE") ? "s3.paradox.founder" : "s3.intruders.surveillance") : g.act >= 3 && has("ACCESS_LEDGER") ? "s3.paradox.ji" : "s3.intruders.ledger";
  if (roomId === "MAIN_LAB" && year === "Y1996") return "s3.intruders.prototype";
  if (g.act >= 3 && year === "Y2026" && roomId === "MAIN_LAB") return "s3.paradox.staff";
  if (g.act >= 3 && year === "Y2026" && roomId === "PROTOTYPE_ROOM") return "s3.paradox.prototype";
  return null;
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
  // what you could do here, now (only in your own room and year)
  const here: string[] = [];
  if (mine) {
    const inv = investigateLabel03(g);
    if (inv) here.push(t(inv));
    if (room === NPCS03.ARCHIVIST_00.roomId && year === NPCS03.ARCHIVIST_00.year) here.push(t("s3.npc.ask"));
    if (room === NPCS03.ZERO.roomId && year === NPCS03.ZERO.year && g.act >= NPCS03.ZERO.minAct) here.push(t("s3.paradox.askZero"));
    if (room === "RESEARCH_WING" && year === "Y2026") here.push(t("s3.items.search"));
    if (year === "Y1996" && room === "ARCHIVES" && g.act >= 4) here.push(t(g.myActions.find((a) => a.type === "RESOLVE_HISTORY")?.enabled ? "s3.final.where" : "s3.final.unready"));
  }
  const nodes = year === "Y1996" ? NODE_IDS03.filter((id) => NODES03[id].roomId === room && g.act >= NODES03[id].minAct) : [];
  const relics = year === "Y2026" ? tp.worldItems.filter((item) => item.roomId === room) : [];
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
      {here.map((line) => (
        <p key={line} className="mt-0.5 font-semibold text-gold-bright">
          › {line}
        </p>
      ))}
    </PlacePanel>
  );
}
