// Scenario 03's actions on scenario 02's dock: the grid (abilities, items and
// ending the turn keep the shared row), which actions act on one press, and
// the second step for its own targeted actions. Help, abilities and supplies
// use the dock's shared pickers. The server's availability (enabled, reason,
// targets, AP cost) is shown as it comes; nothing here decides a rule.
import { useState } from "react";
import { placeFromKey03 } from "../../../shared/game/scenario03/map.ts";
import { NODES03, type CausalNodeId03 } from "../../../shared/game/scenario03/nodes.ts";
import type { EndingRoute03, NpcId03 } from "../../../shared/game/scenario03/story.ts";
import type { ActionAvailability, GameAction } from "../../../shared/game/actions.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { useItemText, useT } from "../../i18n/index.ts";
import type { S3Key } from "../../i18n/types.ts";
import { PeopleRow, type DockExtension } from "../Dock.tsx";
import { roomKey03 } from "./Map03.tsx";
import { routeSteps03 } from "./clarity03.ts";

const option = "btn btn-ghost min-h-12 text-sm";

export const DOCK03: DockExtension = {
  grid: ["MOVE", "TIME_JUMP", "INVESTIGATE", "SCAN", "SEARCH", "INTERACT_NPC", "INTERVENE", "PICK_UP", "STORE_ITEM", "RESOLVE_HISTORY", "HELP", "TRADE"],
  direct: new Set(["TIME_JUMP", "INVESTIGATE", "SEARCH", "END_TURN"]),
  columns: "lg:grid-cols-6",
  picker: ({ g, mode, availability, send }) => {
    switch (mode) {
      case "MOVE":
        return { title: "s3.pick.move", body: <Rooms availability={availability} send={send} /> };
      case "SCAN":
        return { title: "s3.pick.scan", body: <Scan send={send} /> };
      case "INTERACT_NPC":
        return { title: "s3.pick.npc", body: <Npcs availability={availability} send={send} /> };
      case "INTERVENE":
        return { title: "s3.pick.intervene", body: <Decisions availability={availability} send={send} /> };
      case "RESOLVE_HISTORY":
        return { title: "s3.pick.route", body: <Routes g={g} availability={availability} send={send} /> };
      case "PICK_UP":
        return { title: "s3.pick.pickup", body: <Relics g={g} ids={(availability.targets ?? []).map(String)} source="world" onPick={(id) => send({ type: "PICK_UP", instanceId: id })} /> };
      case "STORE_ITEM":
        return { title: "s3.pick.store", body: <Relics g={g} ids={(availability.targets ?? []).map(String)} source="mine" onPick={(id) => send({ type: "STORE_ITEM", instanceId: id })} /> };
      case "TRADE":
        return { title: "s3.pick.trade", body: <Transfer g={g} availability={availability} send={send} /> };
      default:
        return null;
    }
  },
};

type Send = (a: GameAction) => void;

function Rooms({ availability, send }: { availability: ActionAvailability; send: Send }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {(availability.targets ?? []).map(Number).map((key) => {
        const place = placeFromKey03(key);
        if (!place) return null;
        return (
          <button key={key} className={option} onClick={() => send({ type: "MOVE", toCarriage: key })}>
            {t(roomKey03(place.roomId))}
          </button>
        );
      })}
    </div>
  );
}

function Scan({ send }: { send: Send }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {(["ARCHIVE", "FIELD", "STABILIZE"] as const).map((protocol) => (
        <button key={protocol} className={`${option} h-auto min-w-0 flex-1 basis-48 flex-col items-start py-2 text-left whitespace-normal`} onClick={() => send({ type: "SCAN", protocol })}>
          <span className="font-semibold text-gold-bright">{t(`s3.scan.${protocol}`)}</span>
          <span className="mt-0.5 text-xs leading-snug text-mist">{t(`s3.scan.description.${protocol}`)}</span>
        </button>
      ))}
    </div>
  );
}

function Npcs({ availability, send }: { availability: ActionAvailability; send: Send }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {(availability.targets ?? []).map(String).map((id) => (
        <button key={id} className={option} onClick={() => send({ type: "INTERACT_NPC", npcId: id as NpcId03 })}>
          {t(id === "ZERO" ? "s3.npc.ZERO" : "s3.npc.ARCHIVIST_00")}
        </button>
      ))}
    </div>
  );
}

