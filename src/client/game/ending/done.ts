// Whether this viewer's ending cinematic has finished, for the run's screens
// (the provider is ScenarioExperience). Kept apart so the room gate can read it
// without loading the cinematic code.
import { createContext, useContext } from "react";

/** True once this viewer's film has played (or was watched earlier this run); false when there is none. */
export const EndingFilmDone = createContext(false);
export const useEndingFilmDone = () => useContext(EndingFilmDone);
