// Public silhouettes only. Effects and authenticity never enter a preview.
import { LOTS04 } from "../../../shared/game/scenario04/lots.ts";

export const LOT_ICON04: Record<string, string> = Object.fromEntries(LOTS04.map((lot) => [lot.id, lot.icon]));
