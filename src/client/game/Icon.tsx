// Line icons for the game interface, drawn on a 24px grid.
const PATHS: Record<string, string> = {
  MOVE: "M4 12h13M13 6l6 6-6 6",
  INVESTIGATE: "M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5 21 21",
  SEARCH: "M5 9h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8zM9 9V7a3 3 0 0 1 6 0v2",
  REPAIR: "M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.7-7.7M5 5l3 3",
  HELP: "M7 11v-1a2 2 0 0 1 4 0v4M11 10V8a2 2 0 0 1 4 0v5M15 11a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3a1.8 1.8 0 0 1 3-2l1 1",
  TRADE: "M4 8h13l-3-3M20 16H7l3 3",
  STABILIZE: "M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10zM8 12h2l1-2 2 4 1-2h2",
  CONFRONT: "M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.6 1.5-3.5C10 10 11 9 12 3zM12 21v-2",
  USE_SKILL: "M12 2l2.4 6.6L21 9.3l-5 4.4 1.5 6.8L12 17l-5.5 3.5L8 13.7 3 9.3l6.6-.7z",
  USE_ITEM: "M6 8h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM9 8V6a3 3 0 0 1 6 0v2M10 13h4",
  END_TURN: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9",
  LOG: "M5 5h14M5 10h14M5 15h9M5 20h6",
  SECRET: "M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  LOCK: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  SOUND: "M5 9v6h3l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  MUTE: "M5 9v6h3l5 4V5L8 9zM17 9l4 6M21 9l-4 6",
  CLOSE: "M6 6l12 12M18 6 6 18",
  ANCHOR: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 6v15M5 13a7 7 0 0 0 14 0M8 10h8",
  FRAGMENT: "M12 2 20 8l-3 12H7L4 8z",
  INSPECTOR: "M12 3a4 4 0 0 1 4 4v2H8V7a4 4 0 0 1 4-4zM6 9h12M8 13h8l1 8H7z",
  // scenario 02's actions
  OPERATE: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1",
  RESCUE: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
  SALVAGE: "M3 16q3-3 6 0t6 0 6 0M7 13V7l5-3 5 3v6M12 4v9",
  INSTALL: "M4 15h16l-2 5H6zM8 15V9h8v6M12 3v6M9 6l3 3 3-3",
  REGISTER: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  RESTART_GENERATOR: "M13 2 4 14h7l-1 8 9-12h-7z",
  SHARE_INTEL: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  DICE: "M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01",
  KEY: "M8 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h9M18 12v3M21 12v2",
};

export function Icon({ name, size = 22, className = "" }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.USE_SKILL} />
    </svg>
  );
}
