import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionIntelText } from "../../../shared/i18n/scenario04.ts";
import { useLocale, useT } from "../../i18n/index.ts";
import { Section } from "../SecretsDrawer.tsx";

export function Private04({ g }: { g: PlayerView }) {
  const t = useT();
  const locale = useLocale();
  const mine = g.auction!.players[g.viewerId];
  return <>
    <Section title={t("s4.private.title")} empty={t("s4.private.empty")} items={(mine?.privateIntel ?? []).map((id) => ({ id, text: auctionIntelText(locale, id) }))} />
    <Section title={t("s4.private.reads")} empty={t("s4.private.empty")} items={(mine?.reads ?? []).map((read, index) => ({ id: `${read.targetId}-${index}`, text: t("s4.private.read", { name: g.players[read.targetId]?.nickname ?? "?", chips: read.blackChips, intel: t(read.hasCurrentIntel ? "s4.private.yes" : "s4.private.no") }) }))} />
  </>;
}
