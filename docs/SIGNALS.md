# Signals in React

Status: **Experimental**

The reactivity engine is not part of this package. It is
[`@illuma/signals`](https://github.com/git-illuma/signals): a standalone,
framework-agnostic library, documented in its own README —
`signal`, `computed`, `linkedSignal`, `resource`, `external`, `untracked`,
equality options and the rest.

This package contributes two things and nothing else.

## 1. A re-export

`@illuma/react-experimental/signals` re-exports everything from
`@illuma/signals`, so React code needs one import path rather than two. Both of
these are the same function:

```ts
import { signal } from '@illuma/signals';
import { signal } from '@illuma/react-experimental/signals';
```

`@illuma/signals` is a peer dependency of this package: the re-export does not
bundle it, and the two never end up duplicated in a build.

## 2. `useSignal`

```tsx
import { useDependency } from '@illuma/react-experimental';
import { useSignal } from '@illuma/react-experimental/signals';

export const Counter = () => {
  const service = useDependency(CounterService);
  const count = useSignal(service.count);

  return <button onClick={() => service.increment()}>{count}</button>;
};
```

`useSignal(signal)` subscribes the component to a signal and returns its current
value, re-rendering only when that value actually changes — "changes" meaning
whatever the signal's equality function says it means.

Three things worth knowing:

- **It takes a signal, not a value.** `useSignal(service.count)`, not
  `useSignal(service.count())`. Anything that is not a signal throws.
- **It is safe on a server.** A signal reads synchronously off the server too,
  so the hook passes the same read to `useSyncExternalStore` as its server
  snapshot. Without that argument React refuses to render at all.
- **It is a subscription, not ownership.** The signal belongs to whatever
  created it — usually a service, whose lifetime is a container's, not a
  component's. Unmounting the component unsubscribes; it does not reset state.

## Where state should live

Signals on the service, derivations on the service, components subscribing to
the result:

```ts
class _CartService {
  public readonly items = signal<Item[]>([]);
  public readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + item.price, 0),
  );

  public add(item: Item) {
    this.items.update((prev) => [...prev, item]);
  }
}
```

React then subscribes to a finished value instead of recomputing one on every
render, and the same state is reachable from code that has no component around
it — a route guard, a websocket handler, another service.

Creating signals in a constructor or a field initializer is fine. They are
values, not effects, so the copy built during the container's measuring pass is
simply discarded. See [Writing Services](../README.md#writing-services) for what
a constructor must *not* do.

A working version of all of this is in [`example/`](../example).
