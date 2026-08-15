import type {
  ExtractInjectedType,
  iNodeInjectorOptions,
  MultiNodeToken,
  NodeToken,
} from "@illuma/core";
import { useDiContainer } from "./container.hook";

/**
 * React hook to access a dependency from the DI container.
 * @param token - The token representing the dependency to retrieve. It can be a class constructor, a NodeToken, or a MultiNodeToken.
 * @param options - Optional injection options. `optional` yields null when nothing provides the token, `self` restricts the lookup to the nearest container, `skipSelf` starts it at the parent.
 * @returns The instance of the requested dependency, or null if not found and `optional` is true.
 *
 * Example usage:
 * ```tsx
 * function MyComponent() {
 *   const myService = useDependency(MyService);
 *   // Use myService in the component
 * }
 * ```
 */
export function useDependency<N>(
  token: N,
  options: iNodeInjectorOptions & { optional: true },
): N extends MultiNodeToken<infer V>
  ? V[]
  : N extends NodeToken<infer U>
    ? U | null
    : N extends new (
          ...args: any[]
        ) => infer T
      ? T | null
      : never;
export function useDependency<N>(
  token: N,
  options?: iNodeInjectorOptions,
): N extends MultiNodeToken<infer V>
  ? V[]
  : N extends NodeToken<infer U>
    ? U
    : N extends new (
          ...args: any
        ) => infer T
      ? T
      : never;
export function useDependency<N extends NodeToken<unknown> | MultiNodeToken<unknown>>(
  token: N,
  options?: iNodeInjectorOptions,
): ExtractInjectedType<N>;
export function useDependency<
  N extends
    | NodeToken<unknown>
    | MultiNodeToken<unknown>
    | (new (
        ...args: any[]
      ) => unknown) = NodeToken<unknown>,
>(provider: N, options?: iNodeInjectorOptions) {
  const container = useDiContainer();

  // Resolution, `optional` included, is the container's job. Catching here would
  // turn a service whose constructor threw into a silent null.
  return container.get(provider as any, options as any);
}
