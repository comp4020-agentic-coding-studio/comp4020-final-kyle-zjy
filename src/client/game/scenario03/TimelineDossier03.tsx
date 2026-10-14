// The Timeline Dossier: Scenario 03's one place to read the story. Two views:
// the timeline (each record as a chain, 1996 decision → Incident Zero → 2026
// as it began → 2026 now) and the record comparison (original beside current).
// A timeline shift rewrites the matching current records in place. In Act IV
// the dossier opens onto the possible histories, whose conditions are the
// server's and link back to the records they need. Model: dossier03.ts.
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { EndingRoute03 } from "../../../shared/game/scenario03/story.ts";
import type { PlayerView, TemporalPresent03 } from "../../../shared/game/state.ts";
import { audio } from "../../audio/manager.ts";
import { useFormat, useT, type MessageKey } from "../../i18n/index.ts";
import { useStore } from "../../store.ts";
import "../../styles/dossier03.css";
import { assessment03, dossierChains03, ROUTE_RECORDS, shiftedRecords03, type DossierChain, type DossierRecord, type NodeStatus } from "./dossier03.ts";

const k = (key: string) => key as MessageKey;
const value = (id: DossierRecord, v: string) => k(`s3.dossier.value.${id}.${v}`);

/** Records a fresh timeline shift rewrote, held for a short while so the change can be seen. */
function useRewritten(): Set<DossierRecord> {
  const cue = useStore((s) => s.cues?.findLast((c) => c.kind === "S3_CAUSAL_REWRITE"));
  const [fresh, setFresh] = useState<Set<DossierRecord>>(new Set());
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!cue || seen.current === cue.key) return;
    seen.current = cue.key;
    if (Date.now() - cue.at > 6000) return;
    const ids = shiftedRecords03((cue.payload.before ?? {}) as Partial<TemporalPresent03>, (cue.payload.after ?? {}) as Partial<TemporalPresent03>);
    if (!ids.length) return;
    setFresh(new Set(ids));
    audio.play("timeline_shift");
    const timer = setTimeout(() => setFresh(new Set()), 9000);
    return () => clearTimeout(timer);
  }, [cue]);
  return fresh;
}

function Status({ status }: { status: NodeStatus }) {
  const t = useT();
  return <span className={`dossier-status is-${status}`}>{t(k(`s3.dossier.status.${status}`))}</span>;
}

function Value({ id, v, era, rewritten, before }: { id: DossierRecord; v: string; era: "original" | "current"; rewritten?: boolean; before?: string }) {
  const t = useT();
  const reduce = useReducedMotion();
  return <span className={`dossier-value is-${era} ${rewritten ? "is-rewritten" : ""}`}>
    {rewritten && before && before !== v && !reduce && <motion.s className="dossier-ghost" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: .4, duration: .9 }} aria-hidden="true">{t(value(id, before))}</motion.s>}
    <motion.b key={v} initial={rewritten && !reduce ? { opacity: 0, y: -4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: .7, duration: .5 }}>{t(value(id, v))}</motion.b>
  </span>;
}

