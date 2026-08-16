import type { iContainerOptions, Provider } from "@illuma/core";
import { NodeContainer } from "@illuma/core";
import { Illuma } from "@illuma/core/plugins";
import { reactDiagnosticsEnabled, trackProviderUsage } from "./diagnostics";

/**
 * The container options a caller may set. `parent` and `weakParentLink` are
 * withheld because React owns both: the tree decides the parent, and a scope is
 * only safe to build during a render because the link is weak.
 *
 * `instant` is withheld because it contradicts that weak link. A weakly linked
 * container that React discards is never destroyed — nothing observes that it
 * became unreachable — so it may only ever hold what is free to drop. Eager
 * instantiation fills a speculative container with live instances whose destroy
 * hooks will never run. Build the container yourself and hand it to
 * `<IllumaRoot container={...}>` when eager really is what you want; there its
 * lifetime is yours and no render can throw it away.
 */
export type ScopeOptions = Omit<
  iContainerOptions,
  "parent" | "weakParentLink" | "instant"
>;

export interface iScopeConfig {
  readonly parent?: NodeContainer;
  readonly providers?: Provider[];
  readonly options?: ScopeOptions;
}

/** What outlives a scope just long enough to tear its container down. */
interface iTeardown {
  container: NodeContainer;
}

/**
 * Destroys a scope's container once the scope itself has been collected.
 *
 * The held value is a plain box and the callback closes over nothing: a held
 * value that reaches its target keeps the target alive forever, which would
 * mean the callback never runs at all.
 */
const SCOPE_TEARDOWN: FinalizationRegistry<iTeardown> | null =
  typeof FinalizationRegistry === "undefined"
    ? null
    : new FinalizationRegistry<iTeardown>((teardown) => tearDown(teardown));

function tearDown(teardown: iTeardown): void {
  try {
    if (!teardown.container.destroyed) teardown.container.destroy();
  } catch (error) {
    // Runs from a collection callback or an unmount microtask, where a throw
    // escapes as an unhandled rejection no error boundary can catch.
    Illuma.logger.error(
      "[@illuma/react] A destroy hook threw while tearing down a scope.",
      error,
    );
  }
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
 * A container lives exactly as long as this object does, and this object lives
 * in `useState`. That is deliberate, and it is the only way to tell React's two
 * kinds of teardown apart: an effect cleanup means the subtree stopped being
 * active, which `<Activity mode="hidden">` also does while keeping its state,
 * whereas losing the state itself means the subtree is really gone. Destroying
 * on the cleanup would throw away a hidden tab's services — and fire
 * `beforeDestroy` for a container that is about to be shown again.
 */
export class ContainerScope {
  private _container: NodeContainer;
  private _retainCount = 0;
  private _report: (() => void) | null = null;
  private readonly _teardown: iTeardown;
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
    this._teardown = { container: this._container };

    if (_owned) SCOPE_TEARDOWN?.register(this, this._teardown, this);
  }

  /**
   * Creates a scope that owns its container and will destroy it once the scope
   * is gone.
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
   * The container to render with.
   *
   * Rebuilding, when it is needed at all, has to happen here rather than on the
   * next commit: React re-renders a re-shown subtree *before* running its
   * effects, so a container revived in an effect would arrive one render too
   * late. Reads are top-down, so a parent revived this way is already live by
   * the time its children read it.
   *
   * Stable between rebuilds, as `useSyncExternalStore` requires.
   */
  public readonly getContainer = (): NodeContainer => {
    if (this._owned && this._container.destroyed) {
      this._container = this._build();
      this._teardown.container = this._container;
    }

    return this._container;
  };

  public readonly subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  /** Marks one live mount, reviving the container if something destroyed it. */
  public retain(): void {
    this._retainCount++;

    const previous = this._container;
    if (this.getContainer() === previous) return;

    for (const listener of [...this._listeners]) listener();
  }

  /**
   * Drops one live mount.
   *
   * The container is deliberately left alone. React runs this same cleanup when
   * a subtree merely goes inactive, and only the collector can tell that apart
   * from the subtree being gone for good.
   *
   * The usage report does fire here rather than at teardown: it is a note to
   * whoever is looking at the console now, and waiting for a collection could
   * mean it never arrives.
   */
  public release(): void {
    if (this._retainCount > 0) this._retainCount--;
    if (this._retainCount > 0) return;

    this._report?.();
    this._report = null;
  }

  /** Tears the container down now, rather than waiting to be collected. */
  public destroy(): void {
    if (!this._owned) return;

    SCOPE_TEARDOWN?.unregister(this);
    tearDown(this._teardown);
  }

  private _build(): NodeContainer {
    const { parent, providers, options } = this._config;

    const container = new NodeContainer({
      ...options,
      instant: false,
      parent,
      weakParentLink: true,
    });

    this._report = reactDiagnosticsEnabled()
      ? trackProviderUsage(container, providers)
      : null;

    if (providers?.length) container.provide(providers);
    container.bootstrap();

    return container;
  }
}
