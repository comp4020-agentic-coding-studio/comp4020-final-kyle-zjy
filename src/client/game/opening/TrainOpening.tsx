import { useT } from "../../i18n/index.ts";
import { Icon } from "../Icon.tsx";
import { OpeningTitle } from "./OpeningTitle.tsx";

export function Carriage({ arriving = false, doors = false }: { arriving?: boolean; doors?: boolean }) {
  return <div className={`opening-rail-world ${arriving ? "is-arriving" : ""} ${doors ? "doors-open" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 800 340">
      <path className="rail-tunnel" d="M0 0H800V340H0Z" />
      <path className="rail-track" d="M0 330 350 160M800 330 450 160M80 310H720M165 275H635M250 240H550" />
      <g className="rail-car"><path d="M85 92Q85 65 112 65H688Q715 65 715 92V270H85Z" /><path d="M85 238H715M85 260H715" />
        {[120, 245, 485, 610].map((x) => <g key={x}><rect className="rail-window" x={x} y="100" width="75" height="85" rx="6" /><path className="rail-seat" d={`M${x + 5} 169h65v20h-65z`} /></g>)}
        <g className="rail-door-left"><path d="M340 88H400V250H340Z" /><rect x="353" y="108" width="32" height="75" rx="3" /></g>
        <g className="rail-door-right"><path d="M400 88H460V250H400Z" /><rect x="415" y="108" width="32" height="75" rx="3" /></g>
        <path className="rail-fluorescent" d="M120 72H306V75H120ZM494 72H680V75H494Z" />
        <circle className="rail-headlight" cx="102" cy="215" r="5" /><circle className="rail-headlight" cx="698" cy="215" r="5" />
        <path className="rail-rack" d="M117 92H310M490 92H683" /><path className="rail-brake" d="M693 100v30h-10" />
      </g>
      <path className="rail-platform" d="M0 290H800V340H0Z" /><path className="rail-platform-edge" d="M0 294H800" />
    </svg>
  </div>;
}

function Phones({ elapsed }: { elapsed: number }) {
  const t = useT();
  return <div className="opening-phones"><div className="phone-constellation" aria-hidden="true"><i /><i /><i /></div>
    {[0, 1, 2].map((index) => <div key={index} className={`opening-phone ${elapsed >= index * 1.1 ? "is-lit" : ""}`}>
      <div className="phone-notch" aria-hidden="true" /><p className="phone-clock">00:17</p><div className="phone-notification"><span aria-hidden="true">↳</span><h2>{t("o1.arrival")}</h2></div>
      <ul className={elapsed < 3 ? "film-concealed" : ""}><li>{t("o1.route")}</li><li>{t("o1.number")}</li><li>{t("o1.station")}</li></ul>
    </div>)}
  </div>;
}

export function TrainOpening({ id, elapsed }: { id: string; elapsed: number }) {
  const t = useT();
  switch (id) {
    case "time": return <div className="opening-train-clock"><strong>00:17</strong><p className={elapsed < 3 ? "film-concealed" : ""}>{t("o1.lastService")}</p><div className="rail-signal" aria-hidden="true" /></div>;
    case "phones": return <Phones elapsed={elapsed} />;
    case "arrival": return <Carriage arriving doors={elapsed > 4.5} />;
    case "tickets": return <div className={`opening-tickets ${elapsed > 3 ? "is-turned" : ""}`}><i aria-hidden="true" /><i aria-hidden="true" /><article className="rail-paper"><div className="ticket-perforation" aria-hidden="true" /><p>{elapsed > 3 ? t("o1.ticketBack") : t("o1.ticket")}</p><span>00:17 &nbsp; / &nbsp; N13</span><div className="ticket-punches" aria-hidden="true">○ ○ ○ ○ ○ ○</div></article></div>;
    case "manifest": return <div className="opening-manifest"><Carriage /><article><p className="opening-kicker">{t("o1.manifest")}</p><strong>{t("o1.count", { n: elapsed > 4 && elapsed < 5.5 ? 5 : 6 })}</strong><div className="manifest-lines" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i}><i />— — — —</span>)}</div><p className={elapsed < 4 ? "film-concealed" : "manifest-error"}>{t("o1.error")}</p><small>{t("o1.illustration")}</small></article></div>;
    case "memory": return <div className="opening-memory"><p className="opening-kicker">{t("o1.fragment")}</p><div className="memory-grid">{(["call", "photo", "scarf", "umbrella", "punch", "blank"] as const).map((name, i) => <div key={name} className={`memory-object memory-${name} ${elapsed >= i * .8 ? "is-recalled" : ""}`}><div aria-hidden="true">{name === "scarf" ? <i /> : name === "umbrella" ? <svg viewBox="0 0 80 80"><path d="M9 36a31 27 0 0 1 62 0Q55 28 40 36 25 28 9 36ZM40 36V64q0 15-13 9" /></svg> : <Icon name={name === "call" ? "INTERACT_NPC" : name === "photo" ? "SECRET" : "REGISTER"} size={48} />}</div><p>{t(`o1.memory.${name}`)}</p></div>)}</div></div>;
    case "protocol": return <div className="rail-protocol"><p className="opening-kicker">{t("o1.protocol")}</p><ol>{(["explore", "memory", "anchors", "leave"] as const).map((task, i) => <li key={task} className={elapsed < i ? "film-concealed" : ""}><span>0{i + 1}</span>{t(`o1.task.${task}`)}</li>)}</ol></div>;
    case "title": return <OpeningTitle number="01" title="o1.title" subtitle="o1.subtitle"><Carriage /></OpeningTitle>;
    default: return null;
  }
}
