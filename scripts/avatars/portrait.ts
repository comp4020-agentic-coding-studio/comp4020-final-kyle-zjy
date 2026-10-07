// The 192 character portraits, drawn as layered vector art.
//
//   zodiac → background motif, constellation, palette, hair colour, headpiece
//   MBTI   → head shape, hair style, eyes and mouth, garment, held object
//   hash   → skin tone and one small face detail
//
// Any two characters therefore differ in at least three visible features:
// two different signs differ in motif + palette + headpiece; two different
// types differ in hair + garment + held object (+ face). test/avatars.test.ts
// checks this from the feature list each file carries in <metadata>.
// Deterministic: the same (zodiac, mbti) always produces the same bytes.
import { ZODIAC_INFO } from "../../src/shared/characters/signs.ts";
import { characterId, MBTIS, type MBTI, type Zodiac } from "../../src/shared/characters/types.ts";

export type Features = {
  motif: string;
  palette: string;
  headpiece: string;
  head: string;
  hair: string;
  eyes: string;
  mouth: string;
  garment: string;
  held: string;
  skin: string;
  detail: string;
};

// ---- palettes -------------------------------------------------------------

type ZodiacStyle = {
  bg: [string, string];
  accent: string;
  glow: string;
  metal: string;
  hair: [string, string];
  motif: string;
  headpiece: string;
};

const Z: Record<Zodiac, ZodiacStyle> = {
  aries: { bg: ["#3a0f12", "#12060a"], accent: "#ff6a3d", glow: "#ff8a4c", metal: "#e8b45a", hair: ["#b3262e", "#e0603a"], motif: "flames", headpiece: "ram-horns" },
  taurus: { bg: ["#2c2410", "#0e0b05"], accent: "#d9b45c", glow: "#f2d27a", metal: "#e5c46a", hair: ["#7a4a22", "#c58a3e"], motif: "gilded-leaves", headpiece: "laurel-circlet" },
  gemini: { bg: ["#1d1640", "#0a0818"], accent: "#9c86ff", glow: "#7fe3ff", metal: "#cfd6ff", hair: ["#8d7cf0", "#d8dcf5"], motif: "mirror-split", headpiece: "twin-star-pins" },
  cancer: { bg: ["#102438", "#060d16"], accent: "#b9d3f0", glow: "#e4f0ff", metal: "#f1f4fb", hair: ["#dfe8f5", "#5b6f93"], motif: "moon-waves", headpiece: "crescent-tiara" },
  leo: { bg: ["#3a2408", "#140c03"], accent: "#ffbf3f", glow: "#ffd76b", metal: "#ffd25a", hair: ["#e0a12a", "#a8571d"], motif: "sun-rays", headpiece: "sun-crown" },
  virgo: { bg: ["#1c2230", "#090c14"], accent: "#c7cedb", glow: "#e8eef9", metal: "#dfe5ef", hair: ["#c9ced8", "#4a3f39"], motif: "precision-grid", headpiece: "silver-circlet" },
  libra: { bg: ["#2a2633", "#0e0c14"], accent: "#efe6d2", glow: "#fff6e3", metal: "#f3e7c9", hair: ["#efe2c4", "#6b4f3a"], motif: "balance-scales", headpiece: "white-feather" },
  scorpio: { bg: ["#2a0710", "#0a0205"], accent: "#c4243f", glow: "#ff3d5e", metal: "#b08a5a", hair: ["#160a10", "#5a0f1e"], motif: "obsidian-shards", headpiece: "shadow-veil" },
  sagittarius: { bg: ["#0f1a44", "#050818"], accent: "#6f8cff", glow: "#a9bbff", metal: "#d6defe", hair: ["#24357f", "#d3d9f2"], motif: "star-map", headpiece: "star-circlet" },
  capricorn: { bg: ["#1f1c18", "#0a0907"], accent: "#b39a6a", glow: "#e2cf9e", metal: "#c9a55a", hair: ["#26221e", "#6e6152"], motif: "mountain-ridge", headpiece: "goat-horns" },
  aquarius: { bg: ["#06262a", "#020b0d"], accent: "#38e1d8", glow: "#7ffff5", metal: "#9ff7f1", hair: ["#22c9be", "#1b2a3a"], motif: "circuit-lines", headpiece: "neon-visor" },
  pisces: { bg: ["#0e2442", "#050b18"], accent: "#7fa8e8", glow: "#b9d6ff", metal: "#d9e7ff", hair: ["#6f9fe0", "#a77fd8"], motif: "water-rings", headpiece: "fin-ornaments" },
};

const SKINS = [
  { name: "porcelain", base: "#f4d7c2", shade: "#d9ad94", lip: "#c9726f" },
  { name: "light", base: "#eebf9d", shade: "#cf9a78", lip: "#b8615a" },
  { name: "golden", base: "#d9a27a", shade: "#b47d58", lip: "#a24f48" },
  { name: "tan", base: "#b97d56", shade: "#955c3c", lip: "#7f3c35" },
  { name: "brown", base: "#8c5a3b", shade: "#6c4129", lip: "#5e2c26" },
  { name: "deep", base: "#5e3a26", shade: "#45281a", lip: "#3f1d18" },
];

type MbtiStyle = {
  head: keyof typeof HEADS;
  hair: keyof typeof HAIRS;
  eyes: keyof typeof EYES;
  mouth: keyof typeof MOUTHS;
  garment: keyof typeof GARMENTS;
  held: keyof typeof HELD;
  cloth: [string, string];
};

// ---- head shapes ------------------------------------------------------------

const HEADS = {
  angular: "M70 88C70 66 84 55 100 55C116 55 130 66 130 88L128 107L113 125Q100 131 87 125L72 107Z",
  oval: "M70 90C70 66 84 55 100 55C116 55 130 66 130 90C130 112 116 129 100 129C84 129 70 112 70 90Z",
  round: "M68 92C68 68 83 56 100 56C117 56 132 68 132 92C132 114 118 127 100 127C82 127 68 114 68 92Z",
  heart: "M70 86C70 64 84 55 100 55C116 55 130 64 130 86C130 104 118 120 100 130C82 120 70 104 70 86Z",
};

// ---- hair: [back layer, front layer] ---------------------------------------------

const curls = (cx: number, cy: number, rx: number, ry: number, n: number, r: number, from = 0, to = Math.PI * 2) =>
  Array.from({ length: n }, (_, i) => {
    const a = from + ((to - from) * i) / (n - 1);
    return `<circle cx="${(cx + Math.cos(a) * rx).toFixed(1)}" cy="${(cy + Math.sin(a) * ry).toFixed(1)}" r="${r}"/>`;
  }).join("");

const CAP = "M64 98C62 58 84 44 100 44C118 44 138 58 136 98L132 106L68 106Z";

