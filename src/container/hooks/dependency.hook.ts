import type {
  ExtractInjectedType,
  iNodeInjectorOptions,
  MultiNodeToken,
  NodeToken,
} from "@illuma/core";
import {
  getInjectableToken,
  InjectionError,
  isInjectable,
  isNodeBase,
} from "@illuma/core";
import { useDiContainer } from "./container.hook";

/**
 * React hook to access a dependency from the DI container.
 * @param token - The token representing the dependency to retrieve. It can be a class constructor, a NodeToken, or a MultiNodeToken.
 * @param options - Optional injection options. If `optional` is set to true, the hook will return null instead of throwing an error if the dependency is not found.
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

  let token: any = provider;
  if (isInjectable(provider)) token = getInjectableToken(provider);
  if (!isNodeBase(token)) {
    throw InjectionError.invalidProvider(JSON.stringify(token));
  }

  try {
    return container.get(token as any);
  } catch (e) {
    if (options?.optional) return null as any;
    throw e;
  }
}
