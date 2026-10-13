// Game and developer-check routes share a small History API router.
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};

export const usePath = (): string => useSyncExternalStore(subscribe, () => location.pathname);

export function navigate(path: string, replace = false): void {
  if (path === "/" && location.pathname.startsWith("/developer/room/")) path = "/developer";
  if (path === location.pathname) return;
  history[replace ? "replaceState" : "pushState"](null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export const roomCodeFromPath = (path: string): string | null =>
  path.match(/^\/room\/([A-Za-z0-9]{6})\/?$/)?.[1]?.toUpperCase() ?? null;

export function developerRoomFromPath(path: string): { code: string; seat: number } | null {
  const match = path.match(/^\/developer\/room\/([A-Za-z0-9]{6})\/([0-2])\/?$/);
  return match ? { code: match[1].toUpperCase(), seat: Number(match[2]) } : null;
}
