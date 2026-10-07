// Display data for the 12 signs and 16 types. Constellation points are
// stylised (0–100 box), drawn as sigils so no emoji glyph stands in for art.
import type { MBTI, MbtiInfo, Zodiac, ZodiacInfo } from "./types.ts";

export type Constellation = { stars: [number, number][]; lines: [number, number][] };

export const ZODIAC_INFO: Record<Zodiac, ZodiacInfo & { dates: string; constellation: Constellation }> = {
  aries: {
    id: "aries", name: "Aries", glyph: "♈︎", dates: "Mar 21 – Apr 19", accent: "#e0533d",
    theme: "Impulse, first strike, attack, burst.", motif: "Flame, horns, crimson, vanguard",
    constellation: { stars: [[14, 58], [42, 40], [66, 36], [84, 46]], lines: [[0, 1], [1, 2], [2, 3]] },
  },
  taurus: {
    id: "taurus", name: "Taurus", glyph: "♉︎", dates: "Apr 20 – May 20", accent: "#c9a55a",
    theme: "Stability, hoarding, defence, resources.", motif: "Metal, plants, gold, weight",
    constellation: {
      stars: [[10, 20], [34, 44], [50, 52], [62, 46], [90, 26], [58, 70], [30, 84]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]],
    },
  },
  gemini: {
    id: "gemini", name: "Gemini", glyph: "♊︎", dates: "May 21 – Jun 20", accent: "#8f7bff",
    theme: "Copying, information, change, deceit.", motif: "Mirrors, two faces, data streams, cyan-violet",
    constellation: {
      stars: [[30, 12], [26, 40], [22, 70], [18, 90], [62, 14], [64, 42], [70, 70], [76, 90]],
      lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [1, 5]],
    },
  },
  cancer: {
    id: "cancer", name: "Cancer", glyph: "♋︎", dates: "Jun 21 – Jul 22", accent: "#b9d3f0",
    theme: "Protection, bonds, emotion, family.", motif: "Moon, waves, pearls, shelter",
    constellation: { stars: [[50, 48], [46, 16], [20, 84], [82, 80], [52, 64]], lines: [[0, 1], [0, 4], [4, 2], [4, 3]] },
  },
  leo: {
    id: "leo", name: "Leo", glyph: "♌︎", dates: "Jul 23 – Aug 22", accent: "#f2b544",
    theme: "Centre stage, display, leadership, glory.", motif: "Sun, gold, crown, spotlight",
    constellation: {
      stars: [[78, 22], [64, 14], [52, 24], [56, 42], [40, 56], [16, 64], [24, 84], [60, 74]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [4, 7], [7, 3]],
    },
  },
  virgo: {
    id: "virgo", name: "Virgo", glyph: "♍︎", dates: "Aug 23 – Sep 22", accent: "#c7cedb",
    theme: "Correction, analysis, precision, rules.", motif: "Precision, geometry, silver-white, instruments",
    constellation: {
      stars: [[12, 30], [30, 38], [48, 34], [62, 50], [80, 46], [56, 72], [40, 88], [88, 76]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6], [4, 7]],
    },
  },
  libra: {
    id: "libra", name: "Libra", glyph: "♎︎", dates: "Sep 23 – Oct 22", accent: "#e9e3d2",
    theme: "Balance, fairness, relationships, choice.", motif: "Scales, white feathers, symmetry, grace",
    constellation: { stars: [[50, 14], [20, 44], [80, 44], [28, 80], [72, 82]], lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4]] },
  },
  scorpio: {
    id: "scorpio", name: "Scorpio", glyph: "♏︎", dates: "Oct 23 – Nov 21", accent: "#9b1b30",
    theme: "Secrets, reversal, control, revenge.", motif: "Obsidian, deep crimson, venom tail, shadow",
    constellation: {
      stars: [[86, 12], [84, 30], [72, 40], [58, 48], [46, 62], [40, 80], [26, 88], [12, 80], [16, 66]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
    },
  },
  sagittarius: {
    id: "sagittarius", name: "Sagittarius", glyph: "♐︎", dates: "Nov 22 – Dec 21", accent: "#5b7cfa",
    theme: "Adventure, distance, chance, freedom.", motif: "Star charts, arrows, horizons, the galaxy",
    constellation: {
      stars: [[18, 72], [36, 56], [54, 60], [50, 38], [70, 30], [86, 14], [68, 78]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 1], [3, 4], [4, 5], [2, 6]],
    },
  },
  capricorn: {
    id: "capricorn", name: "Capricorn", glyph: "♑︎", dates: "Dec 22 – Jan 19", accent: "#8c7a5b",
    theme: "Growth, accumulation, goals, patience.", motif: "Snow peaks, black gold, time, rock",
    constellation: { stars: [[12, 24], [30, 40], [52, 76], [70, 70], [88, 36], [60, 34]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1]] },
  },
  aquarius: {
    id: "aquarius", name: "Aquarius", glyph: "♒︎", dates: "Jan 20 – Feb 18", accent: "#38e1d8",
    theme: "Anomaly, technology, rule-breaking, independence.", motif: "Neon, circuits, the future, glitches",
    constellation: {
      stars: [[10, 30], [28, 22], [46, 34], [60, 26], [74, 42], [66, 62], [80, 80], [50, 72]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [5, 7]],
    },
  },
  pisces: {
    id: "pisces", name: "Pisces", glyph: "♓︎", dates: "Feb 19 – Mar 20", accent: "#7fa8e8",
    theme: "Dreams, perception, illusion, empathy.", motif: "Dreams, ripples, moon seas, mirage",
    constellation: {
      stars: [[14, 20], [24, 40], [34, 62], [52, 84], [66, 66], [80, 56], [90, 66], [82, 78], [46, 36]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 4], [8, 1]],
    },
  },
};

