// A character's portrait (public/avatars/<id>.svg), clipped to a circle. If
// the file can't load, the zodiac sigil stands in so a seat is never blank.
import { useState } from "react";
import { getCharacter } from "../../shared/characters/roster/index.ts";
import type { MBTI, Zodiac } from "../../shared/characters/types.ts";
import { useCharacterText, useT } from "../i18n/index.ts";
import { Sigil } from "./Sigil.tsx";

type Props = {
  zodiac: Zodiac;
  mbti: MBTI;
  size?: number;
  dim?: boolean;
  className?: string;
  /** Eager-load for above-the-fold moments (the reveal). */
  eager?: boolean;
};

export function Avatar({ zodiac, mbti, size = 64, dim = false, className = "", eager = false }: Props) {
  const c = getCharacter(zodiac, mbti);
  const [failed, setFailed] = useState(false);
  const t = useT();
  const text = useCharacterText();
  if (failed) return <Sigil zodiac={zodiac} size={size} dim={dim} className={className} />;
  return (
    <img
      src={c.avatar}
      alt={t("card.portraitAlt", { title: text(c.id).title })}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={`block rounded-full select-none ${className}`}
      style={{ opacity: dim ? 0.5 : 1, filter: dim ? "grayscale(0.6)" : undefined }}
    />
  );
}

/** Warm the cache so a portrait is ready before its reveal animation. */
export const preloadAvatar = (zodiac: Zodiac, mbti: MBTI): void => {
  const img = new Image();
  img.src = getCharacter(zodiac, mbti).avatar;
};
