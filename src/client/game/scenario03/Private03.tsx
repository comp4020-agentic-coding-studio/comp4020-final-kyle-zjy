// Scenario 03's "Only you know" drawer contents, in scenario 02's drawer.
// First what is yours alone (sent only to you by the server's projection):
// your evidence, your numbered relics and the 1996 sources you owe, your
// ability, anything your ability let you glimpse. Then the public record,
// labelled as such: the incident record, the 2026 consequence record, the
// intruder traces, history under strain and the final record.
import type { StoryBeatId03 } from "../../../shared/game/scenario03/story.ts";
import type { S03ItemId } from "../../../shared/game/scenario03/items.ts";
import { RELIC_STORAGE03 } from "../../../shared/game/scenario03/items.ts";
import { characterSkill } from "../../../shared/game/skills.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useCharacterText, useFormat, useItemText, useT } from "../../i18n/index.ts";
import type { S3Key } from "../../i18n/types.ts";
import { Section } from "../SecretsDrawer.tsx";
import { roomKey03 } from "./Map03.tsx";
import { archiveLeadText03 } from "./archiveLead03.ts";

const EVIDENCE: Record<string, S3Key> = {
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
};

const RELIC_INSTANCE03: Record<string, S03ItemId> = { "relic-1": "TIME_MARKER", "relic-2": "AUTHORITY_CARD" };