const HAIRS: Record<string, { back: string; front: string; over?: string }> = {
  sleek: {
    back: `<path d="${CAP}"/>`,
    front: `<path d="M67 86C67 58 86 47 105 48C123 50 135 63 133 86C127 71 113 62 96 63C85 65 75 72 67 86Z"/><path d="M96 63C100 56 108 52 118 52" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>`,
  },
  tousled: {
    back: `<path d="M66 96C64 62 84 48 100 48C116 48 136 62 134 96L130 102L70 102Z"/>`,
    front: `<path d="M66 88L69 66L62 62L75 54L72 42L87 49L93 37L102 48L113 39L115 51L129 46L125 57L138 62L131 70L134 88C124 73 111 67 100 71C88 67 76 73 66 88Z"/>`,
  },
  undercut: {
    back: `<path d="M68 96C66 66 84 52 100 52C116 52 134 66 132 96L128 100L72 100Z" opacity=".55"/>`,
    front: `<path d="M69 82C69 60 84 47 103 45C126 43 140 56 133 77C128 70 120 66 111 64C99 60 84 64 69 82Z"/><path d="M80 60C92 52 110 50 124 54" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>`,
  },
  fringe: {
    back: `<path d="${CAP}"/>`,
    front: `<path d="M65 94C63 62 84 46 105 46C125 46 137 60 134 84C126 74 117 70 108 72C101 81 88 92 73 101Z"/>`,
  },
  long: {
    back: `<path d="M61 92C59 56 82 41 100 41C118 41 141 56 139 92L146 172L54 172Z"/>`,
    front: `<path d="M68 98C66 62 84 50 100 52C116 50 134 62 132 98C128 77 116 63 100 61C84 63 72 77 68 98Z"/>`,
  },
  bob: {
    back: `<path d="M61 94C57 58 82 43 100 43C118 43 143 58 139 94C141 110 137 124 129 129C124 119 76 119 71 129C63 124 59 110 61 94Z"/>`,
    front: `<path d="M68 88C68 62 84 50 100 50C116 50 132 62 132 88C126 80 120 76 114 80C108 72 100 74 96 80C90 72 82 74 78 82C74 80 70 84 68 88Z"/>`,
  },
  wave: {
    back: `<path d="M64 100C62 60 84 45 101 45C120 45 139 60 136 100L131 108L69 108Z"/>`,
    front: `<path d="M67 87C65 60 86 45 107 47C127 49 137 66 133 85C125 66 108 62 96 70C86 66 74 74 67 87Z"/><path d="M84 58C96 50 114 50 126 60" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>`,
  },
  curls: {
    back: `<g>${curls(100, 86, 40, 40, 14, 14, Math.PI * 0.85, Math.PI * 2.15)}</g>`,
    front: `<g>${curls(100, 70, 30, 16, 7, 10, Math.PI * 1.05, Math.PI * 1.95)}</g>`,
  },
  crop: {
    back: `<path d="M66 96C64 62 84 48 100 48C116 48 136 62 134 96L130 100L70 100Z"/>`,
    front: `<path d="M68 86C68 60 84 50 100 50C116 50 132 60 132 86L128 78L72 78Z"/>`,
  },
  bun: {
    back: `<path d="${CAP}"/><circle cx="136" cy="70" r="14"/>`,
    front: `<path d="M67 90C66 62 84 49 101 49C119 49 134 62 133 82C122 70 106 68 92 72C82 76 73 82 67 90Z"/>`,
  },
  sidepart: {
    back: `<path d="M66 96C64 62 84 48 100 48C116 48 136 62 134 96L130 100L70 100Z"/>`,
    front: `<path d="M68 84C68 60 84 50 100 50C118 50 132 60 132 84C130 72 124 66 114 64L110 58C96 62 78 68 68 84Z"/>`,
  },
  twinbuns: {
    back: `<path d="${CAP}"/><circle cx="70" cy="56" r="14"/><circle cx="130" cy="56" r="14"/>`,
    front: `<path d="M68 86C68 62 84 51 100 51C116 51 132 62 132 86C124 78 112 74 100 76C88 74 76 78 68 86Z"/>`,
  },
  forelock: {
    back: `<path d="M66 96C64 62 84 48 100 48C116 48 136 62 134 96L130 100L70 100Z"/>`,
    front: `<path d="M68 84C68 58 86 48 102 48C120 48 134 60 132 84C128 74 122 70 117 70C121 86 117 101 106 108C105 93 98 81 87 73C79 75 73 79 68 84Z"/>`,
  },
  braid: {
    back: `<path d="${CAP}"/>`,
    front: `<path d="M67 90C66 62 84 49 100 49C118 49 134 62 133 90C128 76 118 66 104 64C88 66 74 76 67 90Z"/>`,
    over: `<g>${Array.from({ length: 6 }, (_, i) => `<ellipse cx="${126 + i * 1.6}" cy="${112 + i * 13}" rx="8" ry="8.5"/>`).join("")}</g>`,
  },
  mohawk: {
    back: `<path d="M68 96C66 66 84 54 100 54C116 54 134 66 132 96L128 100L72 100Z" opacity=".5"/>`,
    front: `<path d="M83 72L86 39L95 56L100 31L106 56L115 39L118 72C110 65 92 65 83 72Z"/>`,
  },
  ponytail: {
    back: `<path d="${CAP}"/><path d="M104 46C136 28 166 52 154 94C150 114 160 126 152 138C138 116 138 94 131 72C125 60 113 53 104 52Z"/>`,
    front: `<path d="M67 88C65 60 86 45 106 46C127 47 138 63 133 82C124 66 104 60 90 68C80 72 72 80 67 88Z"/>`,
  },
};

// ---- eyes & mouths (left eye at 88,95; right at 112,95) ----------------------------

const eye = (cx: number, iris: string, opts: { w?: number; h?: number; lid?: number; r?: number; star?: boolean } = {}) => {
  const { w = 8, h = 5, lid = 0, r = 3.4, star = false } = opts;
  const id = `e${cx}`;
  return `<clipPath id="${id}"><path d="M${cx - w} 95Q${cx} ${95 - h * 1.25} ${cx + w} 95Q${cx} ${95 + h} ${cx - w} 95Z"/></clipPath>
<path d="M${cx - w} 95Q${cx} ${95 - h * 1.25} ${cx + w} 95Q${cx} ${95 + h} ${cx - w} 95Z" fill="#f5f1ea"/>
<g clip-path="url(#${id})"><circle cx="${cx}" cy="95.5" r="${r}" fill="${iris}"/><circle cx="${cx}" cy="95.5" r="${r * 0.45}" fill="#0b0b12"/>
<circle cx="${cx + r * 0.4}" cy="${94.2}" r="${r * 0.32}" fill="#fff"/>${lid ? `<rect x="${cx - w}" y="${95 - h * 1.3}" width="${w * 2}" height="${h * 1.3 * lid}" fill="var(--skin)"/>` : ""}</g>
<path d="M${cx - w - 0.5} 95Q${cx} ${95 - h * 1.25 + h * 1.3 * lid * 0.9} ${cx + w + 0.5} 95" fill="none" stroke="#1a1012" stroke-width="1.8" stroke-linecap="round"/>${star ? `<path d="M${cx - 2.6} 92.6l.9 1.6 1.7.4-1.3 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.3-1.2 1.7-.4z" fill="#fff"/>` : ""}`;
};

const closed = (cx: number, up: boolean) =>
  `<path d="M${cx - 7} 95Q${cx} ${up ? 89 : 100} ${cx + 7} 95" fill="none" stroke="#1a1012" stroke-width="2" stroke-linecap="round"/>`;

const brow = (cx: number, inner: number, outer: number, thick = 2.2) => {
  const left = cx < 100;
  const ix = left ? cx + 7 : cx - 7;
  const ox = left ? cx - 8 : cx + 8;
  return `<path d="M${ox} ${outer}Q${cx} ${Math.min(inner, outer) - 2.5} ${ix} ${inner}" fill="none" stroke="var(--brow)" stroke-width="${thick}" stroke-linecap="round"/>`;
};

