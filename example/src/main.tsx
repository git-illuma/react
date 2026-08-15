import { enableReactDiagnostics } from "@illuma/react-experimental";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

/**
 * Reports, when a scope is torn down, which of its providers nothing ever
 * injected. Output goes through `Illuma.setLogger`, so it shares one control
 * surface with the core's diagnostics, and it is a no-op in a production build.
 */
if (import.meta.env.DEV) enableReactDiagnostics();

const host = document.getElementById("root");
if (!host) throw new Error("#root is missing from index.html");

/**
 * StrictMode on purpose. It mounts, unmounts and remounts every effect, which
 * is the cheapest way to catch a resource taken somewhere other than `onMount`.
 * The lifecycle log below should still read mount → unmount → mount, and the
 * live subscription count should stay at one.
 */
createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