/** One record as a chain: decision → incident → 2026 then → 2026 now. */
function Chain({ g, chain, open, onToggle, fresh, focused }: { g: PlayerView; chain: DossierChain; open: boolean; onToggle: () => void; fresh: boolean; focused: boolean }) {
  const t = useT();
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [focused]);
  const latest = chain.interventions.at(-1);
  const link = chain.changed ? "is-shifted" : chain.status === "contradicted" ? "is-broken" : latest ? "is-solid" : "is-dashed";
  return <li ref={ref} id={`dossier-${chain.id}`} className={`dossier-chain is-${chain.status} ${fresh ? "is-fresh" : ""} ${focused ? "is-focused" : ""}`} data-record={chain.id}>
    <button type="button" className="dossier-chain-head" aria-expanded={open} onClick={onToggle}>
      <span className="dossier-chain-title">{t(k(`s3.dossier.record.${chain.id}`))}</span>
      <Status status={chain.status} />
    </button>
    <ol className={`dossier-steps ${link}`}>
      <li className="dossier-step is-1996">
        <span className="dossier-step-era">{t("s3.dossier.era.1996")}</span>
        {latest ? <><span className="dossier-step-tag">{t("s3.dossier.intervention")}</span><span>{t(k(`s3.choice.${latest.nodeId}.${latest.choiceId}`))}</span><span className="dossier-step-meta">{t("s3.dossier.cycle", { n: latest.round })}{latest.actorId ? ` · ${g.players[latest.actorId]?.nickname ?? ""}` : ""}</span></>
          : <span className="dossier-unknown">{chain.locked ? t("s3.dossier.locked") : "???"}</span>}
      </li>
      <li className="dossier-step is-incident"><span className="dossier-step-era">{t("s3.dossier.incident.short")}</span><span>{t(k(`s3.dossier.cause.${chain.id}`))}</span></li>
      <li className="dossier-step is-original"><span className="dossier-step-era">{t("s3.dossier.original")}</span><Value id={chain.id} v={chain.original} era="original" /></li>
      <li className="dossier-step is-current"><span className="dossier-step-era">{t("s3.dossier.current")}</span><Value id={chain.id} v={chain.current} era="current" rewritten={fresh} before={chain.original} /></li>
    </ol>
    {open && <div className="dossier-evidence">
      <p className="dossier-evidence-title">{t("s3.dossier.evidence")}</p>
      <ul>
        {chain.fact && chain.factFound && <li><span>{t(k(`s3.fact.${chain.fact}.official`))}</span><span className="dossier-evidence-observed">{t(k(`s3.fact.${chain.fact}.observed`))}</span></li>}
        {chain.interventions.map((i) => <li key={i.seq}>{t("s3.dossier.recorded", { decision: t(k(`s3.choice.${i.nodeId}.${i.choiceId}`)), n: i.round })}</li>)}
        {chain.changed && <li>{t("s3.dossier.why", { from: t(value(chain.id, chain.original)), to: t(value(chain.id, chain.current)) })}</li>}
        {!chain.factFound && !chain.interventions.length && <li className="dossier-unknown">???</li>}
      </ul>
      {chain.fact && !chain.factFound && <p className="dossier-hint">{t("s3.dossier.unverified")}</p>}
      {chain.status === "contradicted" && <p className="dossier-hint is-contradiction">{t("s3.dossier.contradiction")}</p>}
    </div>}
  </li>;
}

function Compare({ chains, fresh }: { chains: DossierChain[]; fresh: Set<DossierRecord> }) {
  const t = useT();
  const sorted = [...chains].sort((a, b) => Number(b.changed) - Number(a.changed));
  return <ul className="dossier-compare">{sorted.map((c) => <li key={c.id} className={`dossier-diff ${c.changed ? "is-changed" : "is-same"} ${fresh.has(c.id) ? "is-fresh" : ""}`}>
    <p className="dossier-diff-title">{t(k(`s3.dossier.record.${c.id}`))}{c.changed ? "" : ` · ${t("s3.dossier.unchanged")}`}</p>
    <div className="dossier-diff-row">
      <Value id={c.id} v={c.original} era="original" />
      <span className="dossier-diff-arrow" aria-hidden="true">→</span>
      <Value id={c.id} v={c.current} era="current" rewritten={fresh.has(c.id)} before={c.original} />
    </div>
  </li>)}</ul>;
}

