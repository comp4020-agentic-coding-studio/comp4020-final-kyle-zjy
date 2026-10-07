// EN / 中文: shown on the platform and in the lobby only. Once the run departs
// the language is locked (setLocale refuses), so the switch isn't rendered
// on the run's screens at all.
import type { Locale } from "../../shared/i18n/types.ts";
import { setLocale, useLocale, useT } from "../i18n/index.ts";

// Each language is named in itself (an autonym), whatever the current locale.
const OPTIONS: { locale: Locale; label: string; lang: string }[] = [
  { locale: "en", label: "EN", lang: "en" },
  { locale: "zh-CN", label: "中文", lang: "zh-CN" },
];

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  return (
    <div role="group" aria-label={t("common.language")} className={`flex shrink-0 items-center rounded-full border border-gold/30 bg-[#05060d]/70 p-0.5 ${className}`}>
      {OPTIONS.map((o) => {
        const on = o.locale === locale;
        return (
          <button
            key={o.locale}
            type="button"
            lang={o.lang}
            aria-pressed={on}
            onClick={() => setLocale(o.locale)}
            className={`flex min-h-12 min-w-12 items-center justify-center rounded-full px-3 text-xs font-bold tracking-wider transition-colors ${
              on ? "bg-gold/90 text-[#1a1206]" : "text-mist hover:text-moon"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
