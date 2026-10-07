// The run. Layout follows the four layers: what's happening (banner), what I
// can do (dock), what others are doing (train + passenger strip), and rules /
// history (drawers).
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import type { PublicPlayerState } from "../../shared/game/state.ts";
import { Banner } from "../game/Banner.tsx";
import { DecisionLayer } from "../game/Decision.tsx";
import { DiceOverlay } from "../game/Dice.tsx";
import { Dock, type Mode } from "../game/Dock.tsx";
import { CarriageInfo } from "../game/CarriageInfo.tsx";
import { CueFeed } from "../game/CueFeed.tsx";
import { HostSkip } from "../game/HostSkip.tsx";
import { InspectorLine, Objective } from "../game/Objective.tsx";
import { EventPanel } from "../game/EventPanel.tsx";
import { LogDrawer } from "../game/LogDrawer.tsx";
import { PlayerSheet } from "../game/PlayerSheet.tsx";
import { PlayersStrip } from "../game/PlayersStrip.tsx";
import { SecretsDrawer } from "../game/SecretsDrawer.tsx";
import { SequenceOverlay } from "../game/Sequence.tsx";
import { TopBar } from "../game/TopBar.tsx";
import { Train } from "../game/Train.tsx";
import { sendGame, useGame } from "../store.ts";

export function Game() {
  const g = useGame();
  const [mode, setMode] = useState<Mode>(null);
  const [drawer, setDrawer] = useState<null | "log" | "secrets">(null);
  const [sheet, setSheet] = useState<PublicPlayerState | null>(null);
  if (!g) return null;

  const move = g.myActions.find((a) => a.type === "MOVE");
  const moveTargets = mode === "MOVE" && move?.enabled ? (move.targets ?? []).map(Number) : [];
  const secrets = g.mySecrets ? g.mySecrets.messages.length + g.mySecrets.dreamCards.length + g.mySecrets.peeks.length : 0;

  return (
    <main className="night-sky relative flex min-h-dvh flex-col">
      <TopBar g={g} onLog={() => setDrawer("log")} onSecrets={() => setDrawer("secrets")} secretsCount={secrets} />
      <Banner g={g} />
      <Objective g={g} />
      <InspectorLine g={g} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 py-1">
        <Train
          g={g}
          moveTargets={moveTargets}
          onPick={(i) => {
            setMode(null);
            void sendGame({ type: "MOVE", toCarriage: i });
          }}
        />
        <CarriageInfo g={g} />
        <EventPanel g={g} />
        <PlayersStrip g={g} onOpen={setSheet} />
      </div>
      <Dock g={g} mode={mode} setMode={setMode} />

      <CueFeed g={g} />
      <DiceOverlay g={g} />
      <DecisionLayer g={g} />
      <HostSkip g={g} />
      <AnimatePresence>{g.sequence && g.sequence.kind !== "INTRO" && g.sequence.kind !== "ENDING" && <SequenceOverlay key={g.sequence.kind} g={g} />}</AnimatePresence>
      <AnimatePresence>
        {drawer === "log" && <LogDrawer key="log" g={g} onClose={() => setDrawer(null)} />}
        {drawer === "secrets" && <SecretsDrawer key="secrets" g={g} onClose={() => setDrawer(null)} />}
        {sheet && <PlayerSheet key="sheet" g={g} p={sheet} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </main>
  );
}
