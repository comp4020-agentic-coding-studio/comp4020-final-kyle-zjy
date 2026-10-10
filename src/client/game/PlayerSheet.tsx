// A passenger's public card: character, ability state, resources, statuses.
// Shows only what the server sent: hidden statuses of others never arrive.
import { getCharacterById } from "../../shared/characters/roster/index.ts";
import { MAX_SANITY } from "../../shared/game/scenario01/content.ts";
import type { PlayerView, PublicPlayerState } from "../../shared/game/state.ts";
import { CharacterCard } from "../components/CharacterCard.tsx";
import { useCharacterText, useItemText, useLocale, useScenarioText, useT } from "../i18n/index.ts";
import { auctionLotText } from "../../shared/i18n/scenario04.ts";
import { rich } from "../i18n/rich.ts";
import { statusName } from "./status.ts";
import { Drawer } from "./Drawer.tsx";

export function PlayerSheet({ g, p, onClose }: { g: PlayerView; p: PublicPlayerState; onClose: () => void }) {
  const live = g.players[p.playerId] ?? p;
  const ch = getCharacterById(live.characterId);
  const identity = g.carriages[live.carriageIndex]?.identity ?? "START";
  const t = useT();
  const text = useScenarioText();
  const itemName = useItemText();
  const charText = useCharacterText();
  const locale = useLocale();
  const sep = t("common.listSep");
  return (
    <Drawer title={live.nickname} onClose={onClose}>
      <div className="space-y-3">
        <CharacterCard zodiac={ch.zodiac} mbti={ch.mbti} />
        <p className="text-sm">
          {t("sheet.ability")} <span className={live.skill.state === "READY" ? "text-moss" : "text-ember"}>{t(`skill.state.${live.skill.state}`)}</span>
          {live.skill.borrowed ? t("sheet.borrowed", { skill: charText(live.skill.borrowed).skillName }) : ""}
        </p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat k={t("common.fate")} v={String(live.fate)} />
          <Stat k={t("common.sanity")} v={`${live.sanity}/${MAX_SANITY}`} />
          <Stat k={t("sheet.shields")} v={String(live.shields)} />
        </dl>
        {g.auction && <dl className="grid grid-cols-2 gap-2 text-center"><Stat k={t("s4.hud.debt")} v={String(g.auction.players[live.playerId]?.debt ?? 0)} />{live.playerId === g.viewerId && <Stat k={t("s4.hud.chips")} v={String(g.auction.players[live.playerId]?.blackChips ?? 0)} />}</dl>}
        {!g.auction && <p className="text-sm text-mist">
          {rich(t("sheet.inThe"), { carriage: <span className="text-moon">{text.carriages[identity].name}</span> })}
          {live.lost ? t("sheet.lost") : ""}
          {live.away ? t("sheet.away") : ""}
        </p>}
        <div>
          <p className="label">{t("sheet.items")}</p>
          <p className="mt-1 text-sm text-mist">{g.auction ? (g.auction.players[live.playerId]?.items.map((id) => auctionLotText(locale, id).name).join(sep) || t("common.none")) : (live.items.length ? live.items.map((i) => itemName(i).name).join(sep) : t("common.none"))}</p>
        </div>
        <div>
          <p className="label">{t("sheet.statuses")}</p>
          {g.scenarioId === "S03_INCIDENT_ZERO" ? (live.statuses.length ? <ul className="mt-1 space-y-1 text-sm text-mist">{live.statuses.map((s) => <li key={s.id}>
            {s.kind === "TEMPORAL_LAG"
              ? t(s.expiresAtRound === g.round ? "s3.status.temporalLag.active" : "s3.status.temporalLag.pending")
              : s.kind === "FIELD_FOCUS"
                ? t("s3.status.fieldFocus")
                : s.kind === "TEMPORAL_ALIGNMENT"
                  ? t("s3.status.temporalAlignment")
                  : statusName(text, s.kind)}
          </li>)}</ul> : <p className="mt-1 text-sm text-mist">{t("common.none")}</p>)
            : <p className="mt-1 text-sm text-mist">{live.statuses.length ? live.statuses.map((s) => statusName(text, s.kind)).join(sep) : t("common.none")}</p>}
        </div>
      </div>
    </Drawer>
  );
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-lg border border-indigo p-2">
    <dt className="label text-[10px]">{k}</dt>
    <dd className="font-mono text-lg">{v}</dd>
  </div>
);
