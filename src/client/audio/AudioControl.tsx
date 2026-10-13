import { useSyncExternalStore } from "react";
import { useT } from "../i18n/index.ts";
import { audio } from "./manager.ts";

export function AudioControl() {
  const t = useT();
  const muted = useSyncExternalStore(audio.subscribe, audio.getMuted, () => true);
  return <button className="btn btn-ghost s3-audio-control" aria-pressed={muted} onClick={audio.toggleMute}>
    <span aria-hidden="true">{muted ? "◌" : "◉"}</span>{t(muted ? "opening.soundOff" : "opening.soundOn")}
  </button>;
}
