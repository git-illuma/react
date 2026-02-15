# Illuma React (Experimental)

Experimental React adapter for (@illuma/core)[https://github.com/git-illuma/core] dependency injection container.
This package provides React bindings for Illuma DI system and a lightweight signals implementation for state management.

## Features
- **React Bindings** – Context-based dependency injection for React components
- **Scope Support** – Create child containers for component sub-trees
- **Signals** – Fine-grained reactivity system for state management
- **React Hooks** – `useDependency` for DI and `useSignal` for state

## Installation

```bash
yarn add @illuma/react-experimental @illuma/core
```

## Structure

- `@illuma/react-experimental` – Dependency injection bindings and React integration
- `@illuma/react-experimental/signals` – Signals implementation for state management outside of React's render cycle

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

## Dependency Injection

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

## Signals

This package includes a lightweight signals implementation to manage state outside of React's render cycle effectively.

### Creating Signals

Signals can be created standalone:

```typescript
import { computed, signal } from '@illuma/react-experimental/signals';

const count = signal(0);
const double = computed(() => count() * 2);

count.set(1);
console.log(double()); // 2
```

Or as part of a service:

```typescript
import { makeInjectable } from '@illuma/core';
import { computed, signal } from '@illuma/react-experimental/signals';

class _CounterService {
  public readonly count = signal(0);
  public readonly double = computed(() => this.count() * 2);

  public increment() {
    this.count.update((c) => c + 1);
  }
}

export const CounterService = makeInjectable(_CounterService);
export type CounterService = ReturnType<typeof CounterService>;
```

Then inject and use in a component:

```tsx
import { useDependency } from '@illuma/react-experimental';
import { useSignal } from '@illuma/react-experimental/signals';
import { CounterService } from './services';

export const Counter = () => {
  const service = useDependency(CounterService);
  const count = useSignal(service.count);
  const double = useSignal(service.double);

  return (
    <div>
      <div>Count: {count}</div>
      <div>Double: {double}</div>
      <button onClick={() => service.increment()}>Increment</button>
    </div>
  );
};
```

### Using Signals in React

Use the `useSignal` hook to subscribe to signal changes. The component will re-render only when the signal value changes.

```tsx
import { useSignal } from '@illuma/react-experimental/signals';

export const Counter = () => {
  const value = useSignal(count);

  return (
    <button onClick={() => count.update((v) => v + 1)}>
      Count: {value}
    </button>
  );
};
```

### Linked Signals

`linkedSignal` creates a value that updates when dependencies change but can also be modified manually.
Useful for form state that resets when a selection changes.

```typescript
import { linkedSignal, signal } from '@illuma/react-experimental/signals';

const userId = signal(1);
const userForm = linkedSignal(() => ({ id: userId(), name: '' }));

// Updates when userId changes
userId.set(2);
console.log(userForm().id); // 2

// Can be modified manually
userForm.update((f) => ({ ...f, name: 'Alice' }));
```

## Integration Example

Combining DI and Signals for efficient state management.

```typescript
// user.service.ts
import { NodeInjectable } from '@illuma/core';
import { computed, signal } from '@illuma/react-experimental/signals';

@NodeInjectable()
export class UserService {
  public readonly user = signal({ name: 'Anonymous' });
  public readonly invokeCount = signal(0);

  public readonly displayName = computed(() =>
    `${this.user().name} (Invoked ${this.invokeCount()} times)`,
  );

  public updateName(name: string) {
    this.user.set({ name });
    this.invokeCount.update((c) => c + 1);
  }
}
```

```tsx
// user.component.tsx
import { useDependency } from '@illuma/react-experimental';
import { useSignal } from '@illuma/react-experimental/signals';

export const UserBadge = () => {
  const service = useDependency(UserService);
  const name = useSignal(service.displayName);

  return (
    <div onClick={() => service.updateName('John')}>
      {name}
    </div>
  );
};
```
