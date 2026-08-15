import type { NodeContainer } from "@illuma/core";
import { LIFECYCLE_NODE } from "./tokens";

/**
 * Runs one lifecycle hook across every node registered in this container.
 *
 * The lookup is `self`-scoped on purpose: `LIFECYCLE_NODE` is a multi token and
 * multi tokens aggregate up the container tree, so without it a nested group
 * would mount its ancestors' nodes all over again.
 *
 * Reading the nodes off the container rather than through a provided manager is
 * what lets `IllumaRoot container={...}` work: a container built outside React
 * is already bootstrapped, and nothing can be provided into it after that.
 *
 * @internal
 */
export function runLifecycleHook(
  container: NodeContainer,
  hook: "onMount" | "onUnmount",
): void {
  const nodes = container.get(LIFECYCLE_NODE, { optional: true, self: true }) ?? [];

  // One node that throws must not strand the rest; surface the first error
  // after every node has had its turn.
  const errors: unknown[] = [];

  for (const node of nodes) {
    try {
      node[hook]?.();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length) throw errors[0];
}
