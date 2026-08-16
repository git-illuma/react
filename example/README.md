# Example: a screen that owns a subscription

A small application that exercises every claim the [package README](../README.md)
makes, in one tree: a root container, a scope per screen, a service that takes a
resource on mount and gives it back on unmount, signals read through `useSignal`,
a subtree that rebinds one token, and a test that swaps that token for a fake.

It runs. That is the point of it.

## Run it

The adapter is not published yet, so the example consumes the package's own
build output rather than an installed copy. Build the package first.

```bash
# from the package root
bun run build

# from this directory
npx vite          # dev server on http://localhost:5175
npx vitest run    # 6 tests
npx tsc --noEmit  # typecheck
npx vite build    # production build
```

`bun install` is neither needed nor safe here: everything resolves from the
package's own `node_modules`, and an install would go looking for `@illuma/core`
and `@illuma/signals` in a registry that does not have the required versions yet.

## What each part demonstrates

| File | What to look at |
| --- | --- |
| [`src/providers.ts`](./src/providers.ts) | Root providers as a module-level constant, with the outside-world binding kept separate so a test can replace it |
| [`src/app.tsx`](./src/app.tsx) | `IllumaRoot`, and a screen switch that mounts and unmounts a child container |
| [`src/screens/ticker.screen.tsx`](./src/screens/ticker.screen.tsx) | `createComponent` for the screen scope, and a nested `ProviderGroup` that rebinds `TICKER_SOURCE` for its subtree only |
| [`src/services/ticker-feed.ts`](./src/services/ticker-feed.ts) | The subscription taken in `onMount`, released in `onUnmount`, and registered through `LIFECYCLE_NODE` |
| [`src/services/clock.service.ts`](./src/services/clock.service.ts) | The same pattern at the root, to contrast a lifetime that spans screens with one that does not |
| [`src/services/build-probe.ts`](./src/services/build-probe.ts) | Counts its own constructor runs, so the "no side effects in a constructor" rule is a number on screen rather than an assertion in prose |
| [`src/ui/feed-panel.tsx`](./src/ui/feed-panel.tsx) | `useDependency` + `useSignal`, and `skipSelf` reaching past the nearest container |
| [`src/screens/about.screen.tsx`](./src/screens/about.screen.tsx) | `optional` against a token nothing provides |
| [`src/ticker.screen.spec.tsx`](./src/ticker.screen.spec.tsx) | `createTestScope` with a fake source: mount subscribes, unmount releases, StrictMode does not double-subscribe |
| [`src/server-render.spec.tsx`](./src/server-render.spec.tsx) | `IllumaRoot container={...}` on a server: renders, takes no resources, and is destroyed by the caller |

## Things to try in the browser

**Switch to About and back.** The lifecycle log records two
`TickerFeed onUnmount` lines — the screen's feed and the nested group's — while
the root clock keeps counting. Screen state is gone; root state is not.

**Read the two price tables.** Same component, same token, two containers. The
top one resolves `TICKER_SOURCE` upwards to the live source at the root; the
nested one has its own binding and stops after a single burst. The line beneath
them reads the *outer* feed's tick count with `skipSelf`.

**Read the constructor counter on the About screen.** It says 3, for one live
instance. The container builds each provider twice — once against proxy
dependencies to measure the graph, once for real — and StrictMode makes React
build a container it then throws away. Neither number is a contract. The rule
is: a constructor may build fields and inject dependencies, and must cause
nothing to happen.

**Watch the first mount under StrictMode.** The log reads mount → unmount →
mount for every node, and the subscription count still settles at one. That is
the whole reason resources live on `onMount` instead of in a constructor.

## One thing that is scaffolding, not pattern

**The `resolve.alias` block in [`vite.config.ts`](./vite.config.ts)** points the
three entry points at `../dist`, because this example lives inside the package it
demonstrates. Once the package is installed from a registry, plain resolution
does the same job — delete the block when you copy this.
