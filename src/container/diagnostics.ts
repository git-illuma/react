import { MultiNodeToken, type NodeContainer, type Provider } from "@illuma/core";
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
 * Bundlers substitute the literal text `process.env.NODE_ENV`, so the read has
 * to be written out in full for them to fold it. Guarding it with
 * `typeof process` instead would survive the substitution and then evaluate to
 * false in every browser bundle, leaving development-only code live in
 * production. The catch covers the other direction: a browser loading the ESM
 * build with no bundler at all, where `process` really is undefined.
 *
 * @internal
 */
export function isProduction(): boolean {
  try {
    return process.env.NODE_ENV === "production";
  } catch {
    return false;
  }
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
function providerToken(provider: Provider): object | null {
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
 * Provider lists nest — the container accepts that and the docs recommend it
 * for grouping — so anything that reads a list has to descend, or everything
 * below the top level is invisible to it.
 */
function* eachProvider(providers: Provider[] | undefined): Generator<Provider> {
  for (const provider of providers ?? []) {
    if (Array.isArray(provider)) {
      yield* eachProvider(provider);
      continue;
    }

    yield provider;
  }
}

/** @internal */
export function providerTokens(providers: Provider[] | undefined): Array<object | null> {
  return [...eachProvider(providers)].map(providerToken);
}

/**
 * Whether an instantiation middleware could ever witness this token being used.
 *
 * It cannot witness a multi token: resolving one instantiates its members, each
 * under its own token, and never the multi token itself. The same goes for an
 * alias, whose target is what gets built. Counting either as "declared" would
 * report the container's own lifecycle wiring as dead and advise deleting it.
 */
function isObservable(provider: Provider): boolean {
  if (typeof provider !== "object" || provider === null) return true;
  if (!("provide" in provider)) return true;
  if ("alias" in provider) return false;

  return !(provider.provide instanceof MultiNodeToken);
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

  for (const provider of eachProvider(providers)) {
    if (!isObservable(provider)) continue;

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
