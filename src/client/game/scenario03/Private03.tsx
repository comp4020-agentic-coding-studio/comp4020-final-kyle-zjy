// Scenario 03's "Only you know" drawer contents, in scenario 02's drawer.
// First what is yours alone (sent only to you by the server's projection):
// your evidence, your numbered relics and the 1996 sources you owe, your
// ability, anything your ability let you glimpse. Then the public record,
// labelled as such: the incident record, the 2026 consequence record, the
// intruder traces, history under strain and the final record.
import type { StoryBeatId03 } from "../../../shared/game/scenario03/story.ts";
import { characterSkill } from "../../../shared/game/skills.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useCharacterText, useFormat, useItemText, useT } from "../../i18n/index.ts";
import type { S3Key } from "../../i18n/types.ts";
import { Section } from "../SecretsDrawer.tsx";
import { roomKey03 } from "./Map03.tsx";

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
  return (
    <>
      <Section title={t("s3.secrets.evidence")} empty={t("s3.secrets.evidenceEmpty")} items={tp.myEvidence.map((id) => ({ id, text: t(EVIDENCE[id] ?? "s3.causal.evidenceA") }))} />
      <section className="tarot p-3">
        <p className="label text-gold">{t("s3.items.held")}</p>
        {tp.myItems.length === 0 && <p className="mt-1 text-sm text-mist">{t("s3.items.none")}</p>}
        <ul className="mt-1 space-y-1.5">
          {tp.myItems.map((item) => (
            <li key={item.instanceId} className="text-sm">
              <span className="text-moon">
                {itemText(item.itemId).name} · {item.instanceId}
              </span>
              <span className="block text-xs text-mist">{t("s3.items.storageRoom", { room: t(roomKey03(item.roomId)) })}</span>
            </li>
          ))}
        </ul>
        {tp.myObligations.map((entry) => (
          <p key={entry.instanceId} className="mt-1 text-xs text-mist">
            {entry.placedBy ? t("s3.items.obligationDone", { id: entry.instanceId }) : t("s3.items.obligation", { id: entry.instanceId, room: t(roomKey03(entry.storageRoom)) })}
          </p>
        ))}
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
        <p className="label">{t("s3.secrets.causal", { n: tp.causalRevision })}</p>
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
