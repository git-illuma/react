import type { NodeContainer } from "@illuma/core";
import type { Context } from "react";
import { createContext } from "react";

/**
 * The context is stashed on `globalThis` under a shared symbol, mirroring how
 * `@illuma/core` keys its own module-level state.
 *
 * This package ships more than one bundle (`.`, `./testkit`) and tsup builds
 * them without code splitting, so each carries its own copy of this module. A
 * plain module-level `createContext` would give the testkit wrapper a different
 * context object from the one `useDependency` reads, and every component would
 * report that no container is mounted above it.
 */
const DI_CONTEXT_KEY = Symbol.for("@illuma/react-experimental/DiContext");

type iDiContextGlobalThis = typeof globalThis & {
  [DI_CONTEXT_KEY]?: Context<NodeContainer | null>;
};

const contextGlobal = globalThis as iDiContextGlobalThis;

if (!contextGlobal[DI_CONTEXT_KEY]) {
  // Null by default on purpose: a module-level container would be built once per
  // module instance and shared by every consumer of it — across every request on
  // a server and across every test in a file.
  contextGlobal[DI_CONTEXT_KEY] = createContext<NodeContainer | null>(null);
}

export const DiContext: Context<NodeContainer | null> = contextGlobal[DI_CONTEXT_KEY];
