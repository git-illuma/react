import type { iContainerOptions, Provider } from "@illuma/core";
import { NodeContainer } from "@illuma/core";
import { Illuma } from "@illuma/core/plugins";
import { reactDiagnosticsEnabled, trackProviderUsage } from "./diagnostics";

/**
 * The container options a caller may set. `parent` and `weakParentLink` are
 * withheld because React owns both: the tree decides the parent, and a scope is
 * only safe to build during a render because the link is weak.
 */
export type ScopeOptions = Omit<iContainerOptions, "parent" | "weakParentLink">;

export interface iScopeConfig {
  readonly parent?: NodeContainer;
  readonly providers?: Provider[];
  readonly options?: ScopeOptions;
}

/**
 * Owns a container on React's terms.
 *
 * React may run a component's render and then throw the result away, and it
 * gives no callback when it does. A container built in that discarded render
 * must therefore be able to disappear on its own — hence `weakParentLink`,
 * which stops the parent from retaining it — and must be cheap to build, hence
 * lazy instantiation.
 *
 * Retention is counted rather than toggled, and release is deferred by a
 * microtask, so StrictMode's mount/unmount/mount cycle re-retains the scope
 * before the release ever runs.
 */
export class ContainerScope {
  private _container: NodeContainer;
  private _retainCount = 0;
  private _releaseScheduled = false;
  private _reportUsage: (() => void) | null = null;
  private readonly _listeners = new Set<() => void>();

  /**
   * The container this scope was built under, or undefined for a root scope.
   * A scope cannot outlive its parent, so a host that sees this drift from the
   * container it currently has must build a new scope.
   */
  public readonly parent?: NodeContainer;

  /** True when the container came from outside React and is not owned here. */
  public get adopted(): boolean {
    return !this._owned;
  }

  private constructor(
    private readonly _config: iScopeConfig,
    private readonly _owned: boolean,
    container?: NodeContainer,
  ) {
    this.parent = _config.parent;
    this._container = container ?? this._build();
  }

  /**
   * Creates a scope that owns its container and will destroy it once nothing
   * retains it any more.
   */
  public static create(config: iScopeConfig = {}): ContainerScope {
    return new ContainerScope(config, true);
  }

  /**
   * Adopts a container built outside React. The scope never destroys it, never
   * rebuilds it, and leaves its lifetime entirely to whoever created it.
   */
  public static adopt(container: NodeContainer): ContainerScope {
    return new ContainerScope({}, false, container);
  }

  /**
   * The container to render with, rebuilt on the spot if a previous release
   * already destroyed it.
   *
   * Rebuilding has to happen here, on the read, rather than on the next commit.
   * React re-renders a re-shown `<Activity>` subtree *before* running its
   * effects, so a container revived in an effect would arrive one render too
   * late and every `useDependency` in that first pass would resolve against a
   * destroyed container. Reads are top-down, so a parent revived this way is
   * already live by the time its children read it.
   *
   * Stable between rebuilds, as `useSyncExternalStore` requires: the result is
   * cached in `_container` and only replaced when the old one is destroyed.
   */
  public readonly getContainer = (): NodeContainer => {
    if (this._owned && this._container.destroyed) this._container = this._build();
    return this._container;
  };

  public readonly subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  /**
   * Marks one live mount and cancels a pending release. Revives the container
   * too, for the narrow window where the deferred release fired between a render
   * and its commit — that rebuild is not visible to the render that already
   * happened, so listeners are told.
   */
  public retain(): void {
    this._releaseScheduled = false;
    this._retainCount++;

    const previous = this._container;
    if (this.getContainer() === previous) return;

    for (const listener of [...this._listeners]) listener();
  }

  /**
   * Drops one live mount. The container is destroyed only if nothing retains it
   * once the current task settles.
   */
  public release(): void {
    if (this._retainCount > 0) this._retainCount--;
    if (this._retainCount > 0 || !this._owned) return;

    this._releaseScheduled = true;
    queueMicrotask(() => {
      if (!this._releaseScheduled) return;
      this._releaseScheduled = false;
      this.destroy();
    });
  }

  public destroy(): void {
    if (!this._owned) return;

    try {
      // The container may already be gone: a parent's destroy cascades down
      // before this scope's own deferred release runs. Report either way.
      if (!this._container.destroyed) this._container.destroy();
    } catch (error) {
      // This runs from a microtask on the unmount path, where a throw would
      // escape as an unhandled rejection no error boundary can catch.
      Illuma.logger.error(
        "[@illuma/react] A destroy hook threw while tearing down a scope.",
        error,
      );
    } finally {
      this._reportUsage?.();
      this._reportUsage = null;
    }
  }

  private _build(): NodeContainer {
    const { parent, providers, options } = this._config;

    const container = new NodeContainer({
      instant: false,
      ...options,
      parent,
      weakParentLink: true,
    });

    if (reactDiagnosticsEnabled()) {
      this._reportUsage = trackProviderUsage(container, providers);
    }

    if (providers?.length) container.provide(providers);
    container.bootstrap();

    return container;
  }
}
