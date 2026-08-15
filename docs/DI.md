# Dependency Injection in React

`@illuma/react-experimental` provides a bridge between React components and Illuma's Dependency Injection system. This allows you to manage complex application state and logic outside of React's component tree while keeping valid access to it.

## Core Concepts

The integration relies on React's Context API to pass the DI Container down the component tree.

### 1. The Container Root

The `IllumaRoot` component initializes the root `NodeContainer`. This is typically placed at the very top of your application.

```tsx
import { IllumaRoot } from '@illuma/react-experimental';

const App = () => (
  <IllumaRoot providers={[GlobalService]}>
    <Main />
  </IllumaRoot>
);
```

Internal mechanics:
1. Creates a new `NodeContainer`.
2. Registers provided services.
3. Bootstraps the container.
4. Stores the container in a React Context (`DiContext`).

### 2. Accessing Services

The `useDependency` hook is the primary way to access services. It consumes the `DiContext` to find the nearest container and requests the dependency.

```tsx
import { useDependency } from '@illuma/react-experimental';

const UserProfile = () => {
  // Looks up UserService in the nearest container
  const userService = useDependency(UserService);
  return <div>{userService.name}</div>;
}
```

If the service is not found in the nearest container, the request bubbles up to parent containers (standard Illuma behavior).

### 3. Hierarchical Injectors (Scopes)

You can create child containers (scopes) using `ProviderGroup` or `createComponent`. This is useful for feature-specific services that should only exist while a specific part of the UI is mounted.

#### ProviderGroup

Creates a child container that inherits from the parent container found in context.

```tsx
<ProviderGroup providers={[FeatureService]}>
  <FeatureComponent /> {/* Can access FeatureService */}
</ProviderGroup>
```

#### createComponent (HOC)

A Higher-Order Component wrapper for `ProviderGroup`.

```tsx
const Feature = createComponent(FeatureView, [FeatureService]);
```

**How Scoping Works:**
1. `ProviderGroup` reads the parent container from `DiContext`.
2. It creates a NEW container, setting the parent to the one from context.
3. It renders a new `DiContext.Provider` with the new child container.
4. Children components now see the child container as their "nearest" container.
5. When `ProviderGroup` unmounts, the child container is destroyed.

## Lifetime

A container's lifetime is a mount, and only a mount. React may render a
component, build its container and discard the whole attempt without ever
committing it, and it gives no callback when it does — so a service takes its
resources in `onMount` and releases them in `onUnmount`, never in a constructor.
The container also builds every provider more than once by design.

Both rules, and what happens if you break them, are in
[Writing Services](../README.md#writing-services).

## Reactivity

Illuma services are standard TypeScript classes and exist **outside** of React's render cycle. Changing a property on a service does **not** trigger a re-render by default.

To make components reactive to service state changes, you should use:
1. **Signals** — [`@illuma/signals`](https://github.com/git-illuma/signals), bridged into React by this package's `useSignal` hook
2. External state managers (Zustand, MobX, etc.)
3. `useSyncExternalStore` (if implementing custom observables)

See [Signals in React](./SIGNALS.md) for the bridge.

## A running version

[`example/`](../example) is a small application built out of exactly these
pieces — root container, screen scope, nested override, lifecycle hooks — that
builds, runs and is covered by tests.
