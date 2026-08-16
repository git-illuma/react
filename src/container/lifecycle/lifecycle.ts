import type { NodeContainer } from "@illuma/core";
import { Illuma } from "@illuma/core/plugins";
import { LIFECYCLE_NODE } from "./tokens";
import type { iLifecycleNode } from "./types";

/**
 * The lifecycle nodes registered in this container.
 *
 * The lookup is `self`-scoped on purpose: `LIFECYCLE_NODE` is a multi token and
 * multi tokens aggregate up the container tree, so without it a nested group
 * would mount its ancestors' nodes all over again.
 *
 * Reading the nodes off the container rather than through a provided manager is
 * what lets `IllumaRoot container={...}` work: a container built outside React
 * is already bootstrapped, and nothing can be provided into it after that.
 */
function readNodes(container: NodeContainer): readonly iLifecycleNode[] {
  return container.get(LIFECYCLE_NODE, { optional: true, self: true }) ?? [];
}

/**
 * Reports every error but the one that will be thrown, which would otherwise
 * vanish: a resource that failed to close is worth a line even when a sibling's
 * failure is the one that propagates.
 */
function surface(errors: readonly unknown[]): unknown {
  for (const error of errors.slice(1)) {
    Illuma.logger.error("[@illuma/react] A lifecycle hook threw.", error);
  }

  return errors[0];
}

/**
 * Mounts every node, and every node gets its turn even if an earlier one throws.
 *
 * A throw may not strand what already mounted, either: React registers no
 * cleanup for an effect whose body threw, so nothing downstream would ever
 * unmount them, and a node that took a resource on mount would hold it for the
 * life of the page. They are unwound here instead, and the first error surfaces
 * afterwards.
 *
 * @internal
 */
export function mountLifecycleNodes(container: NodeContainer): void {
  const mounted: iLifecycleNode[] = [];
  const errors: unknown[] = [];

  for (const node of readNodes(container)) {
    try {
      node.onMount?.();
      mounted.push(node);
    } catch (error) {
      errors.push(error);
    }
  }

  if (!errors.length) return;

  for (const node of mounted.reverse()) {
    try {
      node.onUnmount?.();
    } catch (error) {
      errors.push(error);
    }
  }

  throw surface(errors);
}

/**
 * Unmounts every node, giving each its turn even if an earlier one throws.
 *
 * @internal
 */
export function unmountLifecycleNodes(container: NodeContainer): void {
  const errors: unknown[] = [];

  for (const node of readNodes(container)) {
    try {
      node.onUnmount?.();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length) throw surface(errors);
}
