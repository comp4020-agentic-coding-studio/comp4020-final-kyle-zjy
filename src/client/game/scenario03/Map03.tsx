// Scenario 03's map: the Administration's eight rooms as a branching tree,
// in one year at a time (1996 or 2026), with the year's own theme and the
// causal ripple when history is rewritten. It behaves like scenario 02's map:
// tapping a room selects it (RoomPanel03); in move mode, tapping a lit room
// moves there. Players sit on their room as portraits.
import { getCharacterById } from "../../../shared/characters/roster/index.ts";
import { ADJACENT03, OPENS_IN_ACT03, ROOM_IDS, placeKey03, type RoomId03, type Year03 } from "../../../shared/game/scenario03/map.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { Avatar } from "../../components/Avatar.tsx";
import { useT } from "../../i18n/index.ts";

const POINT: Record<RoomId03, [number, number]> = {
  CENTRAL_HALL: [295, 145],
  ARCHIVES: [145, 90],
  DIRECTOR_OFFICE: [0, 20],
  SECRET_ARCHIVE: [0, 190],
  RESEARCH_WING: [440, 90],
  MAIN_LAB: [590, 0],
  PROTOTYPE_ROOM: [590, 105],
  POWER_ROOM: [590, 220],
};

const MOBILE_POINT: Record<RoomId03, [number, number]> = {
  CENTRAL_HALL: [50, 16],
  ARCHIVES: [25, 125],
  RESEARCH_WING: [75, 125],
  DIRECTOR_OFFICE: [25, 237],
  MAIN_LAB: [75, 237],
  SECRET_ARCHIVE: [25, 349],
  PROTOTYPE_ROOM: [75, 349],
  POWER_ROOM: [75, 461],
};

export const roomKey03 = (room: RoomId03) => `s3.room.${room}` as const;

/** A room in a year as players see it: erased from 2026, still locked, or open (and what marks it). */
export function roomState03(g: PlayerView, room: RoomId03, year: Year03): { erased: boolean; open: boolean } {
  const tp = g.temporal!;
  const erased = room === "POWER_ROOM" && year === "Y2026" && !tp.present.powerRoomExists;
  const open = !erased && (g.act >= OPENS_IN_ACT03[room] || (room === "SECRET_ARCHIVE" && year === "Y2026" && tp.present.secretArchiveOpen));
  return { erased, open };
}

export function Map03({ g, year, ripple, selected, onSelect, moveTargets, onMove }: { g: PlayerView; year: Year03; ripple: boolean; selected: RoomId03; onSelect: (room: RoomId03) => void; moveTargets: number[]; onMove: (place: number) => void }) {
  const t = useT();
  const tp = g.temporal!;
  const current = tp.locations[g.viewerId];
  const targets = new Set(moveTargets);
  const edges = ROOM_IDS.flatMap((room) => ADJACENT03[room].filter((next) => ROOM_IDS.indexOf(room) < ROOM_IDS.indexOf(next)).map((next) => [room, next] as const));
  return (
    <section aria-label={t("s3.map")} className={`s3-map-shell ${year === "Y1996" ? "s3-past" : "s3-present"} ${ripple ? "s3-map-rewritten" : ""}`}>
      <div className="s3-map-grid">
        <svg className="s3-map-lines-desktop" viewBox="0 0 720 300" aria-hidden="true">
          {edges.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={POINT[a][0] + 65} y1={POINT[a][1] + 31} x2={POINT[b][0] + 65} y2={POINT[b][1] + 31} />
          ))}
        </svg>
        <svg className="s3-map-lines-mobile" viewBox="0 0 300 550" preserveAspectRatio="none" aria-hidden="true">
          <path d="M150 56 L75 165 M150 56 L225 165 M75 165 L75 277 M75 165 L75 389 M225 165 L225 277 M225 165 L225 389 M225 165 L225 501" />
        </svg>
        {ROOM_IDS.map((room) => {
          const [x, y] = POINT[room];
          const [mobileX, mobileY] = MOBILE_POINT[room];
          const here = current.roomId === room && current.year === year;
          const { erased, open } = roomState03(g, room, year);
          const target = targets.has(placeKey03(room, year)) && current.year === year;
          const people = g.turnOrder.map((id) => g.players[id]).filter((p) => tp.locations[p.playerId]?.roomId === room && tp.locations[p.playerId]?.year === year);
          const label = t(roomKey03(room));
          const marker =
            room === "RESEARCH_WING" && year === "Y2026" && tp.present.researchFacility === "TEMPORAL_CONTAINMENT"
              ? t("s3.map.containment")
              : room === "SECRET_ARCHIVE" && year === "Y2026" && tp.present.secretArchiveOpen
                ? t("s3.map.rewritten")
                : room === "POWER_ROOM" && erased
                  ? t("s3.map.erased")
                  : room === "ARCHIVES" && year === "Y1996"
                    ? t("s3.map.archivist")
                    : room === "CENTRAL_HALL" && year === "Y2026" && g.act >= 3
                      ? t("s3.map.zero")
                      : null;
          const cls = `s3-room-node ${here ? "s3-room-current" : target ? "s3-room-target" : open ? "s3-room-open" : "s3-room-locked"} ${selected === room && !here ? "s3-room-selected" : ""}`;
          const style = { "--s3-x": `${x}px`, "--s3-y": `${y}px`, "--s3-mobile-x": `${mobileX}%`, "--s3-mobile-y": `${mobileY}px` } as React.CSSProperties;
          return (
            <button
              key={room}
              className={cls}
              style={style}
              aria-pressed={selected === room}
              aria-label={target ? t("s3.map.move", { room: label }) : `${label}${here ? `, ${t("s3.map.here")}` : ""}`}
              onClick={() => (target ? onMove(placeKey03(room, year)) : onSelect(room))}
            >
              <span className="s3-room-heading">
                <span className="s3-room-title">{label}</span>
                {here && <span className="s3-room-here">{t("s3.map.here")}</span>}
              </span>
              <span className="s3-room-subtitle">{erased ? t("s3.map.erased") : !open ? t("s3.map.locked", { act: OPENS_IN_ACT03[room] }) : (marker ?? (people.length ? t("s3.map.occupied", { n: people.length }) : t("s3.map.empty")))}</span>
              {people.length > 0 && (
                <span className="s3-room-players" aria-label={people.map((person) => person.nickname).join(", ")}>
                  {people.slice(0, 4).map((person) => {
                    const ch = getCharacterById(person.characterId);
                    return <Avatar key={person.playerId} zodiac={ch.zodiac} mbti={ch.mbti} size={22} className={person.playerId === g.viewerId ? "ring-2 ring-signal" : ""} />;
                  })}
                  {people.length > 4 && <span className="s3-player-extra">+{people.length - 4}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
