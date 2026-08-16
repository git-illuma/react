# Illuma React (Experimental)

Experimental React adapter for the [@illuma/core](https://github.com/git-illuma/core)
dependency injection container.

The adapter's job is to make React's tree and the container's tree the same tree:
a component subtree gets its own container, resolution walks upwards through
React's context, and a container's lifetime is a mount. It also ships a one-hook
bridge to [@illuma/signals](https://github.com/git-illuma/signals) so a service's
state can drive a render.

## Features

- **React bindings** – context-based dependency injection for React components
- **Scopes** – child containers for a component subtree, disposed with it
- **Lifecycle** – `onMount` / `onUnmount` hooks for services that own a resource
- **Signals bridge** – `useSignal` subscribes a component to a signal
- **Diagnostics** – opt-in reporting of providers nothing ever injected
- **Testkit** – a container the test owns, with a ready-made wrapper

## Installation

```bash
yarn add @illuma/react-experimental @illuma/core @illuma/signals
```

All three peers are required. `@illuma/signals` is only used by the `/signals`
entry point, but it is declared as a plain peer dependency, so a package manager
will ask for it either way.

Requires `@illuma/core` 2.5.0 or newer: scopes are built on the container's
`weakParentLink` option, so that a container React builds during a render it later
throws away can be collected instead of being retained by its parent forever.

## Structure

- `@illuma/react-experimental` – dependency injection bindings and React integration
- `@illuma/react-experimental/signals` – re-exports `@illuma/signals` and adds the `useSignal` hook
- `@illuma/react-experimental/testkit` – container-backed wrapper for testing components

## Example

[`example/`](./example) is a small application that puts every section of this
document into one tree — a root container, a scope per screen, a service that
owns a subscription, signals rendered through `useSignal`, a subtree that
rebinds one token, and a test that swaps that token for a fake. It builds, runs
and tests:

```bash
bun run build                      # the package
cd example && npx vite             # http://localhost:5175
cd example && npx vitest run       # 6 tests
```

## Setup

Wrap your application (or a part of it) with `IllumaRoot` to provide a root dependency injection container.

```tsx
import type { Provider } from '@illuma/core';
import { IllumaRoot } from '@illuma/react-experimental';
import { Logger, UserService } from './services';

const appProviders: Provider[] = [Logger, UserService];

export const App = () => (
  <IllumaRoot providers={appProviders}>
    <MyComponent />
  </IllumaRoot>
);
```

Keep that array module-level. `providers` is read once, when the container is
built; a fresh literal on every render would be silently ignored, and the
adapter says so in development.

## Dependency Injection

A detailed guide on how **@illuma/core** DI system works can be found in the [Docs](https://github.com/git-illuma/core/blob/main/docs/GETTING_STARTED.md). 
### Accessing Dependencies

Use the `useDependency` hook to resolve services from the container.

```tsx
import { useDependency } from '@illuma/react-experimental';
import { UserService } from './services';

export const UserProfile = () => {
  const userService = useDependency(UserService);
  
  // Use the service
  return <div>User: {userService.getCurrentUser().name}</div>;
};
```

Services and other providers live outside of React's render cycle, so they won't cause unnecessary re-renders when their state changes.

You can manipulate services directly from React (or elsewhere) without worrying about render cycles, but if you want to trigger a re-render based on a service's state, you should consider using signals or another state management solution of your choice (like Tanstack, Zustand, Jotai, etc.) in combination with your services.

### Component Scopes

You can create a child container for a specific component subtree using `ProviderGroup` or `createComponent`.
Services provided here will be visible only to children of this component, similar to Angular's component providers.

**Option 1: ProviderGroup**

```tsx
import { ProviderGroup } from '@illuma/react-experimental';

export const FeatureSection = () => (
  <ProviderGroup providers={[FeatureService]}>
    <FeatureComponent />
  </ProviderGroup>
);
```

**Option 2: createComponent (HOC)**

```tsx
import { createComponent, useDependency } from '@illuma/react-experimental';

const FeatureComponent = createComponent(() => {
  const service = useDependency(FeatureService);
  return <div>...</div>;
}, [FeatureService]);
```

### Inheritance and Overrides

Child containers inherit all providers from their parents (respecting React's context hierarchy), but you can also override specific providers for a subtree.

```tsx
import type { Provider } from '@illuma/core';
import { ProviderGroup } from '@illuma/react-experimental';

const providers: Provider[] = [
  { provide: UserService, useClass: MockUserService },
];

export const FeatureSection = () => (
  <ProviderGroup providers={providers}>
    <FeatureComponent />
  </ProviderGroup>
);

export const Dashboard = () => (
  <ProviderGroup providers={[UserService]}>
    <FeatureSection />
    <DashboardComponent />
  </ProviderGroup>
);
```

In this example, `FeatureSection` and its children will use `MockUserService`, while `Dashboard` and its children (`DashboardComponent`) will use the original `UserService`.

Overriding means shadowing in a *child* container. Listing two providers for one
token in the same container is an error, not a last-one-wins — which is worth
knowing when you lay out a provider array you also intend to reuse in tests.

### Resolution Modifiers

`useDependency` forwards the container's modifiers.

```tsx
const maybe = useDependency(OptionalService, { optional: true }); // null if unprovided
const own = useDependency(FeatureService, { self: true });        // this group only
const outer = useDependency(ThemeService, { skipSelf: true });    // start at the parent
```

`optional` only covers a token nobody provides. A service whose constructor throws still
throws — a broken dependency is a bug, not an absent one.

## Writing Services

Two rules matter, and both come from the container rather than from React.

**A constructor runs more than once.** The container executes each factory once
against proxy dependencies to measure the graph, then once for real — and React
is free to build a container it later discards, which buys another pair. Under
`StrictMode` a provider's constructor is observed to run three times for the one
instance that survives. The number is not a contract; the rule it forces is.
A constructor may build fields and inject dependencies, and must cause nothing
to happen.

**Resources belong to the mount, not to the constructor.** React may render a component,
build its container, and then discard the whole attempt without ever committing it — and
it does exactly that in `StrictMode`, under Suspense, and whenever a concurrent render is
interrupted. A container from a discarded render is collected silently, so anything a
constructor had opened would never be closed. Open it on mount instead.

```tsx
import { makeInjectable } from '@illuma/core';
import { LIFECYCLE_NODE } from '@illuma/react-experimental';
import { signal } from '@illuma/react-experimental/signals';

class _ClockService {
  private _timer?: ReturnType<typeof setInterval>;

  public readonly seconds = signal(0);

  public onMount() {
    this._timer = setInterval(() => this.seconds.update((n) => n + 1), 1000);
  }

  public onUnmount() {
    clearInterval(this._timer);
  }
}

export const ClockService = makeInjectable(_ClockService);

// Register it as a lifecycle node so the group calls the hooks:
<ProviderGroup providers={[ClockService, { provide: LIFECYCLE_NODE, alias: ClockService }]}>
```

`onMount` runs when the group commits, `onUnmount` when it goes away. Hooks fire only for
nodes registered in that same container, so a nested group never re-mounts its ancestors'.

A service with hooks therefore needs two entries for one class. Provider arrays
nest, so the pair can travel as a single exported constant:

```ts
export const clockProviders: Provider = [
  ClockService,
  { provide: LIFECYCLE_NODE, alias: ClockService },
];
```

## Signals

The reactivity engine is not part of this package. It lives in
[@illuma/signals](https://github.com/git-illuma/signals), knows nothing about
React, and is documented there — `signal`, `computed`, `linkedSignal`,
`resource`, `external`, `untracked` and their options.

What this package adds is the bridge, plus a re-export so you only need one
import path in React code:

```ts
// both work; the second saves you a second dependency in the import list
import { signal, computed } from '@illuma/signals';
import { signal, computed } from '@illuma/react-experimental/signals';
```

### `useSignal`

Subscribes a component to a signal and re-renders it when the value changes.
Built on `useSyncExternalStore`, with the same read used as the server snapshot,
so it is safe under `renderToString`.

```tsx
import { useSignal } from '@illuma/react-experimental/signals';
import { useDependency } from '@illuma/react-experimental';

export const Counter = () => {
  const service = useDependency(CounterService);
  const count = useSignal(service.count);
  const double = useSignal(service.double);

  return (
    <div>
      <div>{count} / {double}</div>
      <button onClick={() => service.increment()}>+1</button>
    </div>
  );
};
```

It takes a signal, not a value, and throws if handed anything else.

### Where the state should live

Put the signals on the service and keep derivations there too. React then
subscribes to a finished value instead of recomputing one on every render, and
the same state is reachable from code that has no component around it.

```ts
import { makeInjectable } from '@illuma/core';
import { computed, signal } from '@illuma/signals';

class _CounterService {
  public readonly count = signal(0);
  public readonly double = computed(() => this.count() * 2);

  public increment() {
    this.count.update((c) => c + 1);
  }
}

export type CounterService = _CounterService;
export const CounterService = makeInjectable(_CounterService);
```

Creating signals in a constructor or a field initializer is fine: they are
values, not effects, and the copy built during the container's measuring pass is
simply discarded.

## Server Rendering

Effects never run on a server, so nothing there can own a container's lifetime. Build one
per request and hand it to `IllumaRoot`, which then only publishes it — never bootstraps,
rebuilds, or destroys it.

```tsx
const container = new NodeContainer({ instant: false });
container.provide(requestProviders);
container.bootstrap();

try {
  return renderToString(
    <IllumaRoot container={container}>
      <App />
    </IllumaRoot>,
  );
} finally {
  container.destroy();
}
```

No mount happens, so no `onMount` does either: a server render resolves services
but takes none of the resources they own.

## Testing

`createTestScope` builds a container the test owns, and returns a wrapper for
`@testing-library/react`. Swapping one token restages the whole graph beneath it.

```tsx
import { createTestScope } from '@illuma/react-experimental/testkit';

const scope = createTestScope({
  providers: [{ provide: ApiService, useClass: FakeApi }],
});

render(<TodoList />, { wrapper: scope.wrapper });

expect(scope.container.get(ApiService)).toBeInstanceOf(FakeApi);
scope.destroy();
```

The container outlives the tree, so it can still be inspected after an unmount.

There is no `overrideProvider`: the test scope *is* a root container, and a
container rejects a second provider for a token it already has. Spreading your
application's whole provider list and appending an override will throw. Split
the list instead, so the bindings a test replaces are not in the part it reuses:

```ts
export const appProviders: Provider[] = [Logger, UserService];
export const platformProviders: Provider[] = [{ provide: ApiService, useClass: HttpApi }];
export const rootProviders: Provider[] = [appProviders, platformProviders];
```

```ts
const scope = createTestScope({
  providers: [appProviders, { provide: ApiService, useClass: FakeApi }],
});
```

## Diagnostics

Opt in during development to be told which providers nothing ever injected.

```ts
import { enableReactDiagnostics } from '@illuma/react-experimental';

if (import.meta.env.DEV) enableReactDiagnostics();
```

Output goes through `Illuma.setLogger`, sharing one control surface with the core's own
diagnostics. It is a no-op in production builds.
