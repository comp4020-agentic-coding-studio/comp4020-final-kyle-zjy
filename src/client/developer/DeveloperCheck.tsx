import { useState } from "react";
import { CHECK_PRESETS, type CheckPresetId } from "../../shared/developer.ts";
import { SCENARIOS } from "../../shared/game/scenarios.ts";
import { scenario02Text } from "../../shared/i18n/scenario02.ts";
import { scenarioText } from "../../shared/i18n/content.ts";
import { LanguageSwitch } from "../components/LanguageSwitch.tsx";
import { useLocale, useT, type MessageKey } from "../i18n/index.ts";
import { navigate } from "../router.ts";
import { checkPath, launchCheck, savedChecks } from "./session.ts";
import { EndingPreview } from "./EndingPreview.tsx";
import "../styles/developer.css";

export default function DeveloperCheck() {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState<Record<string, CheckPresetId>>({ S01_LAST_TRAIN: "s1.start", S02_SUNKEN_CITY: "s2.start", S03_INCIDENT_ZERO: "s3.start", S04_UNDERGROUND_AUCTION: "s4.start" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const last = savedChecks().at(-1);
  const start = async (id: CheckPresetId) => {
    setBusy(true); setError(false);
    try { navigate(checkPath(await launchCheck(id))); }
    catch { setError(true); setBusy(false); }
  };
  return <main className="night-sky developer-page">
    <div className="developer-container">
      <nav className="developer-nav"><button className="btn btn-ghost" onClick={() => navigate("/")}>{t("developer.home")}</button><LanguageSwitch /></nav>
      <header className="developer-heading"><p className="label text-signal">{t("developer.heading")}</p><h1>{t("developer.entry")}</h1><p>{t("developer.notice")}</p><p>{t("developer.returnNote")}</p></header>
      {error && <p role="alert" className="developer-error">{t("developer.error")}</p>}
      {busy && <p role="status">{t("developer.wait")}</p>}
      {last && <button className="btn btn-ghost" onClick={() => navigate(checkPath(last))}>{t("developer.recent")}</button>}
      <h2 className="developer-section-title">{t("developer.scenarios")}</h2>
      <section className="developer-grid" aria-label={t("developer.scenarios")}>
        {Object.values(SCENARIOS).map((scenario) => {
          const id = selected[scenario.id];
          return <article key={scenario.id} className="tarot developer-card">
            <p className="label text-gold">{scenario.number}</p><h2>{scenario.id === "S01_LAST_TRAIN" ? scenarioText(locale).scenario.title : scenario.id === "S02_SUNKEN_CITY" ? scenario02Text(locale).scenario.title : t(scenario.id === "S03_INCIDENT_ZERO" ? "s3.title" : "s4.title")}</h2>
            <label htmlFor={`checkpoint-${scenario.id}`}>{t("developer.checkpoint")}</label>
            <select id={`checkpoint-${scenario.id}`} className="field" value={id} disabled={busy} onChange={(e) => setSelected({ ...selected, [scenario.id]: e.target.value as CheckPresetId })}>
              {(["start", "middle", "event", "end"] as const).map((group) => <optgroup key={group} label={t(`developer.${group}`)}>{CHECK_PRESETS.filter((p) => p.scenarioId === scenario.id && p.group === group).map((preset) => <option key={preset.id} value={preset.id}>{t(`developer.${preset.id}.label` as MessageKey)}</option>)}</optgroup>)}
            </select>
            <p className="developer-note">{t(`developer.${id}.note` as MessageKey)}</p>
            <button className="btn btn-signal" disabled={busy} onClick={() => void start(id)}>{t("developer.launch")}</button>
          </article>;
        })}
      </section>
      <section aria-labelledby="developer-ui-title" className="developer-ui">
        <h2 id="developer-ui-title" className="developer-section-title">{t("developer.openings")}</h2>
        <div className="developer-grid developer-replays">{([1, 2, 3, 4] as const).map((n) => <button key={n} className="btn btn-ghost" disabled={busy} onClick={() => void start(`s${n}.start`)}>{t("developer.replay", { n: String(n).padStart(2, "0") })}</button>)}</div>
        <div className="developer-grid developer-replays">{([['phase','s1.fold'],['ending','s1.ending'],['recap','s3.recap'],['private','s4.private'],['dice','s3.dice'],['trade','s1.trade']] as const).map(([key, id]) => <button key={key} className="btn btn-ghost" disabled={busy} onClick={() => void start(id)}>{t(`developer.${key}`)}</button>)}</div>
      </section>
      <EndingPreview />
    </div>
  </main>;
}