export const MBTI_INFO: Record<MBTI, MbtiInfo & { title: string }> = {
  INTJ: { id: "INTJ", temperament: "NT", title: "The Planner", traits: "Calm, controlling, a chess player who plans ahead." },
  INTP: { id: "INTP", temperament: "NT", title: "The Researcher", traits: "Takes things apart, experiments, deconstructs." },
  ENTJ: { id: "ENTJ", temperament: "NT", title: "The Commander", traits: "Power, leadership, command." },
  ENTP: { id: "ENTP", temperament: "NT", title: "The Provocateur", traits: "Dangerous, cunning, an experimentalist." },
  INFJ: { id: "INFJ", temperament: "NF", title: "The Oracle", traits: "Prophecy, mystery, quiet observation." },
  INFP: { id: "INFP", temperament: "NF", title: "The Dreamer", traits: "Dreams, gentleness, solitude." },
  ENFJ: { id: "ENFJ", temperament: "NF", title: "The Convener", traits: "Leadership, connection, a sense of ritual." },
  ENFP: { id: "ENFP", temperament: "NF", title: "The Spark", traits: "Chaotic, bright, unpredictable." },
  ISTJ: { id: "ISTJ", temperament: "SJ", title: "The Recorder", traits: "Order, records, discipline." },
  ISFJ: { id: "ISFJ", temperament: "SJ", title: "The Guardian", traits: "Protection, healing, watchfulness." },
  ESTJ: { id: "ESTJ", temperament: "SJ", title: "The Executive", traits: "Management, authority, execution." },
  ESFJ: { id: "ESFJ", temperament: "SJ", title: "The Host", traits: "Social, gatherings, relationships." },
  ISTP: { id: "ISTP", temperament: "SP", title: "The Mechanic", traits: "A loner: mechanical, precise." },
  ISFP: { id: "ISFP", temperament: "SP", title: "The Artist", traits: "Art, freedom, softness." },
  ESTP: { id: "ESTP", temperament: "SP", title: "The Daredevil", traits: "Challenge, speed, adventure." },
  ESFP: { id: "ESFP", temperament: "SP", title: "The Performer", traits: "Stage, party, vivid expression." },
};

export const TEMPERAMENTS = [
  { id: "NT", name: "Analysts", types: ["INTJ", "INTP", "ENTJ", "ENTP"] },
  { id: "NF", name: "Diplomats", types: ["INFJ", "INFP", "ENFJ", "ENFP"] },
  { id: "SJ", name: "Sentinels", types: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"] },
  { id: "SP", name: "Explorers", types: ["ISTP", "ISFP", "ESTP", "ESFP"] },
] as const satisfies readonly { id: string; name: string; types: readonly MBTI[] }[];
