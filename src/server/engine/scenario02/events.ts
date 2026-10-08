// What scenario 02's city events do to the city (the CITY_EVENT effect). Each
// one changes something players must plan around: a road, the water, a
// cache, a person waiting, the next rise.
import { ITEM_IDS02 } from "../../../shared/game/scenario02/items.ts";
import { HARBOUR_ZONE, ZONES, zoneIndex } from "../../../shared/game/scenario02/map.ts";
import { NPCS } from "../../../shared/game/scenario02/npcs.ts";
import { list, m, ref } from "../../../shared/i18n/msg.ts";
import { cue, log, type Ctx } from "../context.ts";
import { changeCollapse, registerHandler } from "../effects.ts";
import { gainFate, loseSanity, present } from "../players.ts";
import { pick, shuffle } from "../rng.ts";
import { neighbours } from "./city.ts";

const zoneRef = (i: number) => ref.zone(ZONES[i].id);
const dry = (ctx: Ctx, i: number) => {
  const st = ctx.s.city!.zones[i].status;
  return st === "NORMAL" || st === "FLOODED";
};

registerHandler("CITY_EVENT", (ctx, e) => {
  const s = ctx.s;
  const city = s.city;
  if (!city) return;
  switch (e.what) {
    case "AFTERSHOCK": {
      // a road gives way, never one onto the pier (the boat must stay reachable)
      const pier = zoneIndex(HARBOUR_ZONE);
      const roads = city.edges.filter((x) => !x.broken && x.kind === "ROAD" && x.a !== pier && x.b !== pier && dry(ctx, x.a) && dry(ctx, x.b));
      if (!roads.length) return log(ctx, m`The ground shakes, but there is little left to break.`, "EVENT");
      const road = pick(s, roads);
      road.broken = true;
      log(ctx, m`The road between ${zoneRef(road.a)} and ${zoneRef(road.b)} collapses.`, "ROAD");
      return cue(ctx, "ROAD", { a: road.a, b: road.b });
    }
    case "STORM": {
      city.surge += 1;
      log(ctx, m`The next rise will be worse.`, "FLOOD");
      for (const p of present(ctx)) if (city.zones[p.carriageIndex].status === "FLOODED") loseSanity(ctx, p, 1, m`the storm`);
      return;
    }
    case "BROADCAST": {
      const order = city.zones.map((z, i) => ({ z, i })).filter(({ z }) => z.status !== "SUBMERGED" && z.sinkAt < 50).sort((a, b) => a.z.sinkAt - b.z.sinkAt || a.i - b.i);
      if (!order.length) return log(ctx, m`The broadcast is only static now.`, "EVENT");
      const next = order.filter(({ z }) => z.sinkAt === order[0].z.sinkAt).map(({ i }) => i);
      return log(ctx, m`The broadcast names the next to go under: ${list(next.map(zoneRef))}.`, "BROADCAST");
    }
    case "DISTRESS": {
      const used = new Set(city.npcs.map((n) => n.id));
      const npc = NPCS.find((n) => !used.has(n.id));
      const spots = city.zones.map((_, i) => i).filter((i) => city.zones[i].status === "NORMAL" && i !== city.startZone && i !== zoneIndex(HARBOUR_ZONE));
      if (!npc || !spots.length) {
        for (const p of present(ctx)) gainFate(ctx, p, 1, m`a signal answered`);
        return;
      }
      const zone = pick(s, spots);
      city.npcs.push({ id: npc.id, zone, state: "WAITING" });
      log(ctx, m`Someone is signalling from ${zoneRef(zone)}: ${ref.npc(npc.id)}.`, "NPC");
      return cue(ctx, "NPC", { id: npc.id, zone });
    }
    case "LOW_TIDE": {
      // a drowned zone next to dry ground comes back, flooded, until the next rise
      const back = city.zones.map((_, i) => i).filter((i) => city.zones[i].status === "SUBMERGED" && neighbours(city, i).some((n) => dry(ctx, n)));
      if (!back.length) return log(ctx, m`The sea draws back, but nothing it took comes up again.`, "EVENT");
      const zone = pick(s, back);
      city.zones[zone].status = "FLOODED";
      city.zones[zone].sinkAt = s.collapse + 1;
      log(ctx, m`${zoneRef(zone)} comes up out of the water. It will be gone again at the next rise.`, "FLOOD");
      return cue(ctx, "LOW_TIDE", { zone });
    }
    case "SALVAGE": {
      const spots = city.zones.map((_, i) => i).filter((i) => dry(ctx, i) && i !== zoneIndex(HARBOUR_ZONE));
      const zone = pick(s, spots);
      city.zones[zone].caches.push(pick(s, ITEM_IDS02), pick(s, ITEM_IDS02));
      city.zones[zone].searched = false;
      log(ctx, m`A crate washes up in ${zoneRef(zone)}. Whoever searches there first gets it.`, "EVENT");
      return cue(ctx, "SALVAGE", { zone });
    }
    case "BREACH": {
      const normal = shuffle(s, city.zones.map((_, i) => i).filter((i) => city.zones[i].status === "NORMAL" && ZONES[i].elevation !== "HIGH")).slice(0, 2);
      for (const i of normal) city.zones[i].status = "FLOODED";
      if (normal.length) log(ctx, m`Water floods ${list(normal.map(zoneRef))}.`, "FLOOD");
      return changeCollapse(ctx, 1, m`the flood wall breaking`);
    }
    case "NAME": {
      const p = pick(s, present(ctx));
      if (!p) return;
      log(ctx, m`${p.nickname} hears their own name read out among the drowned.`, "EVENT", p.playerId);
      loseSanity(ctx, p, 1, m`their name on the radio`);
      return gainFate(ctx, p, 1, m`knowing what is coming`);
    }
    case "HOLD": {
      city.hold += 1;
      return log(ctx, m`The next rise will be smaller.`, "FLOOD");
    }
  }
});

