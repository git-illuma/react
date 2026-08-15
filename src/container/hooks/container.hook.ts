import type { NodeContainer } from "@illuma/core";
import { useContext } from "react";
import { DiContext } from "../context";

/**
 * React hook to access the nearest DI container.
 *
 * @returns The container provided by the closest `IllumaRoot` or `ProviderGroup`.
 * @throws If no container is mounted above this component.
 *
 * Example usage:
 * ```tsx
 * function MyComponent() {
 *   const container = useDiContainer();
 *   const myService = container.get(MyService);
 *   // Use myService in the component
 * }
 * ```
 *
 * Prefer `useDependency` for reading a single dependency; reach for the
 * container itself only when the token is not known ahead of render.
 */
export function useDiContainer(): NodeContainer {
  const container = useContext(DiContext);

  if (!container) {
    throw new Error(
      "[@illuma/react] No DI container found. Wrap the tree in <IllumaRoot> (or in a <ProviderGroup> beneath one) before reading dependencies.",
    );
  }

  return container;
}
