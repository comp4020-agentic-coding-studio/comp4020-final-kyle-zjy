import { useSyncExternalStore } from "react";
import { useT } from "../i18n/index.ts";
import { audio } from "./manager.ts";
import { MUSIC_COMPOSER, MUSIC_LICENSE, MUSIC_TRACKS } from "./catalog.ts";
import "../styles/audio.css";

export function AudioControl() {
  const t = useT();
  const muted = useSyncExternalStore(audio.subscribe, audio.getMuted, () => true);
  const trackId = useSyncExternalStore(audio.subscribe, audio.getTrack, () => null);
  const track = trackId ? MUSIC_TRACKS[trackId] : null;
  return <div className="audio-controls">
    <button className="btn btn-ghost s3-audio-control" aria-pressed={muted} onClick={audio.toggleMute}>
      <span aria-hidden="true">{muted ? "◌" : "◉"}</span>{t(muted ? "opening.soundOff" : "opening.soundOn")}
    </button>
    <details className="music-credits">
      <summary className="btn btn-ghost">{t("music.credits")}</summary>
      <section className="music-credits-panel" aria-label={t("music.credits")}>
        <h2>{t("music.score")}</h2>
        <p className="music-current">{track?.title ?? t("music.silence")}</p>
        <p>{t("music.composer", { name: MUSIC_COMPOSER })}</p>
        <a href={MUSIC_LICENSE} target="_blank" rel="noreferrer">{t("music.license")}</a>
        <p className="music-edit-note">{t("music.edits")}</p>
        <h3>{t("music.recordings")}</h3>
        <ul>{Object.values(MUSIC_TRACKS).map((piece) => <li key={piece.isrc}><a href={piece.source} target="_blank" rel="noreferrer">{piece.title}</a></li>)}</ul>
      </section>
    </details>
  </div>;
}