const EYES: Record<string, (iris: string) => string> = {
  cold: (i) => eye(88, i, { h: 4, lid: 0.35 }) + eye(112, i, { h: 4, lid: 0.35 }) + brow(88, 85, 84, 2.4) + brow(112, 85, 84, 2.4),
  glasses: (i) =>
    eye(88, i, { h: 5 }) + eye(112, i, { h: 5 }) + brow(88, 83, 85) + brow(112, 83, 85) +
    `<g fill="none" stroke="var(--metal)" stroke-width="1.8"><circle cx="88" cy="95" r="10"/><circle cx="112" cy="95" r="10"/><path d="M98 94q2-2 4 0M78 93l-8-2M122 93l8-2"/></g><g fill="#fff" opacity=".12"><circle cx="88" cy="95" r="9"/><circle cx="112" cy="95" r="9"/></g>`,
  sharp: (i) => eye(88, i, { h: 3.6, w: 8.5 }) + eye(112, i, { h: 3.6, w: 8.5 }) + brow(88, 87, 82, 2.6) + brow(112, 87, 82, 2.6),
  sly: (i) => eye(88, i, { h: 4.4, lid: 0.45 }) + eye(112, i, { h: 4.4, lid: 0.3 }) + brow(88, 85, 85) + brow(112, 82, 79),
  serene: (i) => eye(88, i, { h: 4.6, lid: 0.55, r: 3.6 }) + eye(112, i, { h: 4.6, lid: 0.55, r: 3.6 }) + brow(88, 84, 85, 1.8) + brow(112, 84, 85, 1.8),
  dreamy: () => closed(88, false) + closed(112, false) + brow(88, 84, 86, 1.8) + brow(112, 84, 86, 1.8) + `<path d="M81 98l-2 2M95 98l1.5 2M105 98l-1.5 2M119 98l2 2" stroke="#1a1012" stroke-width="1.2"/>`,
  warm: (i) => eye(88, i, { h: 5 }) + eye(112, i, { h: 5 }) + brow(88, 84, 85) + brow(112, 84, 85),
  sparkle: (i) => eye(88, i, { h: 6.5, w: 8.5, r: 4.4, star: true }) + eye(112, i, { h: 6.5, w: 8.5, r: 4.4, star: true }) + brow(88, 82, 83, 2) + brow(112, 82, 83, 2),
  steady: (i) => eye(88, i, { h: 4.8 }) + eye(112, i, { h: 4.8 }) + `<path d="M80 85H95M105 85H120" stroke="var(--brow)" stroke-width="2.4" stroke-linecap="round"/>`,
  kind: (i) => eye(88, i, { h: 5.6, r: 3.8 }) + eye(112, i, { h: 5.6, r: 3.8 }) + brow(88, 82, 85, 2) + brow(112, 82, 85, 2),
  stern: (i) => eye(88, i, { h: 3.8, lid: 0.25 }) + eye(112, i, { h: 3.8, lid: 0.25 }) + `<path d="M79 85.5L96 87M121 85.5L104 87" stroke="var(--brow)" stroke-width="3.2" stroke-linecap="round"/>`,
  happy: () => closed(88, true) + closed(112, true) + brow(88, 83, 84, 2) + brow(112, 83, 84, 2),
  soft: (i) => eye(88, i, { h: 5, lid: 0.4 }) + eye(112, i, { h: 5, lid: 0.4 }) + brow(88, 84, 86, 1.8) + brow(112, 84, 86, 1.8) + `<path d="M80 94l-2.5-2M120 94l2.5-2" stroke="#1a1012" stroke-width="1.3"/>`,
  confident: (i) => eye(88, i, { h: 4, lid: 0.2 }) + eye(112, i, { h: 4, lid: 0.2 }) + brow(88, 86, 83, 2.6) + brow(112, 81, 79, 2.6),
  wink: (i) => eye(88, i, { h: 6, r: 4, star: true }) + closed(112, true) + brow(88, 82, 83, 2) + brow(112, 85, 84, 2),
};

const MOUTHS: Record<string, string> = {
  flat: `<path d="M93 115H107" stroke="var(--lip)" stroke-width="2.4" stroke-linecap="round"/>`,
  smirk: `<path d="M92 115Q101 117 109 112" fill="none" stroke="var(--lip)" stroke-width="2.4" stroke-linecap="round"/>`,
  smile: `<path d="M91 113Q100 120 109 113" fill="none" stroke="var(--lip)" stroke-width="2.4" stroke-linecap="round"/>`,
  grin: `<path d="M90 112Q100 123 110 112Z" fill="#fff" stroke="var(--lip)" stroke-width="2" stroke-linejoin="round"/>`,
  soft: `<path d="M95 115Q100 117 105 115" fill="none" stroke="var(--lip)" stroke-width="2.2" stroke-linecap="round"/>`,
  open: `<path d="M91 112Q100 112 109 112Q107 123 100 123Q93 123 91 112Z" fill="#4a1a22"/><path d="M94 119Q100 116 106 119Q103 122 100 122Q97 122 94 119Z" fill="#d86a78"/>`,
  pout: `<ellipse cx="100" cy="115.5" rx="4" ry="2.6" fill="var(--lip)"/>`,
};

// ---- garments (drawn over the shoulder silhouette) ----------------------------------

const SHOULDERS = "M8 200C14 166 46 146 84 140L100 142L116 140C154 146 186 166 192 200Z";

