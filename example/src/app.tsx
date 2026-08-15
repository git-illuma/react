import { IllumaRoot } from "@illuma/react-experimental";
import { useState } from "react";
import { rootProviders } from "./providers";
import { AboutScreen } from "./screens/about.screen";
import { TickerScreen } from "./screens/ticker.screen";
import { ClockBadge, EventLogPanel } from "./ui/side-panels";

type Screen = "ticker" | "about";

/**
 * Everything below `IllumaRoot` shares one root container. Switching screens
 * mounts and unmounts a child container beneath it; the root is untouched.
 */
export const App = () => {
  const [screen, setScreen] = useState<Screen>("ticker");

  return (
    <IllumaRoot providers={rootProviders}>
      <header className="topbar">
        <h1>@illuma/react-experimental</h1>
        <nav>
          <button
            type="button"
            className={screen === "ticker" ? "active" : ""}
            onClick={() => setScreen("ticker")}
          >
            Ticker
          </button>
          <button
            type="button"
            className={screen === "about" ? "active" : ""}
            onClick={() => setScreen("about")}
          >
            About
          </button>
        </nav>
        <ClockBadge />
      </header>

      <main>
        {screen === "ticker" ? <TickerScreen /> : <AboutScreen />}
        <EventLogPanel />
      </main>
    </IllumaRoot>
  );
};
