import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionIntelText, auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { useLocale, useT } from "../../i18n/index.ts";
import { Section } from "../SecretsDrawer.tsx";

export function Private04({ g }: { g: PlayerView }) {
  const t = useT();
  const locale = useLocale();
  const mine = g.auction!.players[g.viewerId];
  return <>
    <Section title={t("s4.private.title")} empty={t("s4.private.empty")} items={(mine?.privateIntel ?? []).map((id) => ({ id, text: auctionIntelText(locale, id) }))} />
    <Section title={t("s4.private.reads")} empty={t("s4.private.empty")} items={(mine?.reads ?? []).map((read, index) => ({ id: `${read.targetId}-${index}`, text: t("s4.private.read", { name: g.players[read.targetId]?.nickname ?? "?", chips: read.blackChips, intel: t(read.hasCurrentIntel ? "s4.private.yes" : "s4.private.no") }) }))} />
    <Section title={t("s4.private.glass")} empty={t("s4.private.empty")} items={(mine?.glassEyeSnapshots ?? []).flatMap((snapshot, index) => Object.entries(snapshot.chips).map(([id, chips]) => ({ id: `${index}-${id}`, text: t("s4.private.glassEntry", { round: snapshot.round, name: g.players[id]?.nickname ?? "?", chips }) })))} />
    <Section title={t("s4.private.itemObservations")} empty={t("s4.private.empty")} items={(mine?.privateObservations ?? []).map((entry, index) => ({ id: String(index), text: entry.kind === "CHIP_BAND" ? t("s4.private.chipBand", { name: g.players[entry.targetId!]?.nickname ?? "?", band: entry.value }) : entry.kind === "CARD_PEEK" ? t("s4.private.cardPeek", { rank: entry.value === "1" ? "A" : entry.value === "11" ? "J" : entry.value === "12" ? "Q" : entry.value === "13" ? "K" : entry.value }) : entry.kind === "ITEM_HINT" ? auctionIntelText(locale, entry.value as `${`LOT_${string}`}_${string}`) : t(entry.value === "ANOMALY" ? "s4.private.authAnomaly" : "s4.private.authClear", { item: auctionLotText(locale, entry.lotId!).name }) }))} />
  </>;
}
