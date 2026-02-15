export interface iLifecycleNode {
  onMount?: () => void;
  onUnmount?: () => void;
}

export interface iOnMountNode {
  onMount: () => void;
}

export interface iOnUnmountNode {
  onUnmount: () => void;
}

export type LifecycleNode = iLifecycleNode | iOnMountNode | iOnUnmountNode;
