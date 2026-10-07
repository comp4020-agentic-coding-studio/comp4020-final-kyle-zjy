// If a screen throws while rendering, show a way back instead of a blank page.
// The run lives on the server, so reloading puts the player back in their seat.
import { Component, type ReactNode } from "react";
import { tNow } from "../i18n/index.ts";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("screen crashed", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="night-sky flex min-h-dvh items-center justify-center px-4" role="alert">
        <div className="tarot w-full max-w-md p-6 text-center">
          <h1 className="font-display text-3xl font-semibold text-gold-bright">{tNow("error.title")}</h1>
          <p className="mt-3 text-mist">{tNow("error.body")}</p>
          <button className="btn btn-gold mt-6 w-full" onClick={() => window.location.reload()}>
            {tNow("error.reload")}
          </button>
        </div>
      </main>
    );
  }
}
