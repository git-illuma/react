import type { NodeContainer, Provider } from "@illuma/core";
import { extractToken, Illuma } from "@illuma/core/plugins";

const state = { enabled: false };

/**
 * Turns on development diagnostics for React scopes.
 *
 * Every scope then reports, when it is torn down, which of its providers were
 * never injected by anything beneath it — the DI equivalent of an unused import.
 *
 * Off by default, and a no-op in production builds. Output goes through
 * `Illuma.setLogger`, so it shares one control surface with the core's own.
 *
 * @example
 * ```ts
 * if (import.meta.env.DEV) enableReactDiagnostics();
 * ```
 */
export function enableReactDiagnostics(): void {
  state.enabled = true;
}

/**
 * `process` is not defined in a browser that loads the ESM build directly, so a
 * bare `process.env.NODE_ENV` read would throw from a dev-only code path.
 *
 * @internal
 */
export function isProduction(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

/** @internal */
export function reactDiagnosticsEnabled(): boolean {
  return state.enabled && !isProduction();
}

/** @internal */
export function __resetReactDiagnostics(): void {
  state.enabled = false;
}

/**
 * The token a provider binds, as an object rather than a name.
 *
 * Identity matters: `toString()` on a token is purely its name, so two distinct
 * tokens that happen to share one would compare equal and a provider could be
 * reported as used because an unrelated namesake was instantiated.
 *
 * @internal
 */
export function providerToken(provider: Provider): object | null {
  if (Array.isArray(provider)) return null;

  const target =
    typeof provider === "object" && provider !== null && "provide" in provider
      ? (provider as { provide: unknown }).provide
      : provider;

  try {
    return extractToken(target as never);
  } catch {
    return null;
  }
}

/**
 * Records which tokens the container really instantiates.
 *
 * Middlewares wrap the real instantiation only — the scan pass that measures a
 * factory's dependencies runs outside them — so this counts constructions the
 * application actually asked for, not the throwaway ones.
 *
 * @internal
 */
export function trackProviderUsage(
  container: NodeContainer,
  providers: Provider[] | undefined,
): () => void {
  const declared = new Set<object>();
  for (const provider of providers ?? []) {
    const token = providerToken(provider);
    if (token) declared.add(token);
  }

  if (!declared.size) return () => undefined;

  const used = new Set<unknown>();
  container.registerMiddleware((params, next) => {
    used.add(params.token);
    return next(params);
  });

  return () => {
    const unused = [...declared].filter((token) => !used.has(token));
    if (!unused.length) return;

    Illuma.logger.warn(
      `[@illuma/react] A scope was torn down without ever injecting: ${unused.map(String).join(", ")}. Provide them closer to where they are used, or drop them.`,
    );
  };
}
