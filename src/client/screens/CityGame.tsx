// Scenario 02's run: the same four layers as scenario 01 (what's happening,
// what I can do, what others are doing, rules and history), with the sinking
// city in the middle instead of the train.
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import type { PublicPlayerState } from "../../shared/game/state.ts";
import { Banner } from "../game/Banner.tsx";
import { CityObjective, CityTopBar } from "../game/city/CityTopBar.tsx";
import { HexCityMap } from "../game/city/HexCityMap.tsx";
import { ZonePanel } from "../game/city/ZonePanel.tsx";
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
import { SequenceOverlay } from "../game/Sequence.tsx";
import { useT } from "../i18n/index.ts";
import { sendGame, useGame } from "../store.ts";

export function CityGame() {
  const g = useGame();
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);
  const [drawer, setDrawer] = useState<null | "log" | "secrets">(null);
  const [sheet, setSheet] = useState<PublicPlayerState | null>(null);
  const [looking, setLooking] = useState<number | null>(null);
  if (!g?.city) return null;

  const mine = g.players[g.viewerId]?.carriageIndex ?? g.city.startZone;
  const move = g.myActions.find((a) => a.type === "MOVE");
  const moveTargets = mode === "MOVE" && move?.enabled ? (move.targets ?? []).map(Number) : [];
  const secrets = g.mySecrets ? g.mySecrets.peeks.length : 0;
  // aboard: locked in, no more turns; the city, the log and the drawers stay open to watch the end
  const aboard = g.city.boat.aboard.includes(g.viewerId);

  return (
    <main className="night-sky relative flex min-h-dvh flex-col">
      <CityTopBar g={g} onLog={() => setDrawer("log")} onSecrets={() => setDrawer("secrets")} secretsCount={secrets} />
      <Banner g={g} />
      <CityObjective g={g} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 py-1">
        <HexCityMap
          g={g}
          selected={looking ?? mine}
          onSelect={(z) => setLooking(z === mine ? null : z)}
          moveTargets={moveTargets}
          onMove={(z) => {
            setMode(null);
            setLooking(null);
            void sendGame({ type: "MOVE", toCarriage: z });
          }}
        />
        <ZonePanel g={g} zone={looking ?? mine} onBack={() => setLooking(null)} />
        <EventPanel g={g} />
        <PlayersStrip g={g} onOpen={setSheet} />
      </div>
      {aboard ? (
        <section className="safe-bottom sticky bottom-0 z-20 border-t border-gold/20 bg-[#05060d]/90 px-4 py-4 text-center backdrop-blur-md" role="status">
          <p className="label text-moss">{t("s2.aboard.title")}</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-moon">{t("s2.aboard.notice")}</p>
        </section>
      ) : (
        <Dock g={g} mode={mode} setMode={setMode} />
      )}

      <CueFeed g={g} />
      <DiceOverlay g={g} />
      <DecisionLayer g={g} />
      <HostSkip g={g} />
      <AnimatePresence>{g.sequence && !g.pending.length && g.sequence.kind !== "INTRO" && g.sequence.kind !== "ENDING" && <SequenceOverlay key={`${g.sequence.kind}${g.sequence.stage ?? ""}`} g={g} />}</AnimatePresence>
      <AnimatePresence>
        {drawer === "log" && <LogDrawer key="log" g={g} onClose={() => setDrawer(null)} />}
        {drawer === "secrets" && <SecretsDrawer key="secrets" g={g} onClose={() => setDrawer(null)} />}
        {sheet && <PlayerSheet key="sheet" g={g} p={sheet} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </main>
  );
}
