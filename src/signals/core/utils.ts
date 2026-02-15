import { type ReadonlySignal, SIGNAL_SYMBOL } from "./types";

export const defaultEqual = <T>(prev: T, next: T) => prev === next;

export function isSignal(value: unknown): value is ReadonlySignal<unknown> {
  return (
    typeof value === "function" &&
    SIGNAL_SYMBOL in value &&
    typeof value[SIGNAL_SYMBOL] === "object"
  );
}
