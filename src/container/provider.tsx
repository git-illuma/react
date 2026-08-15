import type { NodeContainer, Provider } from "@illuma/core";
import { Illuma } from "@illuma/core/plugins";
import type { ReactNode } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DiContext } from "./context";
import { isProduction, providerToken } from "./diagnostics";
import { useDiContainer } from "./hooks/container.hook";
import { runLifecycleHook } from "./lifecycle";
import { ContainerScope, type ScopeOptions } from "./scope";

export interface ContainerProviderProps extends ScopeOptions {
  readonly children: ReactNode;
  readonly providers?: Provider[];
}

export interface IllumaRootProps extends ContainerProviderProps {
  /**
   * A container built outside React. When given, this component only publishes
   * it to the tree: it is never bootstrapped, rebuilt, or destroyed here, and
   * `providers` is ignored.
   *
   * This is the form to use on a server, where one container per request must
   * be created and torn down by the request handler rather than by a render.
   */
  readonly container?: NodeContainer;
}

/**
 * Retention and the mount hooks share one effect so their order is fixed:
 * retain (rebuilding the container first if a previous release destroyed it),
 * then mount; on the way out, unmount, then release.
 */
function useScopedContainer(scope: ContainerScope): NodeContainer {
  const container = useSyncExternalStore(
    scope.subscribe,
    scope.getContainer,
    scope.getContainer,
  );

  useEffect(() => {
    scope.retain();

    // Retain and release must be paired whatever the hooks do. A throwing
    // `onMount` would otherwise leave React with no cleanup registered at all,
    // and a throwing `onUnmount` would skip the release outright — either way
    // the container would never be destroyed and its teardown never run.
    const mounted = scope.getContainer();
    try {
      runLifecycleHook(mounted, "onMount");
    } catch (error) {
      scope.release();
      throw error;
    }

    return () => {
      try {
        if (!mounted.destroyed) runLifecycleHook(mounted, "onUnmount");
      } finally {
        scope.release();
      }
    };
  }, [scope]);

  return container;
}

/**
 * Warns when `providers` changes after mount. Providers are read once, when the
 * scope's container is built, exactly as a component's providers are in Angular
 * — a later change is silently ignored, so say so out loud in development.
 */
function useProviderChangeWarning(providers: Provider[] | undefined): void {
  // Compared by the tokens the array binds, not by the array's own identity:
  // the documented shape puts an object literal inline, so identity differs on
  // every render even when the set of providers is unchanged.
  const initial = useRef<Array<object | null> | null>(null);
  initial.current ??= (providers ?? []).map(providerToken);

  useEffect(() => {
    if (isProduction()) return;

    const before = initial.current ?? [];
    const after = (providers ?? []).map(providerToken);
    if (before.length === after.length && before.every((t, i) => t === after[i])) return;

    Illuma.logger.warn(
      "[@illuma/react] `providers` changed after mount and was ignored. A container's providers are fixed when it is built. Remount the group with a different `key` to apply a new set.",
    );
  }, [providers]);
}

/**
 * Creates a React component wrapped into its own DI container.
 * Providers live as long as the group is mounted and are disposed when it unmounts.
 *
 * Example usage:
 * ```tsx
 * <ProviderGroup providers={[TodoScopeService]}>
 *   <TodoList />
 * </ProviderGroup>
 * ```
 */
export const ProviderGroup = ({
  children,
  providers,
  ...opts
}: ContainerProviderProps) => {
  const parent = useDiContainer();
  const makeScope = () => ContainerScope.create({ parent, providers, options: opts });
  const [scope, setScope] = useState(makeScope);

  // A scope cannot outlive the container it was built under, so a new parent
  // means a new scope — used from this render on, not from the next one: the
  // stale scope would rebuild onto its old parent, which is exactly the
  // container that just went away. The old scope is released by the effect
  // cleanup that the scope swap triggers.
  let current = scope;
  if (scope.parent !== parent) {
    current = makeScope();
    setScope(current);
  }

  const container = useScopedContainer(current);
  useProviderChangeWarning(providers);

  return <DiContext.Provider value={container}>{children}</DiContext.Provider>;
};

ProviderGroup.displayName = "ProviderGroup";

/**
 * Roots an Illuma tree. Either builds and owns a container from `providers`, or
 * publishes one that was built outside React and is owned by its creator.
 *
 * Example usage:
 * ```tsx
 * <IllumaRoot providers={[ApiService]}>
 *   <App />
 * </IllumaRoot>
 * ```
 */
export const IllumaRoot = ({
  children,
  providers,
  container: adopted,
  ...opts
}: IllumaRootProps) => {
  const makeScope = () =>
    adopted
      ? ContainerScope.adopt(adopted)
      : ContainerScope.create({ providers, options: opts });

  const [scope, setScope] = useState(makeScope);

  // Covers handing ownership back as well as swapping containers: dropping the
  // prop must stop publishing the caller's container, not keep it forever.
  let current = scope;
  if (adopted ? scope.getContainer() !== adopted : scope.adopted) {
    current = makeScope();
    setScope(current);
  }

  const container = useScopedContainer(current);
  useProviderChangeWarning(adopted ? undefined : providers);

  return <DiContext.Provider value={container}>{children}</DiContext.Provider>;
};

IllumaRoot.displayName = "IllumaRoot";
