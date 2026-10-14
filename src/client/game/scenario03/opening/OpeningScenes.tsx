import type { RoomId03 } from "../../../../shared/game/scenario03/map.ts";
import { useT } from "../../../i18n/index.ts";
import type { OpeningScene } from "./timeline.ts";

const FEEDS: RoomId03[] = ["CENTRAL_HALL", "ARCHIVES", "PROTOTYPE_ROOM", "RESEARCH_WING"];

/** The same physical shell, with digital equipment or paper/analogue instruments. */
export function RoomFeed({ past = false, room = "CENTRAL_HALL" }: { past?: boolean; room?: RoomId03 }) {
  return <div className={`s3-film-feed ${past ? "s3-film-analogue" : ""}`}>
    <svg viewBox="0 0 640 320" role="presentation" aria-hidden="true">
      <path className="film-wall" d="M0 0H640V320H0Z" />
      <path className="film-floor" d="M0 320 185 210H455L640 320Z" />
      <g className="film-lines" fill="none">
        <path d="M0 0 185 65H455L640 0M185 65V210H455V65M0 320 185 210M640 320 455 210M100 320 225 210M240 320 285 210M400 320 355 210M540 320 415 210M68 280H572M126 244H514" />
        <path d="M65 30V284M130 47V244M575 30V284M510 47V244M0 110 185 122M455 122 640 110" />
      </g>
      <g className="film-light"><path d="M226 69H285V73H226ZM355 69H414V73H355Z" /><path d="M190 92H194V190H190ZM446 92H450V190H446Z" /></g>
      {room === "ARCHIVES" ? <g className="film-equipment">
        {[207, 268, 329, 390].map((x) => <g key={x}><rect x={x} y="98" width="43" height="103" rx="2" />{[115, 139, 163, 187].map((y) => past
          ? <g key={y}><path d={`M${x + 4} ${y}h35m-32 -2v-12h8v12m3 0v-15h6v15m4 0 -2 -13 7 -1 2 14`} /></g>
          : <path key={y} d={`M${x + 5} ${y}h33m-22 -7h11`} />)}</g>)}
      </g> : room === "PROTOTYPE_ROOM" ? <g className="film-equipment">
        <path d="M260 208V174H380V208ZM289 175V119H351V175" />
        <circle cx="320" cy="125" r="43" /><circle cx="320" cy="125" r="30" /><path d="M277 125H363M320 82V168M303 91 337 159M337 91 303 159" />
      </g> : <g className="film-equipment">
        <rect x="267" y="91" width="106" height="119" /><path d="M320 92V210M274 106H312V181H274ZM328 106H366V181H328Z" />
        <rect x="210" y="130" width="37" height="34" /><path d="M215 140H241M215 147H232M228 164V183M216 184H240" />
        {past ? <><path d="M390 175H428V197H390Z" /><circle cx="401" cy="185" r="5" /><circle cx="417" cy="185" r="5" /><path d="M392 205H425" /></> : <path className="film-light" d="M392 114H428V116H392ZM392 121H419V123H392ZM392 128H425V130H392Z" />}
      </g>}
      <path className="film-shadow" d="M0 0H640V24H0ZM0 300H640V320H0Z" />
    </svg>
    <div className="s3-film-scan" aria-hidden="true" />
  </div>;
}

function Lockdown({ elapsed }: { elapsed: number }) {
  const t = useT();
  const locked = Math.min(4, Math.floor(elapsed / 1.4));
  return <div className="s3-film-lockdown">
    <div className="s3-film-feeds">{FEEDS.map((room, i) => <div key={room} className={`s3-film-monitor ${i < locked ? "is-locked" : ""}`}>
      <RoomFeed room={room} /><p><span>{t(`s3.room.${room}`)}</span><b>{t(i < locked ? "s3.open.locked" : "s3.open.monitoring")}</b></p>
    </div>)}</div>
    <p className="s3-film-alert">{t("s3.open.lockdown")} <span>23:47</span></p>
  </div>;
}

function Archive({ elapsed }: { elapsed: number }) {
  const t = useT();
  return <div className="s3-film-dossier">
    <div className="s3-film-file-header"><span>{t("s3.open.classified")}</span><span>0 / 1996</span></div>
    <h2>{t("s3.open.incident")}</h2>
    <div className="s3-film-file-body">
      <div className="s3-film-damaged"><RoomFeed room="PROTOTYPE_ROOM" /><span>{t("s3.open.damaged")}</span></div>
      <div className="s3-film-redactions" aria-label={t("s3.open.redacted")}>{[84, 61, 94, 73, 87].map((width, i) => <span key={i} style={{ width: `${width}%` }} />)}<p>{t("s3.open.accessGap")}</p></div>
    </div>
    <dl className="s3-film-dates"><div><dt>{t("s3.open.incidentDate")}</dt><dd>1996</dd></div>
      <div className={elapsed < 4 ? "film-concealed" : ""}><dt>{t("s3.open.founded")}</dt><dd>1998</dd></div></dl>
    <p className={`s3-film-conflict ${elapsed < 7 ? "film-concealed" : ""}`}>{t("s3.open.conflict")}</p>
  </div>;
}

