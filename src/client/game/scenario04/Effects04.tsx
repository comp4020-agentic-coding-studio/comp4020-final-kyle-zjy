import type { PlayerView, PublicPlayerState } from "../../../shared/game/state.ts";
import { useT } from "../../i18n/index.ts";

function Chip({ id, negative = false, children }: { id: string; negative?: boolean; children: React.ReactNode }) {
  return <span data-s4-effect={id} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${negative ? "border-ember/50 text-ember" : "border-gold/40 text-gold"}`}>{children}</span>;
}

export function Effects04({ g, me }: { g: PlayerView; me: PublicPlayerState }) {
  const t = useT();
  const a = g.auction?.players[g.viewerId];
  if (!a) return null;
  return <>
    {a.armedBlackDie > 0 && <Chip id="black-die">{t("s4.effect.blackDie")}</Chip>}
    {a.armedCoin > 0 && <Chip id="coin">{t("s4.effect.coin")}</Chip>}
    {a.redContractRemainingRounds > 0 && <Chip id="red-contract">{g.round < (a.redContractStartsRound ?? 0) ? t("s4.effect.contractPending") : t("s4.effect.contractActive", { n: a.redContractRemainingRounds })}</Chip>}
    {a.sanityWard && <Chip id="nameless-file">{t("s4.effect.ward")}</Chip>}
    {a.activeCrown && <Chip id="black-crown">{t("s4.effect.crown")}</Chip>}
    {me.lost && <Chip id="lost" negative>{t("s4.effect.lost")}</Chip>}
    {(a.nextRollPenalty ?? 0) < 0 && <Chip id="roll-penalty" negative>{t("s4.effect.rollPenalty", { n: a.nextRollPenalty! })}</Chip>}
  </>;
}