function Decisions({ availability, send }: { availability: ActionAvailability; send: Send }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-2">
      {(availability.targets ?? []).map(String).map((id) => {
        const node = id as CausalNodeId03;
        return (
          <div key={id} className="min-w-0">
            <p className="mb-1 text-xs text-gold">{t(`s3.node.${node}`)}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {NODES03[node].choices.map((choiceId) => (
                <button key={choiceId} className={`${option} h-auto min-w-0 py-2 whitespace-normal`} onClick={() => send({ type: "INTERVENE", nodeId: node, choiceId })}>
                  <span className="block font-semibold">{t(`s3.choice.${node}.${choiceId}` as S3Key)}</span>
                  <span className="mt-1 block text-xs leading-snug text-mist">{t(`s3.choice.effect.${node}.${choiceId}` as S3Key)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Routes({ g, availability, send }: { g: PlayerView; availability: ActionAvailability; send: Send }) {
  const t = useT();
  const ready = new Set((availability.targets ?? []).map(String));
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {g.temporal!.story.availableRoutes.map((route: EndingRoute03) => {
        const missing = routeSteps03(g, route).filter((step) => !step.done).length;
        return <button key={route} className={`${option} h-auto min-w-0 flex-col py-2 whitespace-normal`} disabled={!ready.has(route)} onClick={() => send({ type: "RESOLVE_HISTORY", route })}>
          <span className="font-semibold">{t(`s3.route.${route}`)}</span>
          <span className="mt-1 text-xs text-mist">{t(missing ? "s3.pick.routeMissing" : "s3.pick.routeReady", { n: missing })}</span>
        </button>;
      })}
    </div>
  );
}

function Relics({ g, ids, source, onPick }: { g: PlayerView; ids: string[]; source: "world" | "mine"; onPick: (id: string) => void }) {
  const itemText = useItemText();
  const tp = g.temporal!;
  const pool = source === "world" ? tp.worldItems : tp.myItems;
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const item = pool.find((x) => x.instanceId === id);
        return (
          <button key={id} className={option} onClick={() => onPick(id)}>
            {item ? `${itemText(item.itemId).name} · ${id}` : id}
          </button>
        );
      })}
    </div>
  );
}

/** A relic handed to a teammate in the same room and year (a transfer: nothing is asked back). */
function Transfer({ g, availability, send }: { g: PlayerView; availability: ActionAvailability; send: Send }) {
  const t = useT();
  const itemText = useItemText();
  const [to, setTo] = useState<string | null>(null);
  const partners = (availability.targets ?? []).map(String).filter((id) => g.players[id]).map((id) => g.players[id]);
  const mine = g.temporal!.myItems.map((x) => x.instanceId);
  const supplies = [...new Set(g.players[g.viewerId].items.filter((id) => id === "PHASE_BATTERY" || id === "SEDATIVE03"))];
  const fate = g.players[g.viewerId].fate;
  const transfer = (offer: { instances?: string[]; items?: (typeof supplies)[number][]; fate?: number }) => send({
    type: "TRADE", targetId: to!,
    give: { instances: offer.instances ?? [], items: offer.items ?? [], fate: offer.fate ?? 0 },
    want: { items: [], fate: 0 },
  });
  return (
    <div className="grid grid-cols-1 gap-2">
      <PeopleRow people={partners} selected={to ? [to] : []} onPick={setTo} />
      {to && (
        <>
          <p className="text-xs text-mist">{t("s3.pick.tradeWhat")}</p>
          {mine.length > 0 && <Relics g={g} ids={mine} source="mine" onPick={(id) => transfer({ instances: [id] })} />}
          {supplies.length > 0 && <div className="flex flex-wrap gap-2">{supplies.map((id) => <button key={id} className={option} onClick={() => transfer({ items: [id] })}>{t("s3.pick.tradeSupply", { name: itemText(id).name })}</button>)}</div>}
          {fate > 0 && <button className={`${option} self-start`} onClick={() => transfer({ fate: 1 })}>{t("s3.pick.tradeFate")}</button>}
          {!mine.length && !supplies.length && !fate && <p className="text-sm text-ash">{t("s3.pick.tradeNone")}</p>}
        </>
      )}
    </div>
  );
}
