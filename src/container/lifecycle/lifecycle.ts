import { makeInjectable, nodeInject } from "@illuma/core";
import { LIFECYCLE_NODE } from "./tokens";

class _LifecycleManager {
  private readonly _nodes = nodeInject(LIFECYCLE_NODE, { optional: true }) ?? [];

  public mount() {
    for (const node of this._nodes) node.onMount?.();
  }

  public unmount() {
    for (const node of this._nodes) node.onUnmount?.();
  }
}

export const LifecycleManager = makeInjectable(_LifecycleManager);
export type LifecycleManager = _LifecycleManager;
