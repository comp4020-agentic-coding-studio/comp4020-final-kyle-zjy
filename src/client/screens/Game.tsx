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
import { EscapeSequence } from "../game/EscapeSequence.tsx";
import { Icon } from "../game/Icon.tsx";
import { MemoryBoard } from "../game/MemoryBoard.tsx";
import { Moments01 } from "../game/Moments01.tsx";
import { IdentityCheck01 } from "../game/IdentityCheck01.tsx";
import { useT } from "../i18n/index.ts";

export function Game() {
  const g = useGame();
  const [mode, setMode] = useState<Mode>(null);
  const [drawer, setDrawer] = useState<null | "log" | "secrets" | "memory">(null);
  const [sheet, setSheet] = useState<PublicPlayerState | null>(null);
  const t = useT();
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
      <button className="mx-auto mt-1 flex min-h-12 items-center gap-2 rounded-full border border-violet/40 px-4 text-xs text-violet-soft" onClick={() => setDrawer("memory")}>
        <Icon name="FRAGMENT" size={16} />
        {t("memory.open", { n: g.fragments.length, core: g.coreMemories })}
      </button>
      <EscapeSequence g={g} />
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
      <Moments01 g={g} />
      <IdentityCheck01 g={g} />
      <AnimatePresence>{g.sequence && g.sequence.kind !== "INTRO" && g.sequence.kind !== "ENDING" && <SequenceOverlay key={g.sequence.kind} g={g} />}</AnimatePresence>
      <AnimatePresence>
        {drawer === "log" && <LogDrawer key="log" g={g} onClose={() => setDrawer(null)} />}
        {drawer === "secrets" && <SecretsDrawer key="secrets" g={g} onClose={() => setDrawer(null)} />}
        {drawer === "memory" && <MemoryBoard key="memory" g={g} onClose={() => setDrawer(null)} />}
        {sheet && <PlayerSheet key="sheet" g={g} p={sheet} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </main>
  );
}
