import { MultiNodeToken } from "@illuma/core";
import type { iLifecycleNode } from "./types";

/**
 * Shared through `globalThis` so every bundle of this package resolves the same
 * token instance. The container keys providers by reference, so two copies of
 * this module would produce two tokens that never see each other's nodes.
 */
const LIFECYCLE_NODE_KEY = Symbol.for("@illuma/react-experimental/LifecycleNode");

type iLifecycleTokenGlobalThis = typeof globalThis & {
  [LIFECYCLE_NODE_KEY]?: MultiNodeToken<iLifecycleNode>;
};

const tokenGlobal = globalThis as iLifecycleTokenGlobalThis;

if (!tokenGlobal[LIFECYCLE_NODE_KEY]) {
  tokenGlobal[LIFECYCLE_NODE_KEY] = new MultiNodeToken<iLifecycleNode>(
    "illuma:lifecycleNode",
  );
}

export const LIFECYCLE_NODE: MultiNodeToken<iLifecycleNode> =
  tokenGlobal[LIFECYCLE_NODE_KEY];
