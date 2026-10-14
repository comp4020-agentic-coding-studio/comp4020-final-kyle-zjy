import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGame, useStore } from "../store.ts";
import { RoomGate } from "../screens/RoomGate.tsx";
import { navigate } from "../router.ts";
import { useT, type MessageKey } from "../i18n/index.ts";
import { SecretsDrawer } from "../game/SecretsDrawer.tsx";
import { Private03 } from "../game/scenario03/Private03.tsx";
import { Private04 } from "../game/scenario04/Private04.tsx";
import { Drawer } from "../game/Drawer.tsx";
import { StoryRecap03 } from "../game/scenario03/Private03.tsx";
import { checkPath, savedChecks } from "./session.ts";
import { AuctionSandbox04 } from "./AuctionSandbox04.tsx";
import { HouseRuleSandbox04 } from "./HouseRuleSandbox04.tsx";
import "../styles/developer.css";

export default function DeveloperRoom({ code, seat }: { code: string; seat: number }) {
  const t = useT();
  const run = savedChecks().find((run) => run.seats[0].roomCode === code);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const g = useGame();
  const status = useStore((s) => s.status);
  const roomPhase = useStore((s) => s.snapshot?.room.phase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [inspection, setInspection] = useState<null | "private" | "story">(null);
  const ready = g?.sessionId === run?.sessionId && g?.flags.developerCheck === 1 && g?.viewerId === run?.seats[seat].playerId;
  useLayoutEffect(() => {
    if (!bar.current || !root.current) return;
    const measure = () => root.current?.style.setProperty("--developer-bar-height", `${bar.current!.getBoundingClientRect().height}px`);
    measure(); const observer = new ResizeObserver(measure); observer.observe(bar.current);
    return () => observer.disconnect();
  }, [run?.sessionId]);
  useEffect(() => {
    if (!ready) return;
    setInspection(run?.presetId === "s3.recap" ? "story" : run?.presetId === "s4.private" ? "private" : null);
  }, [ready, run?.sessionId, seat]);
  useEffect(() => { if (status === "online" && roomPhase === "LOBBY") navigate("/developer"); }, [status, roomPhase]);
  if (!run) return <main className="night-sky developer-page"><p>{t("developer.missing")}</p><button className="btn btn-ghost" onClick={() => navigate("/developer")}>{t("developer.back")}</button></main>;
  const advance = async () => {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/developer/rooms/${code}/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionToken: run.seats[seat].sessionToken }) });
      if (!response.ok) throw new Error("Cannot advance test room");
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  return <div ref={root} className="developer-room">
    <header ref={bar} className="developer-bar">
      <div className="developer-bar-title"><span className="label text-signal">{t("developer.heading")}</span><p>{t(`developer.${run.presetId}.label` as MessageKey)}</p></div>
      <div className="developer-bar-actions">
        <button className="btn btn-ghost" onClick={() => navigate("/developer")}>{t("developer.back")}</button>
        <label>{t("developer.seat")}<select className="field" value={seat} onChange={(e) => { setInspection(null); navigate(checkPath(run, Number(e.target.value))); }}>{run.seats.map((s, i) => <option key={s.playerId} value={i}>{i + 1} · {s.nickname}</option>)}</select></label>
        <details className="developer-tools"><summary className="btn btn-ghost">{t("developer.controls")}</summary><div className="developer-tools-panel"><p>{t("developer.manual")}</p><div className="developer-tool-grid">        <a className="btn btn-ghost" href={checkPath(run, (seat + 1) % 3)} target="_blank" rel="noreferrer">{t("developer.openSeat")}</a>
        <button className="btn btn-ghost" disabled={busy || !ready || g?.phase === "RESULTS"} onClick={() => void advance()}>{t("developer.advance")}</button>
        {ready && g?.temporal && <button className="btn btn-ghost" onClick={() => setInspection("story")}>{t("developer.recap")}</button>}
        {ready && <button className="btn btn-ghost" onClick={() => setInspection("private")}>{t("developer.private")}</button>}</div>{ready && g?.auction && <><AuctionSandbox04 g={g} /><HouseRuleSandbox04 g={g} /></>}</div></details>
      </div>
      <p className="developer-manual">{t("developer.manualShort")}</p>
      {error && <p role="alert" className="developer-error">{t("developer.error")}</p>}
    </header>
    <RoomGate key={`${code}:${seat}`} code={code} token={run.seats[seat].sessionToken} viewerId={run.seats[seat].playerId} />
    {ready && g && inspection === "private" && <SecretsDrawer key={`${code}:${seat}:private`} g={g} onClose={() => setInspection(null)} sections={g.temporal ? <Private03 g={g} /> : g.auction ? <Private04 g={g} /> : undefined} />}
    {ready && g?.temporal && inspection === "story" && <Drawer title={t("developer.recap")} onClose={() => setInspection(null)}><StoryRecap03 g={g} /></Drawer>}
  </div>;
}
