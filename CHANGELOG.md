# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Fixed

- A container now lives as long as the component that provides it, rather than as
  long as its effects. React tears effects down whenever a subtree stops being
  active, and `<Activity mode="hidden">` does that while keeping the subtree's
  state — so hiding a tab used to destroy its services and silently discard
  everything they held, while React preserved the `useState` right beside them.
  Teardown now follows the scope itself, which React discards only when the
  subtree is really gone.

  Three further defects fell out of the same root: a descendant re-rendering on
  its own inside a hidden subtree resolved against an already-destroyed container
  (`i300`), a nested group rebuilt onto a destroyed parent (`i304`), and both are
  unreachable now that nothing is destroyed while the scope lives.

  `onMount` and `onUnmount` still bracket activity and fire on every hide and
  show; `LifecycleRef.beforeDestroy` now fires when the container is really going
  away rather than each time a tab was hidden.

  One limitation survives this fix. A signal read through `useSignal` is served
  from the last value it announced, and nothing announces while React has the
  subscription detached. The first frame after a hidden subtree is revealed can
  therefore show the value from when it was hidden, corrected on the next commit.
  Reading the signal directly instead would break React's requirement that two
  snapshot reads agree, which costs an infinite render loop rather than one frame.
- An unmount hook that throws no longer strands the container. Rethrowing out of
  an effect cleanup makes React retain the whole subtree, so the scope was never
  collected and its container never destroyed; the error is reported through
  `Illuma.setLogger` instead.

## 0.3.0 - 2026-08-16

First published release. The package existed before this at `0.1.0` but was
never released, so everything below is new to anyone installing it.

### Added
- `IllumaRoot` and `ProviderGroup` bind a container to a React subtree, and
  `createComponent` wraps a component in one. Resolution walks upward through
  React's context, so the container tree and the component tree are the same
  tree.
- `useDependency` resolves a token, forwarding the container's `optional`,
  `self` and `skipSelf` modifiers. `useDiContainer` returns the container itself
  for the rare case where the token is not known ahead of render.
- Lifecycle hooks. A service registered against `LIFECYCLE_NODE` receives
  `onMount` when its group commits and `onUnmount` when it goes away, which is
  where a service should take and release a resource — a constructor may not,
  because the container runs it more than once and React may discard the
  container it ran it for.
- `IllumaRoot` accepts a `container` built outside React, which is what server
  rendering needs: one container per request, created and destroyed by the
  request handler rather than by a render.
- `@illuma/react-experimental/testkit` — `createTestScope` builds a container the
  test owns and hands back a wrapper for `@testing-library/react`. Swapping one
  token restages the whole graph beneath it.
- `enableReactDiagnostics()` reports, when a scope is torn down, which of its
  providers nothing ever injected. Off by default, silent in production, and its
  output goes through `Illuma.setLogger` alongside the core's own.
- `example/` — a Vite application exercising all of the above in one tree, with
  tests that cover the server-rendering path.

### Changed
- The signals engine moved out into [`@illuma/signals`](https://github.com/git-illuma/signals),
  which this package now depends on rather than duplicating. Its own copy had a
  separate `SIGNAL_SYMBOL`, so a signal from the package was unrecognisable to
  `useSignal`. `@illuma/react-experimental/signals` re-exports the engine and
  adds the `useSignal` bridge.
- A container is owned by a scope with counted retention and a release deferred
  by a microtask, and it is built with a weak link to its parent. A render React
  discards can therefore be collected rather than retained forever: ten
  mount/unmount cycles used to leave ten containers attached to the parent.
- Requires `@illuma/core` 2.5.0 or newer, which is where that weak link lives.

### Fixed
- `useSignal` honours React's snapshot contract. It passed the signal itself as
  `getSnapshot`, and reading a signal does not promise a stable value between
  calls, so React reported an infinite render loop. The hook now serves the last
  value the signal announced.
- A container revived after `<Activity>` re-shows a subtree is rebuilt on read
  rather than on commit, so the first render after the reveal no longer resolves
  against a destroyed container.
- Retention and the mount hooks are paired in `try`/`finally`. A throwing
  `onMount` or `onUnmount` used to leave a container undestroyed, and a throwing
  `onMount` also stranded the nodes that had already mounted, so a service that
  had taken a resource kept it for the life of the page.
- `optional` is delegated to the container, so a service whose constructor throws
  surfaces that instead of resolving to a silent null.
- Lifecycle nodes are read `self`-scoped, so a nested group no longer re-mounts
  its ancestors', and directly off the container, so a container built outside
  React keeps its hooks.
- The context defaults to null rather than a module-level container shared across
  every request on a server and every test in a file.
- The context and `LIFECYCLE_NODE` are keyed on `globalThis`, so the package's
  three bundles agree about who provides what.
- Provider diagnostics see through nested provider arrays, and no longer report a
  lifecycle registration as unused — an instantiation middleware can never
  witness a multi token or an alias.
- Development-only diagnostics stay out of production bundles. The guard read
  `process.env.NODE_ENV` behind a `typeof process` check, which survives a
  bundler's substitution and then evaluates to false in every browser build.
- The published types are reachable from CommonJS, and `/signals` and `/testkit`
  resolve under the legacy `moduleResolution: node`.
