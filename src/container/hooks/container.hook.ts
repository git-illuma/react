import { useContext } from "react";
import { DiContext } from "../context";

/**
 * React hook to access the DI container (NodeContainer) from the context.
 * @returns The DI container instance.
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
 * This hook allows components to access the DI container and retrieve dependencies as needed.
 *
 * Alternatively, you can access similar functionality through the
 * `useDependency(Injector)` hook, which is a more convenient way to get specific dependencies
 * directly outside Injection context.
 */
export function useDiContainer() {
  return useContext(DiContext);
}
