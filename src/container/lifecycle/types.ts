/**
 * A service that wants to know when its container's subtree mounts and
 * unmounts. Register one against `LIFECYCLE_NODE` to have the hooks called.
 */
export interface iLifecycleNode {
  onMount?: () => void;
  onUnmount?: () => void;
}
