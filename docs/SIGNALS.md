# Signals

Status: **Experimental**

The `@illuma/react-experimental/signals` package provides a lightweight reactivity system integrated with React. It allows you to model state dependencies efficiently from injected dependencies (that live outside React render cycle) and update React components only when specific data changes.

## Core Primitives

### `signal<T>`

A wrapper around a value that can notify interested consumers when that value changes.

```typescript
import { signal } from '@illuma/react-experimental/signals';

const count = signal(0);

// Read (dependency tracking)
console.log(count()); 

// Write
count.set(5);

// Update based on previous
count.update(prev => prev + 1);
```

### `computed<T>`

A read-only signal that derives its value from other signals. It automatically tracks dependencies and re-evaluates only when necessary.

```typescript
import { computed } from '@illuma/react-experimental/signals';

const count = signal(1);
const double = computed(() => count() * 2);

console.log(double()); // 2
count.set(2);
console.log(double()); // 4
```

### `linkedSignal<T>`

A hybrid signal that updates automatically when its source dependency changes, but can also be manually overridden.

Useful for:
- Form states that reset when selection changes
- synced local state that can diverge

```typescript
import { linkedSignal } from '@illuma/react-experimental/signals';

const userId = signal(1);

// Default name is derived from ID
const formState = linkedSignal(() => {
  const id = userId();
  return { id, name: `User ${id}` };
});

console.log(formState().name); // "User 1"

// User edits form (override)
formState.update((state) => ({ ...state, name: "Alice" }));
console.log(formState().name); // "Alice"

// Selection changes (reset)
userId.set(2);
console.log(formState().name); // "User 2" (Reset to computed value)
```

## React Integration

### `useSignal<T>`

A hook that bridges Signals with React using `useSyncExternalStore`. It subscribes the component to the signal and triggers a re-render when the signal emits a new value.

```tsx
import { useSignal } from '@illuma/react-experimental/signals';

const Counter = () => {
  const value = useSignal(counterSignal);
  return <div>{value}</div>;
};
```

## Internal Mechanics

1. **Dependency Tracking**: 
   When a `computed` or `linkedSignal` executes its function, it pushes itself onto a global context stack. Any signal read during that execution registers the active computation as a subscriber.

2. **Equality Checks**:
   Signals use an equality check (default is `===` or shallow comparison) before notifying listeners. If `set(value)` is called with the same value, no updates propagate.

3. **Lazy Evaluation**:
   Computed signals attempt to be lazy. They track whether their dependencies are dirty and re-evaluate only when read or when dependencies push an update.
