import type { PlayerSecrets } from "../../../shared/game/state.ts";
import type { TFunction } from "../../i18n/index.ts";
import type { S3Key } from "../../i18n/types.ts";
import { roomKey03 } from "./Map03.tsx";

const NAMES: Record<string, S3Key> = {
  CASE_FILE_A: "s3.scan.lead.CASE_FILE_A",
  CASE_FILE_B: "s3.scan.lead.CASE_FILE_B",
  FOUNDING_CHARTER: "s3.scan.lead.FOUNDING_CHARTER",
  SURVEILLANCE_TAPE: "s3.scan.lead.SURVEILLANCE_TAPE",
  FOUNDER_DISCREPANCY: "s3.scan.lead.FOUNDER_DISCREPANCY",
  ACCESS_LEDGER: "s3.scan.lead.ACCESS_LEDGER",
  JI_MARGIN_NOTE: "s3.scan.lead.JI_MARGIN_NOTE",
  PROTOTYPE_LOG: "s3.scan.lead.PROTOTYPE_LOG",
  STAFF_DISCREPANCY: "s3.scan.lead.STAFF_DISCREPANCY",
  PROTOTYPE_DISCREPANCY: "s3.scan.lead.PROTOTYPE_DISCREPANCY",
};

export function archiveLeadText03(t: TFunction, lead: PlayerSecrets["archiveLead03"]): string {
  if (!lead?.roomId || !lead.year) return t("s3.scan.archive.none");
  const place = { room: t(roomKey03(lead.roomId)), year: t(`s3.year.short.${lead.year}`) };
  const name = lead.evidenceId && NAMES[lead.evidenceId];
  return name
    ? t("s3.scan.archive.precise", { ...place, name: t(name) })
    : t("s3.scan.archive.direction", place);
}
