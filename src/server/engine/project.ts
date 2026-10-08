// What one player may see of the run. Everything owner-only (obsession,
// messages, allies, dream cards, peeks, tasks, hidden statuses, other players'
// votes before a vote closes) is removed here, on the server, before anything
// is sent. A client never receives another player's secret, and the owner
// doesn't learn whether their own message or dream is true until the end.
import type { GameState, PlayerId, PlayerSecrets, PlayerView, PublicPlayerState, PublicWindow, ViewerSecrets } from "../../shared/game/state.ts";
import { availableActions } from "./actions.ts";
import { publicCity } from "./scenario02/city.ts";

export function project(s: GameState, viewerId: PlayerId): PlayerView {
  const {
    secrets,
    seed: _seed,
    rng: _rng,
    rngCalls: _rngCalls,
    eventDeck,
    players,
    pending,
    rollContext: _rollContext,
    pendingEffect,
    delayed: _delayed,
    bonds,
    jobs: _jobs,
    triggerQueue: _triggerQueue,
    roundRecord: _roundRecord,
    city: _city,
    ...shared
  } = s;
  const over = s.phase === "RESULTS" || s.phase === "ENDING";

  const publicPlayers: Record<PlayerId, PublicPlayerState> = {};
  for (const [id, p] of Object.entries(players)) {
    const { storedResult, counters: _counters, statuses, ...rest } = p;
    publicPlayers[id] = {
      ...rest,
      statuses: id === viewerId || over ? statuses : statuses.filter((st) => !st.hidden),
      hasStoredResult: storedResult !== null,
    };
  }

  const windows: PublicWindow[] = pending.map(({ resume: _resume, answers, ...w }) => ({
    ...w,
    answeredBy: Object.keys(answers),
    myAnswer: answers[viewerId] ?? null,
  }));

  return {
    ...shared,
    viewerId,
    mySecrets: secrets[viewerId] ? ownSecrets(secrets[viewerId], over) : null,
    players: publicPlayers,
    pending: windows,
    incoming: pendingEffect ? { label: pendingEffect.label, targetId: pendingEffect.targetId, sourceId: pendingEffect.sourceId } : null,
    bonds: bonds.filter((b) => !b.secret || b.members.includes(viewerId) || b.ownerId === viewerId).map(({ fired: _fired, ...b }) => b),
    myActions: availableActions(s, viewerId),
    deckSize: eventDeck.length,
    city: publicCity(s, viewerId),
  };
}

/** Truth values stay on the server until the run is over (results reveal them). */
function ownSecrets(sec: PlayerSecrets, over: boolean): ViewerSecrets {
  if (over) return sec;
  return {
    ...sec,
    messages: sec.messages,
    dreamCards: sec.dreamCards,
  };
}