const GARMENTS: Record<string, (c: [string, string], trim: string) => string> = {
  "high-collar cape": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M84 140L74 118L92 134ZM116 140L126 118L108 134Z" fill="${b}"/><path d="M78 124L100 150L122 124L116 140L100 156L84 140Z" fill="${b}"/><circle cx="100" cy="158" r="5" fill="${t}"/><path d="M100 163V200" stroke="${t}" stroke-opacity=".5"/>`,
  "lab coat": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="#e9edf5"/><path d="M84 140L100 176L116 140L104 142L100 150L96 142Z" fill="${a}"/><path d="M84 140L72 162L92 160L100 200M116 140L128 162L108 160L100 200" fill="none" stroke="#b5bdcc" stroke-width="2"/><rect x="128" y="170" width="16" height="12" rx="2" fill="none" stroke="#b5bdcc" stroke-width="1.5"/><path d="M132 172V164M137 172V162" stroke="${t}" stroke-width="2.4" stroke-linecap="round"/>`,
  "officer coat": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M30 166Q46 150 66 148L64 158Q44 160 34 172ZM170 166Q154 150 134 148L136 158Q156 160 166 172Z" fill="${t}"/><path d="M90 142L100 152L110 142L110 200H90Z" fill="${b}"/><g fill="${t}"><circle cx="100" cy="164" r="2.6"/><circle cx="100" cy="176" r="2.6"/><circle cx="100" cy="188" r="2.6"/></g><path d="M60 200L132 146" stroke="${t}" stroke-width="7" stroke-opacity=".75"/>`,
  "trench and loose tie": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M86 140L100 158L114 140L118 148L104 200H96L82 148Z" fill="#e8e2d6"/><path d="M98 152L94 182L101 190L106 181L102 152Z" fill="${t}" transform="rotate(8 100 160)"/><path d="M84 140L70 168L88 166L96 200M116 140L130 168L112 166L104 200" fill="${b}"/>`,
  "hooded robe": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M80 140L100 176L120 140" fill="none" stroke="${t}" stroke-width="3"/><path d="M84 141L100 170L116 141" fill="${b}"/><circle cx="100" cy="184" r="4" fill="${t}"/>`,
  "sweater and scarf": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M76 138Q100 154 124 138L128 150Q100 168 72 150Z" fill="${t}"/><path d="M110 152L118 196L106 196L102 156Z" fill="${t}"/><path d="M40 180Q60 170 80 176M120 176Q140 170 160 180" fill="none" stroke="${b}" stroke-width="2" opacity=".6"/>`,
  "ceremonial vestment": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M86 141L100 154L114 141L112 200H88Z" fill="${b}"/><path d="M60 152L80 200M140 152L120 200" stroke="${t}" stroke-width="6"/><circle cx="100" cy="170" r="8" fill="none" stroke="${t}" stroke-width="2.5"/><circle cx="100" cy="170" r="3" fill="${t}"/>`,
  hoodie: ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M70 146Q100 166 130 146Q122 136 116 140Q100 152 84 140Q78 136 70 146Z" fill="${b}"/><path d="M92 152V176M108 152V176" stroke="#f3efe6" stroke-width="2" stroke-linecap="round"/><circle cx="92" cy="178" r="2" fill="${t}"/><circle cx="108" cy="178" r="2" fill="${t}"/><path d="M54 176l8 -4 4 8 -8 4z" fill="${t}" opacity=".8"/><circle cx="146" cy="180" r="5" fill="none" stroke="${t}" stroke-width="2"/>`,
  "buttoned uniform": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M86 140H114V150H86Z" fill="${b}"/><path d="M100 150V200" stroke="${b}" stroke-width="2"/><g fill="${t}"><circle cx="104" cy="160" r="2"/><circle cx="104" cy="172" r="2"/><circle cx="104" cy="184" r="2"/></g><path d="M124 160h14v8l-7 4-7-4z" fill="${t}"/>`,
  "shawl and brooch": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M24 178Q60 150 100 160Q140 150 176 178L180 200H20Z" fill="${b}"/><path d="M30 186Q64 164 100 172Q136 164 170 186" fill="none" stroke="${t}" stroke-opacity=".4" stroke-dasharray="3 4"/><circle cx="100" cy="162" r="6" fill="${t}"/><circle cx="100" cy="162" r="2.6" fill="#fff" opacity=".7"/>`,
  "suit and tie": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M86 140L100 168L114 140Z" fill="#f2f2f2"/><path d="M97 146H103L105 174L100 182L95 174Z" fill="${t}"/><path d="M84 140L74 160L90 158L100 182M116 140L126 160L110 158L100 182" fill="${b}"/><rect x="124" y="164" width="12" height="3" fill="#f2f2f2"/>`,
  "cardigan and bow": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M88 140L100 200L112 140Z" fill="#f4ede2"/><path d="M90 146l10 5 10-5v10l-10-5-10 5z" fill="${t}"/><g fill="${b}"><circle cx="86" cy="170" r="2.2"/><circle cx="86" cy="184" r="2.2"/><circle cx="114" cy="170" r="2.2"/><circle cx="114" cy="184" r="2.2"/></g>`,
  "utility jacket": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M100 144V200" stroke="#0d0d0d" stroke-width="2"/><path d="M84 140L100 150L116 140" fill="none" stroke="${b}" stroke-width="5"/><path d="M60 152L82 200M140 152L118 200" stroke="${b}" stroke-width="5"/><rect x="68" y="172" width="16" height="12" rx="1.5" fill="${b}"/><path d="M68 176h16" stroke="${t}" stroke-width="1.5"/>`,
  "paint-splashed smock": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M80 142Q100 160 120 142" fill="none" stroke="${b}" stroke-width="3"/><g fill="${t}" opacity=".85"><circle cx="68" cy="174" r="4"/><circle cx="76" cy="182" r="2"/><circle cx="132" cy="166" r="3.4"/><circle cx="118" cy="186" r="2.4"/></g><circle cx="88" cy="190" r="3" fill="#ff7aa8"/><circle cx="144" cy="186" r="2.4" fill="#ffe27a"/>`,
  "leather jacket": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="#1b1b22"/><path d="M86 140L98 162L92 200M114 140L104 158L110 200" fill="none" stroke="#3b3b48" stroke-width="3"/><path d="M90 142L100 156L110 142Z" fill="${a}"/><path d="M104 158L112 200" stroke="${t}" stroke-width="1.6" stroke-dasharray="2 2"/><path d="M70 150L60 170M130 150L140 170" stroke="#3b3b48" stroke-width="3"/><circle cx="64" cy="186" r="3" fill="${t}"/>`,
  "sequin stage jacket": ([a, b], t) =>
    `<path d="${SHOULDERS}" fill="${a}"/><path d="M86 140L100 166L114 140Z" fill="#111"/><path d="M92 150L100 154L108 150L108 158L100 154L92 158Z" fill="${t}"/><g fill="#fff" opacity=".7">${Array.from({ length: 16 }, (_, i) => `<circle cx="${30 + ((i * 37) % 140)}" cy="${160 + ((i * 23) % 38)}" r="${1 + (i % 3) * 0.5}"/>`).join("")}</g><path d="M84 140L72 164L92 160L100 200M116 140L128 164L108 160L100 200" fill="none" stroke="${b}" stroke-width="3"/>`,
};

// ---- held objects (bottom right, ~40px) --------------------------------------------

const HELD: Record<string, (t: string, m: string) => string> = {
  "chess king": (t, m) =>
    `<g transform="translate(150 152)"><path d="M-12 40H12L9 34H-9ZM-8 34L-6 14H6L8 34Z" fill="#141018" stroke="${m}" stroke-width="1.5"/><circle cx="0" cy="10" r="6" fill="#141018" stroke="${m}" stroke-width="1.5"/><path d="M0 -2V4M-3 1H3" stroke="${m}" stroke-width="2"/></g>`,
  "glass flask": (t) =>
    `<g transform="translate(150 150)"><path d="M-4 0H4V14L14 36Q16 42 10 42H-10Q-16 42 -14 36L-4 14Z" fill="#cfe9ff" fill-opacity=".25" stroke="#e6f3ff" stroke-width="1.6"/><path d="M-11 32H11L13 37Q14 40 10 40H-10Q-14 40 -13 37Z" fill="${t}"/><circle cx="-3" cy="26" r="2" fill="${t}"/><circle cx="3" cy="20" r="1.3" fill="${t}"/></g>`,
  "signet baton": (t, m) =>
    `<g transform="translate(150 152) rotate(-30)"><rect x="-3" y="-4" width="6" height="44" rx="3" fill="#24180f" stroke="${m}" stroke-width="1.2"/><rect x="-4.5" y="-6" width="9" height="6" rx="1.5" fill="${m}"/><rect x="-4.5" y="36" width="9" height="6" rx="1.5" fill="${m}"/><circle cx="0" cy="-9" r="4" fill="${t}"/></g>`,
  "half mask": (t, m) =>
    `<g transform="translate(150 168)"><path d="M-18 -6Q-10 -14 0 -8Q10 -14 18 -6Q16 8 4 8L0 4L-4 8Q-16 8 -18 -6Z" fill="#f2efe8" stroke="${m}" stroke-width="1.5"/><path d="M0 -8Q10 -14 18 -6Q16 8 4 8L0 4Z" fill="${t}"/><ellipse cx="-8" cy="-3" rx="4" ry="2.4" fill="#111"/><ellipse cx="8" cy="-3" rx="4" ry="2.4" fill="#111"/><path d="M-18 -6L-26 14" stroke="${m}" stroke-width="2"/></g>`,
  "tarot card": (t, m) =>
    `<g transform="translate(150 166) rotate(10)"><rect x="-13" y="-20" width="26" height="40" rx="2.5" fill="#141a3a" stroke="${m}" stroke-width="1.6"/><rect x="-9.5" y="-16.5" width="19" height="33" rx="1.5" fill="none" stroke="${m}" stroke-opacity=".5"/><circle cx="0" cy="-2" r="6" fill="none" stroke="${t}" stroke-width="1.5"/><path d="M0 -12V8M-6 12H6" stroke="${t}" stroke-width="1.2"/><circle cx="0" cy="-2" r="2" fill="${t}"/></g>`,
  "paper lantern": (t) =>
    `<g transform="translate(150 162)"><path d="M0 -24V-18" stroke="#3a2a1a" stroke-width="2"/><ellipse cx="0" cy="0" rx="14" ry="18" fill="${t}" opacity=".9"/><ellipse cx="0" cy="0" rx="14" ry="18" fill="#fff4d6" opacity=".35"/><path d="M-14 0H14M-12 -9H12M-12 9H12" stroke="#000" stroke-opacity=".15"/><rect x="-6" y="-20" width="12" height="4" fill="#3a2a1a"/><rect x="-6" y="16" width="12" height="4" fill="#3a2a1a"/><circle cx="0" cy="0" r="22" fill="${t}" opacity=".18"/></g>`,
  "ceremonial candle": (t, m) =>
    `<g transform="translate(150 160)"><rect x="-6" y="0" width="12" height="30" rx="2" fill="#f1e9da"/><path d="M-12 30H12L9 36H-9Z" fill="${m}"/><path d="M0 -14Q6 -6 0 0Q-6 -6 0 -14Z" fill="#ffd36b"/><path d="M0 -9Q3 -5 0 -2Q-3 -5 0 -9Z" fill="#fff"/><circle cx="0" cy="-6" r="12" fill="${t}" opacity=".18"/></g>`,
  sparkler: (t) =>
    `<g transform="translate(146 172) rotate(-25)"><path d="M0 0V30" stroke="#8a8f9c" stroke-width="2"/><g stroke="${t}" stroke-width="1.6" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return `<path d="M${(Math.cos(a) * 4).toFixed(1)} ${(Math.sin(a) * 4).toFixed(1)}L${(Math.cos(a) * (10 + (i % 3) * 3)).toFixed(1)} ${(Math.sin(a) * (10 + (i % 3) * 3)).toFixed(1)}"/>`;
    }).join("")}</g><circle r="3" fill="#fff"/></g>`,
  "ledger and quill": (t, m) =>
    `<g transform="translate(150 168)"><rect x="-16" y="-12" width="32" height="26" rx="2" fill="#3a2716" stroke="${m}" stroke-width="1.4"/><path d="M0 -12V14" stroke="${m}"/><path d="M-12 -6H-4M-12 -1H-4M-12 4H-4M4 -6H12M4 -1H12" stroke="#f3e7cf" stroke-opacity=".6"/><path d="M8 10L26 -26Q30 -20 20 -6Z" fill="#f4f1ea"/><path d="M8 10L22 -16" stroke="${t}" stroke-width="1"/></g>`,
  "wrapped charm": (t, m) =>
    `<g transform="translate(150 166)"><path d="M0 -26V-14" stroke="${m}" stroke-width="1.4"/><path d="M-11 -14H11L9 14Q0 20 -9 14Z" fill="${t}"/><path d="M-10 -6H10M-9 4H9" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/><path d="M-4 14L-6 24M4 14L6 24" stroke="${t}" stroke-width="2"/><circle cx="0" cy="-1" r="3" fill="#fff" opacity=".8"/></g>`,
  "pocket watch": (t, m) =>
    `<g transform="translate(150 168)"><path d="M0 -18Q-14 -30 -28 -24" fill="none" stroke="${m}" stroke-width="1.5" stroke-dasharray="2 1.5"/><circle cx="0" cy="0" r="15" fill="${m}"/><circle cx="0" cy="0" r="12" fill="#f6f1e4"/><path d="M0 0V-8M0 0L6 3" stroke="#222" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="-17" r="2.4" fill="${m}"/><circle r="1.4" fill="${t}"/></g>`,
  teacup: (t, m) =>
    `<g transform="translate(150 172)"><ellipse cx="0" cy="12" rx="20" ry="4" fill="${m}"/><path d="M-13 -6H13Q12 10 0 10Q-12 10 -13 -6Z" fill="#f6f2ea"/><path d="M13 -2Q22 -2 20 5Q18 9 11 6" fill="none" stroke="#f6f2ea" stroke-width="2.4"/><path d="M-9 0H9" stroke="${t}" stroke-width="2"/><path d="M-4 -12Q-1 -16 -4 -20M3 -12Q6 -16 3 -20" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/></g>`,
  wrench: (t, m) =>
    `<g transform="translate(150 166) rotate(35)"><rect x="-3.5" y="-8" width="7" height="36" rx="3" fill="${m}"/><path d="M-10 -10A11 11 0 1 1 10 -10L5 -10L5 -20L-5 -20L-5 -10Z" fill="${m}"/><circle cx="0" cy="22" r="2" fill="${t}"/></g>`,
  paintbrush: (t) =>
    `<g transform="translate(152 168) rotate(-35)"><rect x="-2.5" y="0" width="5" height="34" rx="2.5" fill="#7a4a2a"/><rect x="-3.5" y="-6" width="7" height="8" fill="#c9ced8"/><path d="M-4 -6Q-5 -18 0 -24Q5 -18 4 -6Z" fill="${t}"/></g><circle cx="134" cy="186" r="4" fill="${t}" opacity=".7"/>`,
  "racing goggles": (t, m) =>
    `<g transform="translate(150 170)"><path d="M-24 0Q-26 -12 -12 -12H12Q26 -12 24 0Q22 10 10 8L4 2H-4L-10 8Q-22 10 -24 0Z" fill="#1b1b22" stroke="${m}" stroke-width="1.5"/><ellipse cx="-11" cy="-2" rx="9" ry="7" fill="${t}" opacity=".85"/><ellipse cx="11" cy="-2" rx="9" ry="7" fill="${t}" opacity=".85"/><path d="M-16 -5l6 -3M6 -5l6 -3" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/></g>`,
  microphone: (t, m) =>
    `<g transform="translate(150 164) rotate(20)"><rect x="-4" y="6" width="8" height="30" rx="3" fill="#1d1d26" stroke="${m}"/><circle cx="0" cy="0" r="9" fill="${m}"/><path d="M-7 -3H7M-8 1H8M-6 5H6" stroke="#000" stroke-opacity=".35"/><rect x="-5" y="8" width="10" height="3" fill="${t}"/></g>`,
};

// ---- headpieces (drawn over the hair) -----------------------------------------------

const HEADPIECES: Record<string, (s: ZodiacStyle) => string> = {
  "ram-horns": (s) =>
    `<g fill="none" stroke-linecap="round"><path d="M74 66C58 50 40 58 44 74C47 86 62 84 62 74C62 68 55 68 55 72" stroke="${s.metal}" stroke-width="7"/><path d="M126 66C142 50 160 58 156 74C153 86 138 84 138 74C138 68 145 68 145 72" stroke="${s.metal}" stroke-width="7"/><path d="M74 66C58 50 40 58 44 74" stroke="#7a2a12" stroke-width="2" stroke-dasharray="2 4"/><path d="M126 66C142 50 160 58 156 74" stroke="#7a2a12" stroke-width="2" stroke-dasharray="2 4"/></g>`,
  "laurel-circlet": (s) =>
    `<path d="M70 70Q100 60 130 70" fill="none" stroke="${s.metal}" stroke-width="3"/><g fill="#7da35a">${Array.from({ length: 8 }, (_, i) => {
      const x = 72 + i * 8;
      const y = 69 - Math.sin((i / 7) * Math.PI) * 6;
      return `<ellipse cx="${x}" cy="${y - 3}" rx="2.4" ry="5" transform="rotate(${i < 4 ? -35 : 35} ${x} ${y - 3})"/>`;
    }).join("")}</g><circle cx="100" cy="63" r="3.4" fill="${s.metal}"/>`,
  "twin-star-pins": (s) =>
    `<g fill="${s.glow}"><path d="M72 64l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z"/><path d="M128 64l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z"/></g><path d="M100 46l6 8-6 8-6-8z" fill="${s.accent}"/><path d="M100 46v16" stroke="#fff" stroke-opacity=".7"/>`,
  "crescent-tiara": (s) =>
    `<path d="M72 72Q100 62 128 72" fill="none" stroke="${s.metal}" stroke-width="2.4"/><path d="M100 50A10 10 0 1 0 108 66A8 8 0 1 1 100 50Z" fill="${s.metal}"/><g fill="#fffaf0">${[78, 86, 114, 122].map((x) => `<circle cx="${x}" cy="${x < 100 ? 69 - (x - 78) * 0.15 : 69 - (122 - x) * 0.15}" r="2.4"/>`).join("")}</g>`,
  "sun-crown": (s) =>
    `<path d="M72 70L76 52L86 62L92 44L100 58L108 44L114 62L124 52L128 70Q100 64 72 70Z" fill="${s.metal}" stroke="#7a4a10" stroke-width="1"/><circle cx="100" cy="64" r="4" fill="#c2401a"/><circle cx="84" cy="66" r="2" fill="#fff4c2"/><circle cx="116" cy="66" r="2" fill="#fff4c2"/>`,
  "silver-circlet": (s) =>
    `<path d="M70 74Q100 64 130 74" fill="none" stroke="${s.metal}" stroke-width="2"/><path d="M100 60l7 7-7 7-7-7z" fill="none" stroke="${s.metal}" stroke-width="1.8"/><circle cx="100" cy="67" r="2.6" fill="#9fd8ff"/><path d="M128 74q6-12 2-22M128 66l5-3M129 60l4-3" stroke="#d9c58a" stroke-width="1.6" fill="none"/>`,
  "white-feather": (s) =>
    `<path d="M128 74Q150 40 140 26Q126 46 124 72Z" fill="#fbf8f0"/><path d="M126 72Q136 50 140 28" stroke="#c9c0a8" stroke-width="1" fill="none"/><path d="M84 68Q100 76 116 68" fill="none" stroke="${s.metal}" stroke-width="1.2"/><path d="M100 72V80M94 80H106M94 80l-2 4h4zM106 80l-2 4h4z" stroke="${s.metal}" stroke-width="1.2" fill="${s.metal}"/>`,
  "shadow-veil": (s) =>
    `<path d="M60 96C56 54 80 36 100 36C120 36 144 54 140 96C134 74 120 60 100 60C80 60 66 74 60 96Z" fill="#07030a" opacity=".85"/><path d="M76 66Q100 58 124 66" fill="none" stroke="${s.metal}" stroke-width="1.4"/><path d="M100 60l4 6-4 6-4-6z" fill="${s.accent}"/><path d="M136 70Q152 64 150 50Q148 42 142 46" fill="none" stroke="${s.accent}" stroke-width="2.4" stroke-linecap="round"/><path d="M142 46l-3-5 6 1z" fill="${s.accent}"/>`,
  "star-circlet": (s) =>
    `<path d="M70 72Q100 62 130 72" fill="none" stroke="${s.metal}" stroke-width="1.6"/><g fill="${s.glow}">${[76, 88, 100, 112, 124].map((x, i) => `<circle cx="${x}" cy="${69 - Math.sin((i / 4) * Math.PI) * 4}" r="${i === 2 ? 3 : 1.8}"/>`).join("")}</g><path d="M60 54L140 40" stroke="${s.metal}" stroke-width="2"/><path d="M140 40l-8-3 2 6zM60 54l5 -4M60 54l5 3" stroke="${s.metal}" stroke-width="2" fill="${s.metal}"/>`,
  "goat-horns": (s) =>
    `<g fill="${s.metal}" stroke="#2a1f10" stroke-width="1"><path d="M80 62C74 44 62 34 52 36C64 42 70 54 72 68Z"/><path d="M120 62C126 44 138 34 148 36C136 42 130 54 128 68Z"/></g><path d="M58 40l4 3M64 44l3 3M142 40l-4 3M136 44l-3 3" stroke="#2a1f10" stroke-width="1.2"/>`,
  "neon-visor": (s) =>
    `<rect x="70" y="80" width="60" height="9" rx="4.5" fill="${s.accent}" opacity=".3"/><rect x="70" y="80" width="60" height="9" rx="4.5" fill="none" stroke="${s.glow}" stroke-width="1.6"/><path d="M76 84.5H124" stroke="${s.glow}" stroke-width="1" stroke-dasharray="3 2"/><path d="M130 82L142 60" stroke="${s.metal}" stroke-width="1.6"/><circle cx="142" cy="58" r="3" fill="${s.glow}"/>`,
  "fin-ornaments": (s) =>
    `<path d="M68 96Q52 84 54 70Q62 80 70 86Z" fill="${s.accent}" opacity=".85"/><path d="M132 96Q148 84 146 70Q138 80 130 86Z" fill="${s.accent}" opacity=".85"/><path d="M58 76L66 88M142 76L134 88" stroke="#fff" stroke-opacity=".4"/><g fill="none" stroke="${s.glow}" stroke-opacity=".7"><circle cx="138" cy="52" r="3"/><circle cx="146" cy="44" r="2"/><circle cx="62" cy="50" r="2.4"/></g>`,
};

// ---- background motifs ------------------------------------------------------

const MOTIFS: Record<string, (s: ZodiacStyle) => string> = {
  flames: (s) =>
    [24, 60, 140, 176].map((x, i) => `<path d="M${x} 200Q${x - 14} ${150 - i * 4} ${x} ${118 + (i % 2) * 14}Q${x + 14} ${150 - i * 4} ${x} 200Z" fill="${s.accent}" opacity=".22"/>`).join(""),
  "gilded-leaves": (s) =>
    Array.from({ length: 9 }, (_, i) => `<ellipse cx="${20 + (i * 47) % 170}" cy="${18 + (i * 61) % 120}" rx="5" ry="12" transform="rotate(${i * 40} ${20 + (i * 47) % 170} ${18 + (i * 61) % 120})" fill="${s.accent}" opacity=".18"/>`).join(""),
  "mirror-split": (s) =>
    `<rect x="100" y="0" width="100" height="200" fill="#fff" opacity=".04"/><path d="M100 0V200" stroke="${s.glow}" stroke-opacity=".35"/>${Array.from({ length: 6 }, (_, i) => `<path d="M${10 + i * 14} ${20 + i * 12}H${40 + i * 14}M${160 - i * 14} ${20 + i * 12}H${190 - i * 14}" stroke="${s.accent}" stroke-opacity=".3"/>`).join("")}`,
  "moon-waves": (s) =>
    `<circle cx="160" cy="40" r="20" fill="${s.glow}" opacity=".18"/><circle cx="168" cy="34" r="18" fill="${s.bg[0]}" opacity=".9"/>${[150, 166, 182].map((y) => `<path d="M0 ${y}Q25 ${y - 8} 50 ${y}T100 ${y}T150 ${y}T200 ${y}" fill="none" stroke="${s.accent}" stroke-opacity=".22" stroke-width="2"/>`).join("")}`,
  "sun-rays": (s) =>
    Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return `<path d="M100 92L${(100 + Math.cos(a) * 160).toFixed(0)} ${(92 + Math.sin(a) * 160).toFixed(0)}" stroke="${s.accent}" stroke-opacity="${i % 2 ? 0.08 : 0.16}" stroke-width="${i % 2 ? 6 : 12}"/>`;
    }).join(""),
  "precision-grid": (s) =>
    `<g stroke="${s.accent}" stroke-opacity=".12">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 25} 0V200M0 ${i * 25}H200"/>`).join("")}</g><circle cx="100" cy="92" r="70" fill="none" stroke="${s.accent}" stroke-opacity=".18" stroke-dasharray="1 4"/>`,
  "balance-scales": (s) =>
    `<g stroke="${s.accent}" stroke-opacity=".22" fill="none" stroke-width="1.5"><path d="M30 40H170M100 22V40"/><path d="M30 40L18 70H42ZM170 40L158 70H182Z"/></g>`,
  "obsidian-shards": (s) =>
    [
      [12, 30, 40, 10, 34, 60],
      [160, 20, 196, 50, 170, 70],
      [10, 140, 36, 120, 30, 170],
      [168, 130, 196, 150, 178, 176],
    ].map((p) => `<path d="M${p[0]} ${p[1]}L${p[2]} ${p[3]}L${p[4]} ${p[5]}Z" fill="#000" stroke="${s.accent}" stroke-opacity=".45"/>`).join(""),
  "star-map": (s) =>
    `<g fill="#fff">${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 53) % 200}" cy="${(i * 37) % 130}" r="${0.6 + (i % 3) * 0.4}" opacity="${0.3 + (i % 4) * 0.15}"/>`).join("")}</g><path d="M14 30L40 18L70 26M130 20L160 30L186 18" fill="none" stroke="${s.accent}" stroke-opacity=".3"/>`,
  "mountain-ridge": (s) =>
    `<path d="M0 150L30 110L50 128L80 84L110 120L130 100L160 130L200 96V200H0Z" fill="#000" opacity=".35"/><path d="M80 84L72 96L88 96ZM130 100L124 108L136 108Z" fill="#fff" opacity=".2"/><circle cx="160" cy="40" r="10" fill="none" stroke="${s.accent}" stroke-opacity=".3"/><path d="M160 34V40L164 43" stroke="${s.accent}" stroke-opacity=".4"/>`,
  "circuit-lines": (s) =>
    `<g fill="none" stroke="${s.accent}" stroke-opacity=".28" stroke-width="1.4"><path d="M0 40H30L44 54H60M200 30H170L156 44V70M0 130H20L34 116M200 120H176L164 132"/></g><g fill="${s.glow}" opacity=".5"><circle cx="60" cy="54" r="2.4"/><circle cx="156" cy="70" r="2.4"/><circle cx="34" cy="116" r="2.4"/><circle cx="164" cy="132" r="2.4"/></g>`,
  "water-rings": (s) =>
    `<g fill="none" stroke="${s.accent}" stroke-opacity=".2">${[14, 26, 40].map((r) => `<circle cx="36" cy="40" r="${r}"/><circle cx="168" cy="150" r="${r}"/>`).join("")}</g>`,
};

// ---- per-type assignments ---------------------------------------------------------

const M: Record<MBTI, MbtiStyle> = {
  INTJ: { head: "angular", hair: "sleek", eyes: "cold", mouth: "flat", garment: "high-collar cape", held: "chess king", cloth: ["#14121c", "#26223a"] },
  INTP: { head: "oval", hair: "tousled", eyes: "glasses", mouth: "soft", garment: "lab coat", held: "glass flask", cloth: ["#3b4a6b", "#2a3550"] },
  ENTJ: { head: "angular", hair: "undercut", eyes: "sharp", mouth: "smirk", garment: "officer coat", held: "signet baton", cloth: ["#2a0f1a", "#14070d"] },
  ENTP: { head: "heart", hair: "fringe", eyes: "sly", mouth: "smirk", garment: "trench and loose tie", held: "half mask", cloth: ["#6b4f32", "#4e3922"] },
  INFJ: { head: "oval", hair: "long", eyes: "serene", mouth: "soft", garment: "hooded robe", held: "tarot card", cloth: ["#241b4a", "#352a66"] },
  INFP: { head: "round", hair: "bob", eyes: "dreamy", mouth: "soft", garment: "sweater and scarf", held: "paper lantern", cloth: ["#6f7fa8", "#56658c"] },
  ENFJ: { head: "oval", hair: "wave", eyes: "warm", mouth: "smile", garment: "ceremonial vestment", held: "ceremonial candle", cloth: ["#4a1f3a", "#e9dfd0"] },
  ENFP: { head: "round", hair: "curls", eyes: "sparkle", mouth: "grin", garment: "hoodie", held: "sparkler", cloth: ["#e0784a", "#c45e33"] },
  ISTJ: { head: "angular", hair: "crop", eyes: "steady", mouth: "flat", garment: "buttoned uniform", held: "ledger and quill", cloth: ["#1f2a3a", "#2e3d52"] },
  ISFJ: { head: "round", hair: "bun", eyes: "kind", mouth: "smile", garment: "shawl and brooch", held: "wrapped charm", cloth: ["#5a6f6a", "#b9a98a"] },
  ESTJ: { head: "angular", hair: "sidepart", eyes: "stern", mouth: "flat", garment: "suit and tie", held: "pocket watch", cloth: ["#1a1c24", "#2b2e3a"] },
  ESFJ: { head: "round", hair: "twinbuns", eyes: "happy", mouth: "smile", garment: "cardigan and bow", held: "teacup", cloth: ["#b8687a", "#8f4a5c"] },
  ISTP: { head: "heart", hair: "forelock", eyes: "steady", mouth: "flat", garment: "utility jacket", held: "wrench", cloth: ["#3c4434", "#262b20"] },
  ISFP: { head: "oval", hair: "braid", eyes: "soft", mouth: "soft", garment: "paint-splashed smock", held: "paintbrush", cloth: ["#d9cfb8", "#a79a7c"] },
  ESTP: { head: "heart", hair: "mohawk", eyes: "confident", mouth: "grin", garment: "leather jacket", held: "racing goggles", cloth: ["#a8322a", "#3b3b48"] },
  ESFP: { head: "heart", hair: "ponytail", eyes: "wink", mouth: "open", garment: "sequin stage jacket", held: "microphone", cloth: ["#6a2fd0", "#3a1a80"] },
};

const DETAILS = ["none", "earrings", "freckles", "beauty mark", "brow scar", "face paint"] as const;

/** FNV-1a: a stable small hash for per-character variation. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

function detailSvg(detail: (typeof DETAILS)[number], s: ZodiacStyle): string {
  switch (detail) {
    case "earrings":
      return `<g fill="${s.metal}"><circle cx="69" cy="110" r="2.6"/><path d="M69 112l-3 7h6z"/><circle cx="131" cy="110" r="2.6"/><path d="M131 112l-3 7h6z"/></g>`;
    case "freckles":
      return `<g fill="#7a4a32" opacity=".55">${[[80, 104], [84, 107], [88, 104], [112, 104], [116, 107], [120, 104]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join("")}</g>`;
    case "beauty mark":
      return `<circle cx="118" cy="110" r="1.6" fill="#2a1414"/>`;
    case "brow scar":
      return `<path d="M83 80L90 94" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/>`;
    case "face paint":
      return `<g fill="${s.accent}"><circle cx="80" cy="104" r="1.6"/><circle cx="84" cy="106" r="1.2"/><circle cx="120" cy="104" r="1.6"/><circle cx="116" cy="106" r="1.2"/></g>`;
    default:
      return "";
  }
}

export function portrait(zodiac: Zodiac, mbti: MBTI): { svg: string; features: Features } {
  const id = characterId(zodiac, mbti);
  const s = Z[zodiac];
  const m = M[mbti];
  const h = hash(id);
  const skin = SKINS[h % SKINS.length];
  const detail = DETAILS[(h >>> 4) % DETAILS.length];
  const hairColour = s.hair[MBTIS.indexOf(mbti) % 2];
  const hair = HAIRS[m.hair];
  const info = ZODIAC_INFO[zodiac];
  const stars = info.constellation;
  // constellation drawn small in the upper-left corner, behind everything
  const cx = (x: number) => (12 + x * 0.42).toFixed(1);
  const cy = (y: number) => (10 + y * 0.42).toFixed(1);

  const features: Features = {
    motif: s.motif,
    palette: zodiac,
    headpiece: s.headpiece,
    head: m.head,
    hair: m.hair,
    eyes: m.eyes,
    mouth: m.mouth,
    garment: m.garment,
    held: m.held,
    skin: skin.name,
    detail,
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${info.name} ${mbti} portrait">
<metadata>${JSON.stringify({ id, features })}</metadata>
<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${s.bg[0]}"/><stop offset="1" stop-color="${s.bg[1]}"/></radialGradient>
<radialGradient id="aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${s.glow}" stop-opacity=".45"/><stop offset="1" stop-color="${s.glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="skin" cx="42%" cy="35%" r="70%"><stop offset="0" stop-color="${skin.base}"/><stop offset="1" stop-color="${skin.shade}"/></radialGradient>
<linearGradient id="rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${s.glow}" stop-opacity=".0"/><stop offset=".85" stop-color="${s.glow}" stop-opacity="0"/><stop offset="1" stop-color="${s.glow}" stop-opacity=".35"/></linearGradient>
<linearGradient id="hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(hairColour, 0.22)}"/><stop offset="1" stop-color="${shade(hairColour, -0.28)}"/></linearGradient>
<clipPath id="face"><path d="${HEADS[m.head]}"/></clipPath>
<radialGradient id="vig" cx="50%" cy="45%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
</defs>
<g>
<rect width="200" height="200" fill="url(#bg)"/>
${MOTIFS[s.motif](s)}
<g opacity=".7">${stars.lines.map(([a, b]) => `<path d="M${cx(stars.stars[a][0])} ${cy(stars.stars[a][1])}L${cx(stars.stars[b][0])} ${cy(stars.stars[b][1])}" stroke="${s.glow}" stroke-opacity=".5" stroke-width=".8"/>`).join("")}${stars.stars.map(([x, y]) => `<circle cx="${cx(x)}" cy="${cy(y)}" r="1.4" fill="#fff"/>`).join("")}</g>
<circle cx="100" cy="96" r="78" fill="url(#aura)"/>
<g fill="${shade(hairColour, -0.2)}">${hair.back}</g>
${m.garment === "hooded robe" ? `<path d="M56 150C46 96 66 46 100 44C134 46 154 96 144 150Z" fill="${m.cloth[1]}"/><path d="M62 146C54 100 72 54 100 52C128 54 146 100 138 146" fill="none" stroke="${s.accent}" stroke-opacity=".5" stroke-width="1.5"/>` : ""}
${GARMENTS[m.garment](m.cloth, s.accent)}
<path d="M8 200C14 166 46 146 84 140L100 142L116 140C154 146 186 166 192 200" fill="none" stroke="${s.glow}" stroke-opacity=".35" stroke-width="1.5"/>
<path d="M89 116V142Q100 148 111 142V116Z" fill="${skin.shade}"/>
<path d="M89 126Q100 136 111 126V132Q100 140 89 132Z" fill="#000" opacity=".15"/>
<ellipse cx="69.5" cy="97" rx="5" ry="8" fill="${skin.shade}"/><ellipse cx="130.5" cy="97" rx="5" ry="8" fill="${skin.shade}"/>
<path d="${HEADS[m.head]}" fill="url(#skin)"/>
<path d="${HEADS[m.head]}" fill="url(#rim)"/>
<ellipse cx="81" cy="107" rx="6" ry="3.4" fill="${skin.lip}" opacity=".18"/><ellipse cx="119" cy="107" rx="6" ry="3.4" fill="${skin.lip}" opacity=".18"/>
${EYES[m.eyes](s.accent)}
<path d="M100 99Q98 106 96 108Q99 110 102 108" fill="none" stroke="${skin.shade}" stroke-width="1.6" stroke-linecap="round"/>
${MOUTHS[m.mouth]}
${detailSvg(detail, s)}
<g clip-path="url(#face)"><g fill="#000" opacity=".22" transform="translate(0 3)">${hair.front}</g></g>
<g fill="url(#hair)">${hair.front}</g>
${hair.over ? `<g fill="url(#hair)" stroke="${shade(hairColour, -0.3)}" stroke-width="1">${hair.over}</g>` : ""}
${HEADPIECES[s.headpiece](s)}
${HELD[m.held](s.accent, s.metal)}
<rect width="200" height="200" fill="url(#vig)"/>
<circle cx="100" cy="100" r="97" fill="none" stroke="${s.metal}" stroke-opacity=".35" stroke-width="1.5"/>
</g>
</svg>
`;
  // resolve the colour slots here: var() in SVG presentation attributes isn't reliable across renderers
  const resolved = svg
    .replaceAll("var(--skin)", skin.base)
    .replaceAll("var(--brow)", shade(hairColour, -0.35))
    .replaceAll("var(--lip)", skin.lip)
    .replaceAll("var(--metal)", s.metal);
  return { svg: minify(resolved), features };
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const minify = (svg: string) => svg.replace(/\n\s*/g, "").replace(/>\s+</g, "><");