export function Private03({ g }: { g: PlayerView }) {
  const t = useT();
  const fmt = useFormat();
  const itemText = useItemText();
  const charText = useCharacterText();
  const tp = g.temporal!;
  const me = g.players[g.viewerId];
  const s = g.mySecrets;
  const skillId = me.skill.borrowed ?? me.characterId;
  const skill = characterSkill(skillId, g.scenarioId);
  const words = charText(skillId);
  const p = tp.present;
  const numberedItems = tp.myItems.filter((item) => item.itemId === "TIME_MARKER" || item.itemId === "AUTHORITY_CARD");
  const otherItems = tp.myItems.filter((item) => item.itemId !== "TIME_MARKER" && item.itemId !== "AUTHORITY_CARD");
  const relicName = (id: string) => {
    const itemId = tp.myItems.find((item) => item.instanceId === id)?.itemId
      ?? tp.worldItems.find((item) => item.instanceId === id)?.itemId
      ?? RELIC_INSTANCE03[id];
    return itemId ? itemText(itemId).name : id;
  };
  return (
    <>
      <Section title={t("s3.secrets.evidence")} empty={t("s3.secrets.evidenceEmpty")} items={tp.myEvidence.map((id) => ({ id, text: t(EVIDENCE[id] ?? "s3.causal.evidenceA") }))} />
      {s?.archiveLead03 && <Section title={t("s3.scan.archive.title")} empty="" items={[{ id: "archive-lead", text: archiveLeadText03(t, s.archiveLead03), meta: t("secrets.round", { n: s.archiveLead03.round }) }]} />}
      <section className="tarot p-3">
        <p className="label text-gold">{t("s3.items.loopTitle")}</p>
        {tp.myObligations.length === 0 && <p className="mt-1 text-sm text-mist">{t("s3.items.noLoop")}</p>}
        <ul className="mt-1 space-y-3">
          {tp.myObligations.map((entry) => <li key={entry.instanceId} className="min-w-0 text-sm">
            <p className="font-semibold text-moon">{relicName(entry.instanceId)} · {entry.instanceId}</p>
            {entry.placedBy ? <p className="mt-0.5 text-moss">{t("s3.items.loopDone", { room: t(roomKey03(entry.storageRoom)) })}</p>
              : <>
                <p className="mt-0.5 text-mist">{t("s3.items.loopKeeper")}</p>
                <p className="mt-0.5 text-gold-bright">{t(tp.myItems.some((item) => item.instanceId === entry.instanceId) ? "s3.items.loopCarry" : "s3.items.loopGet", { name: relicName(entry.instanceId), id: entry.instanceId, room: t(roomKey03(entry.storageRoom)) })}</p>
                <p className="mt-0.5 text-xs text-mist">{t("s3.items.loopWhy")}</p>
              </>}
          </li>)}
        </ul>
      </section>
      <section className="tarot p-3">
        <p className="label text-gold">{t("s3.items.held")}</p>
        {numberedItems.length === 0 && <p className="mt-1 text-sm text-mist">{t("s3.items.none")}</p>}
        <ul className="mt-1 space-y-3">
          {numberedItems.map((item) => (
            <li key={item.instanceId} className="text-sm">
              <span className="text-moon">
                {itemText(item.itemId).name} · {item.instanceId}
              </span>
              <span className="block text-xs text-mist">{t("s3.items.storageRoom", { room: t(roomKey03(RELIC_STORAGE03[item.itemId] ?? item.roomId)) })}</span>
              <span className="block text-xs text-gold-bright">{t(tp.myObligations.some((entry) => entry.instanceId === item.instanceId && entry.placedBy) ? "s3.items.heldDone" : tp.myObligations.some((entry) => entry.instanceId === item.instanceId) ? "s3.items.heldNext" : "s3.items.heldTransfer", { room: t(roomKey03(RELIC_STORAGE03[item.itemId] ?? item.roomId)) })}</span>
            </li>
          ))}
        </ul>
        {otherItems.length > 0 && <p className="mt-2 text-xs text-mist">{t("s3.items.otherHeld", { names: otherItems.map((item) => itemText(item.itemId).name).join(t("common.listSep")) })}</p>}
      </section>
      <section className="rounded-lg border border-violet/40 bg-violet/5 p-3">
        <p className="label text-signal">{t("s3.skill.title")}</p>
        <p className="mt-1 font-display text-lg text-gold-bright">{words.skillName}</p>
        <p className="text-xs text-mist">
          {t(`s3.skill.type.${skill.type}`)} · {me.skill.usesLeft === 1 ? t("s3.skill.usesOne") : t("s3.skill.uses", { n: me.skill.usesLeft })}
        </p>
        <p className="mt-1 text-sm">{words.skillDescription}</p>
      </section>
      {s && s.peeks.length > 0 && <Section title={t("secrets.glimpses")} empty="" items={s.peeks.map((x) => ({ id: x.id, text: fmt(x.text), meta: t("secrets.round", { n: x.round }) }))} />}

      <p className="label border-b border-signal/20 pb-1 text-signal">{t("s3.secrets.publicGroup")}</p>
      <p className="text-sm text-mist">{t("s3.items.teamLoops", { n: tp.bootstrapProgress.placed, total: tp.bootstrapProgress.total })}</p>
      <section>
        <p className="label">{t("s3.secrets.record")}</p>
        <ol className="s3-story-list mt-2">
          {tp.story.revealed.map((id: StoryBeatId03, index) => (
            <li key={id} className={`s3-story-entry ${index === tp.story.revealed.length - 1 ? "s3-story-latest" : ""}`}>
              <span className="s3-story-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{t(`s3.story.${id}`)}</span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <p className="label">{t(tp.causalRevision ? "s3.secrets.causal" : "s3.secrets.causalInitial", { n: tp.causalRevision })}</p>
        <ul className="mt-1 space-y-1 text-sm">
          <li>{t("s3.causal.case", { id: p.caseFile })}</li>
          <li>{t(p.secretArchiveOpen ? "s3.causal.gateOpen" : "s3.causal.gateClosed")}</li>
          <li>{t(p.workerPresent ? "s3.causal.workerHere" : "s3.causal.workerAbsent")}</li>
          <li>{t(p.badgeCache ? "s3.causal.badgeHere" : "s3.causal.badgeAbsent")}</li>
          <li>{t(p.report === "CORRECTED" ? "s3.causal.reportCorrected" : "s3.causal.reportOfficial")}</li>
          {g.act >= 3 && <li>{t(p.administrationIntegrity === "FADING" ? "s3.causal.integrityFading" : "s3.causal.integrityStable")}</li>}
        </ul>
        {tp.interventions.length > 0 && (
          <div className="s3-causal-history">
            <p className="label text-mist">{t("s3.causal.history")}</p>
            <ol>
              {[...tp.interventions]
                .sort((a, b) => b.seq - a.seq)
                .map((entry) => (
                  <li key={entry.seq}>
                    <span className="s3-causal-year">1996</span>
                    <span className="s3-causal-decision">
                      {t(`s3.node.${entry.nodeId}`)} · {t(`s3.choice.${entry.nodeId}.${entry.choiceId}` as S3Key)}
                    </span>
                    <span className="s3-causal-arrow" aria-hidden="true">
                      →
                    </span>
                    <span className="s3-causal-year">2026</span>
                  </li>
                ))}
            </ol>
          </div>
        )}
      </section>
      {g.act >= 2 && (tp.surveillanceReviewed || tp.identityMatches.length > 0) && (
        <section>
          <p className="label">{t("s3.secrets.intruders")}</p>
          {tp.surveillanceReviewed && tp.surveillance.length === 0 && <p className="mt-1 text-sm text-ash">{t("s3.intruders.noTrace")}</p>}
          <ul className="mt-1 space-y-1.5">
            {tp.surveillanceReviewed &&
              tp.surveillance.map((trace) => (
                <li key={trace.seq} className="rounded-lg border border-gold/20 px-3 py-2 text-sm">
                  {t(`s3.intruders.trace.${trace.kind}`, { signature: trace.signature, room: t(roomKey03(trace.roomId)), round: trace.round })}
                  {trace.nodeId && trace.choiceId && <span className="block text-xs text-mist">{t("s3.intruders.detail.intervention", { node: t(`s3.node.${trace.nodeId}`), choice: t(`s3.choice.${trace.nodeId}.${trace.choiceId}` as S3Key) })}</span>}
                  {trace.instanceId && <span className="block text-xs text-mist">{t("s3.intruders.detail.relic", { id: trace.instanceId })}</span>}
                </li>
              ))}
            {tp.identityMatches.map((match) => (
              <li key={match.signature} className="rounded-lg border border-signal/40 px-3 py-2 text-sm text-signal">
                {t("s3.intruders.match", { signature: match.signature, name: g.players[match.playerId].nickname })}
              </li>
            ))}
          </ul>
        </section>
      )}
      {g.act >= 3 && (
        <section>
          <p className="label">{t("s3.secrets.paradox")}</p>
          <ul className="mt-1 space-y-1 text-sm">
            <li>{t(p.administrationIntegrity === "FADING" ? "s3.paradox.fading" : "s3.paradox.stable")}</li>
            <li>{t(p.powerRoomExists ? "s3.paradox.powerHere" : "s3.paradox.powerGone")}</li>
          </ul>
          {tp.discoveredFacts.map((id) => (
            <div key={id} className="mt-1.5 rounded-lg border border-gold/20 px-3 py-2 text-sm">
              <p>{t(`s3.fact.${id}.official`)}</p>
              <p className="mt-0.5 text-signal">{t(`s3.fact.${id}.observed`)}</p>
            </div>
          ))}
          <p className="label mt-2 text-gold">{t("s3.route.title")}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {tp.story.availableRoutes.map((id) => (
              <li key={id}>{t(`s3.route.${id}`)}</li>
            ))}
          </ul>
        </section>
      )}
      {g.act >= 4 && (
        <section>
          <p className="label">{t("s3.secrets.final")}</p>
          <ul className="mt-1 space-y-1 text-sm">
            <li>{t(`s3.final.record.${p.accidentRecord}`)}</li>
            <li>{t(p.staffEvacuated ? "s3.final.staffSafe" : "s3.final.staffUnsafe")}</li>
            <li>{t(p.jiStaged ? "s3.final.jiStaged" : "s3.final.jiExposed")}</li>
            <li>{t(p.prototypeHidden ? "s3.final.prototypeHidden" : "s3.final.prototypeExposed")}</li>
            <li>{t("s3.final.bootstrap", { n: tp.bootstrapProgress.placed, total: tp.bootstrapProgress.total })}</li>
          </ul>
          <p className="mt-1 text-xs text-mist">{t("s3.final.where")}</p>
        </section>
      )}
    </>
  );
}
