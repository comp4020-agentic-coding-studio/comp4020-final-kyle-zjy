import { useState } from "react";
import { LOTS04 } from "../../shared/game/scenario04/lots.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { auctionLotText } from "../../shared/i18n/scenario04.ts";
import { useLocale, useT } from "../i18n/index.ts";
import { sendGame } from "../store.ts";

const shortcuts = ["LOT_13", "LOT_17", "LOT_18", "LOT_25", "LOT_27", "LOT_30"] as const;

export function AuctionSandbox04({ g }: { g: PlayerView }) {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState<(typeof LOTS04)[number]["id"]>("LOT_11");
  const [counterfeit, setCounterfeit] = useState(false);
  const pool = g.auction?.debugPool;
  const grant = (lotId: `LOT_${string}`) => void sendGame({ type: "DEV_GRANT_LOT", lotId, counterfeit });
  return <section className="mt-4 min-w-0 border-t border-gold/30 pt-3" aria-label={t("s4.sandbox.title")}>
    <h3 className="font-display text-lg text-gold-bright">{t("s4.sandbox.title")}</h3>
    <label className="mt-2 block text-xs">{t("s4.sandbox.choose")}
      <select className="field mt-1 w-full" value={selected} onChange={(event) => setSelected(event.target.value as `LOT_${string}`)}>{LOTS04.filter((lot) => lot.id !== "LOT_10").map((lot) => <option key={lot.id} value={lot.id}>{auctionLotText(locale, lot.id).name} · {lot.category}</option>)}</select>
    </label>
    <div className="mt-2 grid grid-cols-2 gap-2">{([false, true] as const).map((fake) => <button key={String(fake)} className={`btn min-h-12 ${counterfeit === fake ? "btn-gold" : "btn-ghost"}`} onClick={() => setCounterfeit(fake)}>{t(fake ? "s4.sandbox.fake" : "s4.sandbox.genuine")}</button>)}</div>
    <button className="btn btn-gold mt-2 min-h-12 w-full" onClick={() => grant(selected)}>{t("s4.sandbox.grant")}</button>
    <p className="mt-3 text-xs">{t("s4.sandbox.shortcuts")}</p>
    <div className="mt-1 grid grid-cols-2 gap-2">{shortcuts.map((id) => <button key={id} className="btn btn-ghost min-h-12 h-auto whitespace-normal text-xs" onClick={() => grant(id)}>{t("s4.sandbox.test", { item: auctionLotText(locale, id).name })}</button>)}</div>
    <button className="btn btn-ghost mt-3 min-h-12 w-full" onClick={() => void sendGame({ type: "DEV_GENERATE_POOL" })}>{t("s4.sandbox.generate")}</button>
    {pool && <div className="mt-2 min-w-0 rounded-xl border border-indigo p-2 text-xs"><p className="break-all">{t("s4.sandbox.seed", { seed: pool.preview?.seed ?? pool.seed })}</p><ol className="mt-2 grid gap-1">{(pool.preview?.order ?? pool.order).map((id, i) => { const lot = LOTS04.find((entry) => entry.id === id)!; return <li key={`${id}-${i}`} className="min-w-0">{String(i + 1).padStart(2, "0")} · {auctionLotText(locale, id).name} · {lot.category} · {t((pool.preview?.counterfeit ?? pool.counterfeit).includes(id) ? "s4.sandbox.fake" : "s4.sandbox.genuine")}</li>; })}</ol><p className="mt-1">10 · {auctionLotText(locale, "LOT_10").name}</p></div>}
  </section>;
}
