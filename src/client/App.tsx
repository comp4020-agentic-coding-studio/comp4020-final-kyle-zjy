import { MotionConfig } from "motion/react";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Toasts } from "./components/Toasts.tsx";
import { roomCodeFromPath, usePath } from "./router.ts";
import { Landing } from "./screens/Landing.tsx";
import { RoomGate } from "./screens/RoomGate.tsx";

export function App() {
  const path = usePath();
  const code = roomCodeFromPath(path);
  return (
    // "user" honours prefers-reduced-motion for every animation at once
    <MotionConfig reducedMotion="user">
      <div className="grain">
        <ErrorBoundary>{code ? <RoomGate key={code} code={code} /> : <Landing />}</ErrorBoundary>
        <Toasts />
      </div>
    </MotionConfig>
  );
}
