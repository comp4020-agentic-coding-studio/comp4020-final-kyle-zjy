import { ZONES, type FacilityId } from "../../../shared/game/scenario02/map.ts";

/** The facility standing on a zone, if any. */
export const facilityAtZone = (zone: number): FacilityId | undefined => ZONES[zone]?.facility;
