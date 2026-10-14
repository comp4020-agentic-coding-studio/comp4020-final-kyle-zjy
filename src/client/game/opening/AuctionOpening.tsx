import { AUCTION_CONFIG04 } from "../../../shared/game/scenario04/config.ts";
import { auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { useLocale, useT } from "../../i18n/index.ts";
import { Icon } from "../Icon.tsx";
import { LOT_ICON04 } from "../scenario04/lotVisuals.ts";
import { OpeningTitle } from "./OpeningTitle.tsx";

export function AuctionSetting({ seats = false, names = [] }: { seats?: boolean; names?: readonly string[] }) {
  return <div className="opening-auction-table" aria-hidden="true"><div className="auction-spotlight" /><div className="auction-felt"><div className="auction-glass" /><div className="auction-sealed-letter" /><div className="auction-chip-pile"><i /><i /><i /></div></div>
    {seats && <div className="auction-seat-ring">{names.map((name, i) => <div key={i} className="auction-seat"><span>{name}</span></div>)}</div>}
  </div>;
}

export function Gavel() {
  return <div className="opening-gavel" aria-hidden="true"><svg viewBox="0 0 400 260"><g className="gavel-hand"><path d="M314 18 255 74 222 67 205 86 226 124 254 127 320 76" /><path className="gavel-handle" d="M132 87 278 160 269 178 123 106Z" /><path className="gavel-head" d="M82 67 115 39 160 99 127 127Z" /></g><path className="gavel-block" d="M63 207Q121 181 178 207V220H63Z" /><path d="M0 230H400" /></svg></div>;
}

export function AuctionOpening({ id, elapsed, names }: { id: string; elapsed: number; names: readonly string[] }) {
  const t = useT();
  const locale = useLocale();
  switch (id) {
    case "invitation": return <div className={`opening-envelope ${elapsed > 1.3 ? "is-open" : ""}`}><div className="envelope-flap" aria-hidden="true" /><article className="auction-invitation"><p>{t("o4.invitation")}</p><strong>23:40</strong><h2>{t("o4.pier")}</h2><span>{t("o4.bring")}</span></article><div className="envelope-front" aria-hidden="true" /></div>;
    case "entrance": return <div className={`opening-auction-door ${elapsed > 2 && elapsed < 5 ? "is-open" : ""}`}><div className="auction-stairs" aria-hidden="true" /><div className="auction-metal-door" aria-hidden="true"><i /></div><div className="auction-attendant" aria-hidden="true" /><div className="auction-door-invitation" aria-hidden="true" /></div>;
    case "catalogue": return <div className="opening-catalogue"><AuctionSetting /><article><p className="opening-kicker">{t("o4.catalog")}</p><h2>{t("o4.lots", { n: 10 })}</h2><div className="auction-lot-list" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <span key={i} className={elapsed < i * .45 ? "film-concealed" : ""}>{String(i + 1).padStart(2, "0")}</span>)}</div><div className={`auction-exit-card ${elapsed < 4.5 ? "film-concealed" : ""}`}><p>{t("o4.lot", { n: "10" })}</p><Icon name="S4_EXIT" size={44} /><h2>{t("o4.exit")}</h2></div></article></div>;
    case "chips": return <div className="opening-chips"><p className="opening-kicker">{t("o4.chips", { n: AUCTION_CONFIG04.startingBlackChips })}</p><div className="chip-deal">{Array.from({ length: AUCTION_CONFIG04.startingBlackChips }, (_, i) => <i key={i} className={elapsed < .3 + i * .6 ? "film-concealed" : "chip-landed"} style={{ "--chip-index": i } as React.CSSProperties} aria-hidden="true" />)}</div><p className={elapsed < 3 ? "film-concealed" : "auction-credit"}>{t("o4.credit")}</p></div>;
    case "lots": return <div className="opening-lot-previews">{(["LOT_01", "LOT_02", "LOT_05"] as const).map((lot, i) => <article key={lot} className={elapsed >= i * 1.5 ? "lot-unveiled" : "film-concealed"}><p>{t("o4.lot", { n: lot.slice(-2) })}</p><div className="lot-shadow" aria-hidden="true"><Icon name={LOT_ICON04[lot]} size={58} /></div><h2>{auctionLotText(locale, lot).name}</h2><span>{t("o4.preview")}</span></article>)}</div>;
    case "seats": return <div className="opening-auction-seats"><AuctionSetting seats names={names} /><div className="auction-action-ribbon">{(["bid", "pass", "trade", "investigate", "borrow", "challenge"] as const).map((word, i) => <span key={word} className={elapsed < i * .65 ? "film-concealed" : ""}>{t(`o4.${word}`)}</span>)}</div><div className="auction-playing-cards" aria-hidden="true"><i>♠</i><i>♦</i></div></div>;
    case "auctioneer": return <div className="opening-auctioneer"><p className="opening-kicker">{t("o4.host")}</p><Gavel /></div>;
    case "title": return <OpeningTitle number="04" title="o4.title"><AuctionSetting /><div className="auction-title-rule" aria-hidden="true" /></OpeningTitle>;
    default: return null;
  }
}
