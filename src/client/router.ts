// Two client routes: "/" and "/room/:code". A tiny history router is enough.
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};

export const usePath = (): string => useSyncExternalStore(subscribe, () => location.pathname);

export function navigate(path: string, replace = false): void {
  if (path === location.pathname) return;
  history[replace ? "replaceState" : "pushState"](null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export const roomCodeFromPath = (path: string): string | null =>
  path.match(/^\/room\/([A-Za-z0-9]{6})\/?$/)?.[1]?.toUpperCase() ?? null;
