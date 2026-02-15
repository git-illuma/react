import { MultiNodeToken } from "@illuma/core";
import type { iLifecycleNode } from "./types";

export const LIFECYCLE_NODE = new MultiNodeToken<iLifecycleNode>("illuma:lifecycleNode");