/** Act IV: the possible histories, each condition the server's verdict, each linked to its record. */
function Histories({ g, onLocate }: { g: PlayerView; onLocate: (id: DossierRecord) => void }) {
  const t = useT();
  const fmt = useFormat();
  const tp = g.temporal!;
  const routes = tp.story.availableRoutes;
  if (g.act < 4 || !routes.length) return null;
  return <section className="dossier-histories" aria-label={t("s3.dossier.histories")}>
    <p className="dossier-kicker">{t("s3.dossier.current.timeline")} → {t("s3.dossier.histories")}</p>
    <div className="dossier-routes">{routes.map((route: EndingRoute03) => {
      const conds = tp.routeConditions?.[route] ?? [];
      return <article key={route} className="dossier-route" data-route={route}>
        <h3>{t(k(`s3.route.${route}`))}</h3>
        <ul>{conds.map((c, i) => {
          const record = ROUTE_RECORDS[route][i];
          const body = <><span className={c.met ? "is-met" : "is-unmet"} aria-hidden="true">{c.met ? "✓" : "✗"}</span><span>{fmt(c.label)}</span><span className="sr-only">{t(c.met ? "s3.dossier.met" : "s3.dossier.unmet")}</span></>;
          return <li key={i}>{record && record !== "loops" ? <button type="button" className="dossier-cond" onClick={() => onLocate(record)}>{body}</button> : <span className="dossier-cond">{body}</span>}</li>;
        })}</ul>
      </article>;
    })}</div>
  </section>;
}

export function TimelineDossier03({ g }: { g: PlayerView }) {
  const t = useT();
  const [view, setView] = useState<"timeline" | "compare">("timeline");
  const [open, setOpen] = useState<DossierRecord | null>(null);
  const [focus, setFocus] = useState<DossierRecord | null>(null);
  const fresh = useRewritten();
  const chains = dossierChains03(g);
  const a = assessment03(g);
  const stamp = useRef(a.key);
  useEffect(() => { if (stamp.current !== a.key) { stamp.current = a.key; audio.play(a.key === "contradicted" ? "ui_error" : "archive_scan"); } }, [a.key]);
  const locate = (id: DossierRecord) => { setView("timeline"); setOpen(id); setFocus(id); setTimeout(() => setFocus(null), 2400); };
  const names = (ids: DossierRecord[]) => ids.map((id) => t(k(`s3.dossier.record.${id}`))).join(t("common.listSep"));
  return <section className={`dossier ${fresh.size ? "is-shifting" : ""}`} aria-label={t("s3.dossier.title")}>
    <header className="dossier-head">
      <div>
        <p className="dossier-kicker">{t("s3.dossier.kicker")}</p>
        <h2>{t("s3.dossier.title")}</h2>
      </div>
      <div className={`dossier-assessment is-${a.key}`} role="status">
        <p className="dossier-kicker">{t(g.act >= 3 ? "s3.dossier.assessment.updated" : "s3.dossier.assessment")}</p>
        <p>{t(k(`s3.dossier.assess.${a.key}`))}</p>
        {a.changed.length > 0 && <p className="dossier-assessment-sub">{t("s3.dossier.assess.changedIn", { list: names(a.changed) })}</p>}
        {a.contradictions.length > 0 && <p className="dossier-assessment-sub">{t("s3.dossier.assess.open", { n: a.contradictions.length })}</p>}
      </div>
    </header>
    <div className="dossier-tabs" role="tablist">
      {(["timeline", "compare"] as const).map((v) => <button key={v} type="button" role="tab" aria-selected={view === v} className={`dossier-tab ${view === v ? "is-on" : ""}`} onClick={() => setView(v)}>{t(k(`s3.dossier.view.${v}`))}</button>)}
    </div>
    {view === "timeline" ? <>
      <div className="dossier-incident">
        <p className="dossier-kicker">{t("s3.dossier.incident")}</p>
        <strong>23:47</strong>
        <p>{t("s3.dossier.incident.line")}</p>
        <p className="dossier-incident-understanding">{t(k(a.contradictions.length ? "s3.dossier.incident.contested" : a.changed.length ? "s3.dossier.incident.rewritten" : "s3.dossier.incident.official"))}</p>
      </div>
      <ol className="dossier-chains">{chains.map((c) => <Chain key={c.id} g={g} chain={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} fresh={fresh.has(c.id)} focused={focus === c.id} />)}</ol>
      <p className="dossier-legend">{t("s3.dossier.legend")}</p>
    </> : <Compare chains={chains} fresh={fresh} />}
    <Histories g={g} onLocate={locate} />
  </section>;
}
