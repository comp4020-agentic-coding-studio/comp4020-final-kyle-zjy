// The top bar of a run on the city layout (scenarios 02 and 03): the act and
// round on the left, the table's shared pressure (a 12-step gauge, in numbers
// too) with the scenario's own chips under it, and the secrets and log
// drawers on the right. Plus the one-line objective under the turn banner.
import type { ReactNode } from "react";
import { useT } from "../i18n/index.ts";
import { Icon } from "./Icon.tsx";

export function RunTopBar({
  act,
  round,
  gauge,
  children,
  onLog,
  onSecrets,
  secretsCount,
  logLabel,
}: {
  act: string;
  round: string;
  /** The shared pressure: its label, value and maximum, and the colour of each filled step. */
  gauge: { label: string; value: number; max: number; fill: (step: number) => string };
  /** The scenario's chips under the gauge. */
  children: ReactNode;
  onLog: () => void;
  onSecrets: () => void;
  secretsCount: number;
  logLabel: string;
}) {
  const t = useT();
  return (
    <header className="safe-top relative z-20 border-b border-gold/15 bg-[#05060d]/85 px-3 py-2 backdrop-blur-md sm:px-4">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 max-w-[30%] shrink">
          <p className="label truncate text-[10px] text-signal">{act}</p>
          <p className="font-mono text-lg leading-tight text-moon">{round}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label text-[10px] text-mist">{gauge.label}</span>
            <span className="font-mono text-sm text-moon">
              {gauge.value} / {gauge.max}
            </span>
          </div>
          <div className="mt-1 grid grid-cols-12 gap-0.5" aria-hidden="true">
            {Array.from({ length: gauge.max }, (_, i) => (
              <span key={i} className={`h-1.5 rounded-sm ${i < gauge.value ? gauge.fill(i) : "bg-indigo"}`} />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">{children}</div>
        </div>
        <button className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/30 text-mist hover:text-moon" onClick={onSecrets} aria-label={t("game.secretsAria", { n: secretsCount })}>
          <Icon name="SECRET" size={20} />
          {secretsCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet px-1 font-mono text-[10px] text-white">{secretsCount}</span>}
        </button>
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/30 text-mist hover:text-moon" onClick={onLog} aria-label={logLabel}>
          <Icon name="LOG" size={20} />
        </button>
      </div>
    </header>
  );
}

/** What the table is working toward now, in one line. */
export function ObjectiveLine({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <p className="mx-auto mt-1 flex max-w-6xl items-baseline gap-2 px-3 text-xs sm:px-4">
      <span className="label shrink-0 text-[10px] text-signal">{t("objective.label")}</span>
      <span className="min-w-0 flex-1 text-mist">{children}</span>
    </p>
  );
}

/** The selected place on the map (a zone, a room): what it is, its state, what is there, who is there. */
export function PlacePanel({
  ariaLabel,
  kicker,
  name,
  meta,
  flag,
  children,
  back,
}: {
  ariaLabel: string;
  kicker: string;
  name: string;
  meta: ReactNode;
  flag?: ReactNode;
  children: ReactNode;
  back?: { label: string; onClick: () => void };
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-3 sm:px-4" aria-label={ariaLabel}>
      <div className="rounded-xl border border-gold/20 bg-[#0b1028]/80 px-3 py-2 text-xs">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="label shrink-0 text-[10px] text-signal">{kicker}</span>
          <span className="min-w-0 font-display text-base text-moon">{name}</span>
          <span className="font-mono text-[10px] text-mist">{meta}</span>
          {flag}
        </div>
        {children}
        {back && (
          <button className="btn btn-ghost mt-1 min-h-12 text-xs" onClick={back.onClick}>
            {back.label}
          </button>
        )}
      </div>
    </section>
  );
}