function Dual({ elapsed }: { elapsed: number }) {
  const t = useT();
  const room = elapsed < 5 ? "ARCHIVES" : "PROTOTYPE_ROOM";
  return <div className="s3-film-dual">{[false, true].map((past) => <div key={String(past)} className={past ? "s3-film-past-panel" : ""}>
    <p className="s3-film-year">{past ? "1996" : "2026"}</p><RoomFeed past={past} room={room} />
    <h2>{t(past ? (room === "ARCHIVES" ? "s3.open.pastArchives" : "s3.open.pastPrototype") : `s3.room.${room}`)}</h2>
    <p className="s3-film-meta">{t(past ? "s3.open.analogue" : "s3.open.digital")}</p>
  </div>)}</div>;
}

function Jump({ elapsed }: { elapsed: number }) {
  const t = useT();
  const years = [2026, 2018, 2007, 1999, 1996];
  const year = years[Math.min(4, Math.max(0, Math.floor((elapsed - 1) / .65)))];
  return <div className={`s3-film-jump ${elapsed > 1 && elapsed < 4 ? "is-rewinding" : ""}`}>
    <RoomFeed past={year === 1996} />
    <div className="s3-film-jump-date"><p>{t("s3.room.CENTRAL_HALL")}</p><strong>{year}</strong><span>{t("s3.open.sameRoom")}</span></div>
    <div className="s3-film-tape" aria-hidden="true">◁◁ &nbsp; 2026 / 1996 &nbsp; ◁◁</div>
  </div>;
}

const EXAMPLES = ["report", "worker", "core"] as const;
function Causal({ elapsed }: { elapsed: number }) {
  const t = useT();
  const example = EXAMPLES[Math.min(2, Math.floor(elapsed / 3.6))];
  const settled = elapsed % 3.6 > 1.3;
  return <div className="s3-film-causal">
    <p className="s3-film-meta">{t("s3.open.causalPreview")}</p>
    <div className="s3-film-causal-pair" key={example}>
      <div className="s3-film-causal-card s3-film-past-panel"><p className="s3-film-year">1996</p><RoomFeed past room={example === "report" ? "ARCHIVES" : example === "worker" ? "RESEARCH_WING" : "PROTOTYPE_ROOM"} /><h2>{t(`s3.open.example.${example}.past`)}</h2></div>
      <span className="s3-film-arrow" aria-hidden="true">→</span>
      <div className={`s3-film-causal-card ${settled ? "is-rewritten" : ""}`}><p className="s3-film-year">2026</p><div className="s3-film-record-icon" aria-hidden="true"><i /><i /><i /></div><h2>{t(settled ? `s3.open.example.${example}.present` : "s3.open.awaiting")}</h2></div>
    </div>
    <p className={`s3-film-shift ${settled ? "" : "film-concealed"}`}>{t("s3.open.timelineShift")}</p>
  </div>;
}

function Records({ elapsed }: { elapsed: number }) {
  const t = useT();
  return <div className="s3-film-records">
    <div className="s3-film-record-grid"><div className="s3-film-corrupt"><RoomFeed room="RESEARCH_WING" /><div className="s3-film-silhouettes" aria-hidden="true"><i /><i /><i /></div></div>
      <div className="s3-film-ledger"><p>{t("s3.open.accessGap")}</p><p>23:47 &nbsp; — — —</p><div className="s3-film-redactions"><span /><span /><span /></div><p>{t("s3.open.erasedNames")}</p></div></div>
    <h2>{t("s3.open.unknownVisitor")}</h2>
    <p className={`s3-film-warning ${elapsed < 6.5 ? "film-concealed" : ""}`}>{t("s3.open.distrust")}</p>
  </div>;
}

function Mission({ elapsed }: { elapsed: number }) {
  const t = useT();
  return <div className="s3-film-mission"><p className="s3-film-meta">{t("s3.open.assignment")}</p><h2>{t("s3.open.narration.investigate")}</h2>
    <ol>{(["evidence", "intervene", "loops", "decide"] as const).map((task, i) => <li key={task} className={elapsed < i * 1.2 ? "film-concealed" : ""}><span aria-hidden="true">0{i + 1}</span>{t(`s3.open.task.${task}`)}</li>)}</ol>
  </div>;
}

export function OpeningScenes({ id, elapsed }: { id: OpeningScene; elapsed: number }) {
  const t = useT();
  switch (id) {
    case "sync": return <div className="s3-film-sync"><strong className={elapsed < .8 ? "film-concealed" : ""}>{elapsed > 2.3 && elapsed < 3.1 ? "23:46" : "23:47"}</strong><p className={elapsed < 2 ? "film-concealed" : ""}>{t("s3.open.syncFailure")}</p></div>;
    case "lockdown": return <Lockdown elapsed={elapsed} />;
    case "archive": return <Archive elapsed={elapsed} />;
    case "dual": return <Dual elapsed={elapsed} />;
    case "jump": return <Jump elapsed={elapsed} />;
    case "causal": return <Causal elapsed={elapsed} />;
    case "records": return <Records elapsed={elapsed} />;
    case "mission": return <Mission elapsed={elapsed} />;
    case "title": return <div className="s3-film-title"><RoomFeed /><div className="s3-film-title-copy"><p>{t("s3.open.scenario")}</p><h1>{t("s3.open.title")}</h1><h2>{t("s3.open.subtitle")}</h2><span>1996 — 2026</span></div></div>;
    case "handoff": return null;
  }
}
