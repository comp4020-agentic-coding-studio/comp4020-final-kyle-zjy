import type { ReactNode } from "react";
import { useT, type MessageKey } from "../../i18n/index.ts";

export function OpeningTitle({ number, title, subtitle, children }: { number: string; title: MessageKey; subtitle?: MessageKey; children: ReactNode }) {
  const t = useT();
  return <div className="opening-title">
    <div className="opening-title-world" aria-hidden="true">{children}</div>
    <div className="opening-title-copy"><p>{t("opening.scenario", { n: number })}</p><h1>{t(title)}</h1>{subtitle && <h2>{t(subtitle)}</h2>}</div>
  </div>;
}
