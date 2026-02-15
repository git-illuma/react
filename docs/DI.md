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

## Reactivity

Illuma services are standard TypeScript classes and exist **outside** of React's render cycle. Changing a property on a service does **not** trigger a re-render by default.

To make components reactive to service state changes, you should use:
1. **Signals** (provided by `@illuma/react-experimental/signals`)
2. External state managers (Zustand, MobX, etc.)
3. `useSyncExternalStore` (if implementing custom observables)

See [Signals Documentation](./SIGNALS.md) for the built-in reactivity solution.
