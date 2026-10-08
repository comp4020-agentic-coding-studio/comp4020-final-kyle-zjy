// /room/:code — connects, then shows the screen for the room's phase. Every
// connection state (connecting, offline, kicked, replaced, missing) has its
// own screen so nobody is left staring at a blank page.
import { motion } from "motion/react";
import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import type { GamePhase } from "../../shared/game/state.ts";
import { useT } from "../i18n/index.ts";
import { rich } from "../i18n/rich.ts";
import { navigate } from "../router.ts";
import { connectRoom, disconnectRoom, reconnect, useStore } from "../store.ts";
import { ConnectionBanner } from "../components/ConnectionBanner.tsx";
import { Landing } from "./Landing.tsx";
import { Lobby } from "./Lobby.tsx";

// The run's screens load on demand: the landing page and lobby stay light.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) => lazy(() => load().then((m) => ({ default: m[key] })));
const Intro = named(() => import("./Intro.tsx"), "Intro");
const Game = named(() => import("./Game.tsx"), "Game");
const CityGame = named(() => import("./CityGame.tsx"), "CityGame");
const Scenario03Game = named(() => import("./Scenario03Screens.tsx"), "Scenario03Game");
const Scenario03Intro = named(() => import("./Scenario03Screens.tsx"), "Scenario03Intro");
const Scenario03Ending = named(() => import("./Scenario03Screens.tsx"), "Scenario03Ending");
const Scenario03Results = named(() => import("./Scenario03Screens.tsx"), "Scenario03Results");
const Ending = named(() => import("./Ending.tsx"), "Ending");
const Results = named(() => import("./Results.tsx"), "Results");

/** A run's screen: the train or the city, by the run's scenario. */
function Run() {
  const scenario = useStore((s) => s.snapshot?.game?.scenarioId);
  return scenario === "S03_INCIDENT_ZERO" ? <Scenario03Game /> : scenario === "S02_SUNKEN_CITY" ? <CityGame /> : <Game />;
}

function ScenarioIntro() {
  const scenario = useStore((s) => s.snapshot?.game?.scenarioId);
  return scenario === "S03_INCIDENT_ZERO" ? <Scenario03Intro /> : <Intro />;
}
function ScenarioEnding() {
  const scenario = useStore((s) => s.snapshot?.game?.scenarioId);
  return scenario === "S03_INCIDENT_ZERO" ? <Scenario03Ending /> : <Ending />;
}
function ScenarioResults() {
  const scenario = useStore((s) => s.snapshot?.game?.scenarioId);
  return scenario === "S03_INCIDENT_ZERO" ? <Scenario03Results /> : <Results />;
}

// One screen per phase.
const SCREENS: Record<GamePhase, ComponentType> = {
  LOBBY: Lobby,
  INTRO: ScenarioIntro,
  ACT_1: Run,
  ACT_2: Run,
  ACT_3: Run,
  ACT_4: Run,
  ENDING: ScenarioEnding,
  RESULTS: ScenarioResults,
};

export function RoomGate({ code }: { code: string }) {
  const status = useStore((s) => s.status);
  const snapshot = useStore((s) => s.snapshot);
  const t = useT();

  useEffect(() => {
    connectRoom(code);
    return () => disconnectRoom();
  }, [code]);

  useEffect(() => {
    if (status === "left") navigate("/", true);
  }, [status]);

  if (status === "needs-join") return <Landing initialCode={code} />;
  if (status === "missing")
    return (
      <Notice title={t("gate.missing.title")} action={[t("gate.backToPlatform"), () => navigate("/")]}>
        {rich(t("gate.missing.body"), { code: <span className="font-mono text-gold-bright">{code}</span> })}
      </Notice>
    );
  if (status === "kicked")
    return (
      <Notice title={t("gate.kicked.title")} action={[t("gate.backToPlatform"), () => navigate("/")]}>
        {rich(t("gate.kicked.body"), { code: <span className="font-mono">{code}</span> })}
      </Notice>
    );
  if (status === "replaced")
    return (
      <Notice title={t("gate.replaced.title")} action={[t("gate.replaced.action"), reconnect]}>
        {t("gate.replaced.body")}
      </Notice>
    );
  if (!snapshot) return <Boarding reconnecting={status === "reconnecting"} />;

  // the room's phase can briefly lead the game snapshot; wait for the run to arrive
  if (snapshot.room.phase !== "LOBBY" && !snapshot.game) return <Boarding reconnecting={false} />;
  const Screen = SCREENS[snapshot.game?.phase ?? snapshot.room.phase];
  return (
    <>
      <ConnectionBanner />
      <Suspense fallback={<Boarding reconnecting={false} />}>
        <Screen />
      </Suspense>
    </>
  );
}

function Boarding({ reconnecting }: { reconnecting: boolean }) {
  const t = useT();
  return (
    <main className="night-sky flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center" aria-busy="true">
      <div className="flex gap-2" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-8 rounded-sm bg-signal"
            animate={{ opacity: [0.15, 1, 0.15] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
      <p className="led text-sm tracking-widest" role="status">
        {t(reconnecting ? "gate.reconnecting" : "gate.boarding")}
      </p>
    </main>
  );
}

function Notice({ title, children, action }: { title: string; children: ReactNode; action: [string, () => void] }) {
  return (
    <main className="night-sky vignette flex min-h-dvh items-center justify-center px-4">
      <motion.div className="tarot relative z-10 w-full max-w-md p-6 text-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-semibold text-gold-bright">{title}</h1>
        <p className="mt-3 text-mist">{children}</p>
        <button className="btn btn-gold mt-6 w-full" onClick={action[1]}>
          {action[0]}
        </button>
      </motion.div>
    </main>
  );
}
