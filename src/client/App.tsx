import { lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Toasts } from "./components/Toasts.tsx";
import { developerRoomFromPath, roomCodeFromPath, usePath } from "./router.ts";
import { Landing } from "./screens/Landing.tsx";
import { RoomGate } from "./screens/RoomGate.tsx";

const ToolboxScreen = lazy(() => import("./toolbox/ToolboxScreen.tsx"));
const DeveloperCheck = lazy(() => import("./developer/DeveloperCheck.tsx"));
const DeveloperRoom = lazy(() => import("./developer/DeveloperRoom.tsx"));

export function App() {
  const path = usePath();
  const code = roomCodeFromPath(path);
  const check = developerRoomFromPath(path);
  const tools = /^\/tools\/([a-zA-Z0-9]{6})\/?$/.exec(path)?.[1]?.toUpperCase();
  return (
    // "user" honours prefers-reduced-motion for every animation at once
    <MotionConfig reducedMotion="user">
      <div className="grain">
        <ErrorBoundary><Suspense fallback={<div className="night-sky min-h-dvh" aria-busy="true" />}>{tools ? <ToolboxScreen key={tools} code={tools} /> : check ? <DeveloperRoom code={check.code} seat={check.seat} /> : path === "/developer" || path === "/developer/" ? <DeveloperCheck /> : code ? <RoomGate key={code} code={code} /> : <Landing />}</Suspense></ErrorBoundary>
        <Toasts />
      </div>
    </MotionConfig>
  );
}
