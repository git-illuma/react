import type { NodeContainer as Container, Provider } from "@illuma/core";
import { NodeContainer } from "@illuma/core";
import type { FunctionComponent, ReactNode } from "react";
import { IllumaRoot } from "./container/provider";
import type { ScopeOptions } from "./container/scope";

export interface iTestScopeConfig {
  readonly providers?: Provider[];
  readonly options?: ScopeOptions;
}

export interface iTestScope {
  /** The container under test. Reach into it to assert on or replace instances. */
  readonly container: Container;
  /** Drop-in for `@testing-library/react`'s `wrapper` option. */
  readonly wrapper: FunctionComponent<{ children: ReactNode }>;
  /** Tears the container down. Safe to call more than once. */
  readonly destroy: () => void;
}

/**
 * Builds a container outside React and hands back a wrapper that publishes it.
 *
 * The container is owned by the test, not by a render, so it survives every
 * mount and unmount inside that test and can be inspected after the tree is
 * gone. Swap any token through `providers` to restage the whole graph.
 *
 * @example
 * ```tsx
 * const scope = createTestScope({
 *   providers: [{ provide: ApiService, useClass: FakeApi }],
 * });
 *
 * render(<TodoList />, { wrapper: scope.wrapper });
 * expect(scope.container.get(ApiService)).toBeInstanceOf(FakeApi);
 * scope.destroy();
 * ```
 */
export function createTestScope(config: iTestScopeConfig = {}): iTestScope {
  const container = new NodeContainer({ instant: false, ...config.options });

  if (config.providers?.length) container.provide(config.providers);
  container.bootstrap();

  const wrapper: FunctionComponent<{ children: ReactNode }> = ({ children }) => (
    <IllumaRoot container={container}>{children}</IllumaRoot>
  );

  wrapper.displayName = "IllumaTestScope";

  return {
    container,
    wrapper,
    destroy: () => {
      if (!container.destroyed) container.destroy();
    },
  };
}
