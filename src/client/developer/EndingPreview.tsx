// Developer check: plays the real ending cinematics (EndingFilm) with fixture
// facts, no server and no once-per-run marker, so a preview never affects a run.
import { useLayoutEffect, useState } from "react";
import { audio } from "../audio/manager.ts";
import { ENDING_IDS, type EndingFacts, type EndingId } from "../game/ending/cinematics.ts";
import { EndingFilm } from "../game/ending/EndingFilm.tsx";
import { useT } from "../i18n/index.ts";

const FACTS: EndingFacts = { me: "Bea", names: ["Ada", "Bea", "Cal"], aboard: ["Ada", "Bea"], seat: 2, debt: 6 };
const GROUPS = [1, 2, 3, 4].map((n) => ENDING_IDS.filter((id) => id.startsWith(`s0${n}`)));

export function EndingPreview() {
  const t = useT();
  const [playing, setPlaying] = useState<{ id: EndingId; take: number } | null>(null);
  const [reduced, setReduced] = useState(false);
  // the film plays through the shared audio owner, which respects the global mute
  useLayoutEffect(() => (playing ? audio.acquire() : undefined), [playing]);
  return <section aria-labelledby="developer-endings-title" className="developer-ui">
    <h2 id="developer-endings-title" className="developer-section-title">{t("developer.endings")}</h2>
    <label className="developer-toggle"><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} /> {t("developer.endings.reduced")}</label>
    <div className="developer-grid">{GROUPS.map((ids, i) => <article key={i} className="tarot developer-card">
      <p className="label text-gold">{t("developer.endings.scenario", { n: `0${i + 1}` })}</p>
      {ids.map((id) => <button key={id} className="btn btn-ghost" onClick={() => setPlaying((p) => ({ id, take: (p?.take ?? 0) + 1 }))}>{t(`developer.endings.${id}`)}</button>)}
    </article>)}</div>
    {playing && <EndingFilm key={playing.take} id={playing.id} facts={FACTS} reduced={reduced} onDone={() => setPlaying(null)} />}
  </section>;
}
