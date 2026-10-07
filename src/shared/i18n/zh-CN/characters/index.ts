// Simplified Chinese character text, one file per sign (keyed by MBTI type).
import { ZODIACS, type CharacterId, type MBTI } from "../../../characters/types.ts";
import type { CharacterText, CharactersText } from "../../content-types.ts";
import { ARIES } from "./aries.ts";
import { TAURUS } from "./taurus.ts";
import { GEMINI } from "./gemini.ts";
import { CANCER } from "./cancer.ts";
import { LEO } from "./leo.ts";
import { VIRGO } from "./virgo.ts";
import { LIBRA } from "./libra.ts";
import { SCORPIO } from "./scorpio.ts";
import { SAGITTARIUS } from "./sagittarius.ts";
import { CAPRICORN } from "./capricorn.ts";
import { AQUARIUS } from "./aquarius.ts";
import { PISCES } from "./pisces.ts";

const SIGNS: Record<string, Partial<Record<MBTI, CharacterText>>> = { aries: ARIES, taurus: TAURUS, gemini: GEMINI, cancer: CANCER, leo: LEO, virgo: VIRGO, libra: LIBRA, scorpio: SCORPIO, sagittarius: SAGITTARIUS, capricorn: CAPRICORN, aquarius: AQUARIUS, pisces: PISCES };

export const ZH_CHARACTERS: Partial<CharactersText> = Object.fromEntries(
  ZODIACS.flatMap((z) => Object.entries(SIGNS[z] ?? {}).map(([mbti, t]) => [`${z}-${mbti.toLowerCase()}` as CharacterId, t])),
);
