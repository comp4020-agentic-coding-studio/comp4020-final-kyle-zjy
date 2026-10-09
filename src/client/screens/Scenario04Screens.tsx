import { AnimatePresence } from "motion/react";
import { useState } from "react";
import type { PublicPlayerState } from "../../shared/game/state.ts";
import { Banner } from "../game/Banner.tsx";
import { CueFeed } from "../game/CueFeed.tsx";
import { DecisionLayer } from "../game/Decision.tsx";
import { DiceOverlay } from "../game/Dice.tsx";
import { Dock, type Mode } from "../game/Dock.tsx";
import { EventPanel } from "../game/EventPanel.tsx";
import { HostSkip } from "../game/HostSkip.tsx";
import { LogDrawer } from "../game/LogDrawer.tsx";
import { PlayerSheet } from "../game/PlayerSheet.tsx";
import { PlayersStrip } from "../game/PlayersStrip.tsx";
import { SecretsDrawer } from "../game/SecretsDrawer.tsx";
import { AuctionTable04 } from "../game/scenario04/AuctionTable04.tsx";
import { DOCK04 } from "../game/scenario04/dock04.tsx";
import { Objective04, PlacePanel04, TopBar04 } from "../game/scenario04/Panels04.tsx";
import { Private04 } from "../game/scenario04/Private04.tsx";
import { useFormat, useT } from "../i18n/index.ts";
import { sendGame, sendLobby, useGame, useMe } from "../store.ts";

function Frame({ children }: { children: React.ReactNode }) {
  return <main className="night-sky relative min-h-dvh px-3 py-5 text-moon sm:px-6"><div className="mx-auto max-w-5xl">{children}</div></main>;
}

export function Scenario04Intro() {
  const g = useGame();
  const t = useT();
  if (!g) return null;
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  return <Frame><section className="tarot mx-auto mt-10 max-w-xl p-6 text-center">
    <p className="label text-signal">{t("s4.top.act")}</p>
    <h1 className="mt-4 font-display text-4xl text-gold-bright">{t("s4.title")}</h1>
    <p className="mt-3 text-mist italic">{t("s4.subtitle")}</p>
    <p className="mt-8 text-lg">{t("s4.intro")}</p>
    <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>{acked ? t("s4.waiting") : t("s4.begin")}</button>
  </section><HostSkip g={g} /></Frame>;
}

export function Scenario04Game() {
  const g = useGame();
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);
  const [drawer, setDrawer] = useState<null | "log" | "secrets">(null);
  const [sheet, setSheet] = useState<PublicPlayerState | null>(null);
  if (!g?.auction) return null;
  const mine = g.auction.players[g.viewerId];
  return <main className="night-sky relative flex min-h-dvh flex-col">
    <TopBar04 g={g} onLog={() => setDrawer("log")} onSecrets={() => setDrawer("secrets")} secretsCount={mine?.privateIntel?.length ?? 0} />
    <Banner g={g} />
    <Objective04 />
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 py-1">
      <AuctionTable04 g={g} />
      <PlacePanel04 />
      <EventPanel g={g} />
      <PlayersStrip g={g} onOpen={setSheet} tag={(id) => <><span>{t("s4.table.debt", { n: g.auction!.players[id].debt })}</span>{g.auction!.players[id].passed && <span className="text-ember">{t("s4.table.passed")}</span>}</>} />
    </div>
    <Dock g={g} mode={mode} setMode={setMode} extension={DOCK04} />
    <CueFeed g={g} />
    <DiceOverlay g={g} />
    <DecisionLayer g={g} />
    <HostSkip g={g} />
    <AnimatePresence>
      {drawer === "log" && <LogDrawer key="log" g={g} title={t("s4.top.log")} onClose={() => setDrawer(null)} />}
      {drawer === "secrets" && <SecretsDrawer key="secrets" g={g} sections={<Private04 g={g} />} onClose={() => setDrawer(null)} />}
      {sheet && <PlayerSheet key="sheet" g={g} p={sheet} onClose={() => setSheet(null)} />}
    </AnimatePresence>
  </main>;
}

export function Scenario04Ending() {
  const g = useGame();
  const t = useT();
  if (!g) return null;
  const type = g.outcome === "S04_EXIT" ? "exit" : g.outcome === "S04_DEBT" ? "debt" : "unsold";
  const acked = g.sequence?.acks.includes(g.viewerId) ?? false;
  return <Frame><section className="tarot mx-auto mt-16 max-w-xl p-6 text-center">
    <h1 className="font-display text-4xl text-gold-bright">{t(`s4.ending.${type}.title`)}</h1>
    <p className="mt-4 text-mist">{t(`s4.ending.${type}.body`)}</p>
    <button className="btn btn-gold mt-8 w-full" disabled={acked} onClick={() => void sendGame({ type: "ACK_SEQUENCE" })}>{acked ? t("s4.waiting") : t("s4.results")}</button>
  </section><HostSkip g={g} /></Frame>;
}

export function Scenario04Results() {
  const g = useGame();
  const me = useMe();
  const t = useT();
  const fmt = useFormat();
  if (!g?.auction) return null;
  return <Frame><section className="tarot mx-auto mt-16 max-w-xl p-6 text-center">
    <h1 className="font-display text-4xl text-gold-bright">{t("s4.results")}</h1>
    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{g.results?.map((result) => <div key={result.playerId} className="min-w-0 rounded-xl border border-gold/20 p-3 text-left text-sm"><p className="text-gold-bright">{g.players[result.playerId].nickname} · {fmt(result.title)}</p>{result.highlights.map((line, index) => <p key={index} className="mt-1 text-mist">{fmt(line)}</p>)}</div>)}</div>
    {me?.isHost ? <button className="btn btn-gold mt-8 w-full" onClick={() => void sendLobby({ type: "RESTART" })}>{t("s4.results.back")}</button> : <p className="mt-8 text-sm text-mist">{t("s4.results.wait")}</p>}
  </section></Frame>;
}
