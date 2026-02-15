import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { computed, linkedSignal, signal, useSignal } from "../index";

describe("useSignal Hook", () => {
  describe("classic signal", () => {
    it("should initialize with default value", () => {
      const sig = signal(0);
      const { result } = renderHook(() => useSignal(sig));
      expect(result.current).toBe(0);
    });

    it("should initialize without value", () => {
      const sig = signal<string>();
      const { result } = renderHook(() => useSignal(sig));
      expect(result.current).toBeUndefined();
    });

    it("should update value", () => {
      const sig = signal(0);
      const { result } = renderHook(() => useSignal(sig));

      expect(result.current).toBe(0);

      act(() => {
        sig.set(1);
      });

      expect(result.current).toBe(1);
    });

    it("should update value with update method", () => {
      const sig = signal(0);
      const { result } = renderHook(() => useSignal(sig));

      expect(result.current).toBe(0);

      act(() => {
        sig.update((prev) => prev + 1);
      });

      expect(result.current).toBe(1);
    });

    it("should be compatible with multiple subscribers", () => {
      const sig = signal(0);
      const { result: result1 } = renderHook(() => useSignal(sig));
      const { result: result2 } = renderHook(() => useSignal(sig));

      expect(result1.current).toBe(0);
      expect(result2.current).toBe(0);

      act(() => {
        sig.set(5);
      });

      expect(result1.current).toBe(5);
      expect(result2.current).toBe(5);

      act(() => {
        sig.update((prev) => prev * 2);
      });

      expect(result1.current).toBe(10);
      expect(result2.current).toBe(10);
    });

    it("should trigger re-render only when value changes", () => {
      const sig = signal(0);
      const renderSpy = vi.fn();
      renderHook(() => {
        renderSpy();
        return useSignal(sig);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.set(0);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.set(1);
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);

      act(() => {
        sig.update((prev) => prev);
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);

      act(() => {
        sig.update((prev) => prev + 1);
      });
      expect(renderSpy).toHaveBeenCalledTimes(3);
    });

    it("should trigger useEffect and cleanup properly", () => {
      const sig = signal(0);
      const effectSpy = vi.fn();
      const cleanupSpy = vi.fn();

      const { unmount } = renderHook(() => {
        const value = useSignal(sig);
        useEffect(() => {
          act(() => effectSpy(value));

          return () => {
            act(cleanupSpy);
          };
        }, [value]);

        return value;
      });

      expect(effectSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.set(1);
      });

      expect(effectSpy).toHaveBeenCalledTimes(2);

      act(() => {
        sig.set(1);
      });

      expect(effectSpy).toHaveBeenCalledTimes(2);

      unmount();
      expect(cleanupSpy).toHaveBeenCalledTimes(2);
    });

    it("should not update if same reference value is set", () => {
      const obj = { a: 1 };
      const sig = signal(obj);
      const renderSpy = vi.fn();
      renderHook(() => {
        renderSpy();
        return useSignal(sig);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.set(obj);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.update((prev) => prev);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.update((prev) => ({ ...prev }));
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it("should allow custom equality function", () => {
      const sig = signal(0, { equal: (a, b) => Math.abs(a - b) <= 2 });
      const renderSpy = vi.fn();
      renderHook(() => {
        renderSpy();
        return useSignal(sig);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.set(1);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.set(2);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.set(3);
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it("should allow custom equality function with update", () => {
      const sig = signal(0, { equal: (a, b) => Math.abs(a - b) <= 2 });
      const renderSpy = vi.fn();
      renderHook(() => {
        renderSpy();
        return useSignal(sig);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.update((prev) => prev + 1);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.update((prev) => prev + 1);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.update((prev) => prev + 3);
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it("should allow updating with reference with custom equality", () => {
      const sig = signal({ a: 1 }, { equal: (a, b) => a.a === b.a });
      const renderSpy = vi.fn();
      renderHook(() => {
        renderSpy();
        return useSignal(sig);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.set({ a: 1 });
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.update((prev) => ({ ...prev }));
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        sig.update((prev) => ({ a: prev.a + 1 }));
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it("should allow undefined as a value", () => {
      const sig = signal<string | undefined>("initial");
      const { result } = renderHook(() => useSignal(sig));

      expect(result.current).toBe("initial");

      act(() => {
        sig.set(undefined);
      });

      expect(result.current).toBeUndefined();
    });
  });

  describe("computed signal", () => {
    it("should compute value based on dependencies", () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a() + b());

      const { result } = renderHook(() => useSignal(sum));
      expect(result.current).toBe(3);

      act(() => {
        a.set(3);
      });
      expect(result.current).toBe(5);

      act(() => {
        b.set(4);
      });
      expect(result.current).toBe(7);
    });

    it("should not re-compute if dependencies do not change", () => {
      const a = signal(1);
      const b = signal(2);
      const computeSpy = vi.fn(() => a() + b());
      const sum = computed(computeSpy);

      const baseCalls = 6;
      const { result } = renderHook(() => useSignal(sum));
      expect(result.current).toBe(3);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls);

      act(() => {
        a.set(1);
      });
      expect(result.current).toBe(3);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls);

      act(() => {
        b.set(2);
      });
      expect(result.current).toBe(3);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls);

      act(() => {
        a.set(4);
      });
      expect(result.current).toBe(6);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls + 1);
    });

    it("should clean up dependencies when no longer needed", () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a() + b());

      const { result, unmount } = renderHook(() => useSignal(sum));
      expect(result.current).toBe(3);

      unmount();

      act(() => {
        a.set(3);
        b.set(4);
      });

      // No errors should occur and no updates should happen after unmount
    });

    it("should allow nested computed signals", () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a() + b());
      const doubleSum = computed(() => sum() * 2);

      const { result } = renderHook(() => useSignal(doubleSum));
      expect(result.current).toBe(6);

      act(() => {
        a.set(3);
      });
      expect(result.current).toBe(10);

      act(() => {
        b.set(4);
      });
      expect(result.current).toBe(14);
    });

    it("should trigger re-render only when computed value changes", () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a() + b());
      const renderSpy = vi.fn();
      renderHook(() => {
        renderSpy();
        return useSignal(sum);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        a.set(1);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        b.set(2);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        a.set(3);
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);

      act(() => {
        b.set(4);
      });
      expect(renderSpy).toHaveBeenCalledTimes(3);
    });

    it("should allow custom equality function in computed", () => {
      const a = signal(1);
      const b = signal(2);
      const computeSpy = vi.fn(() => a() + b());
      const sum = computed(computeSpy, { equal: (a, b) => Math.abs(a - b) <= 2 });

      const baseCalls = 6;
      const { result } = renderHook(() => useSignal(sum));
      expect(result.current).toBe(3);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls);

      act(() => {
        a.set(2);
      });
      expect(result.current).toBe(3);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls + 1);

      act(() => {
        b.set(3);
      });
      expect(result.current).toBe(3);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls + 2);

      act(() => {
        a.set(5);
      });
      expect(result.current).toBe(8);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls + 3);
    });

    it("should always return to same value when no dependencies", () => {
      const constant = computed(() => 42);

      const { result, unmount } = renderHook(() => useSignal(constant));
      expect(result.current).toBe(42);

      act(() => {
        constant();
      });
      expect(result.current).toBe(42);

      unmount();

      act(() => {
        constant();
      });
      expect(result.current).toBe(42);
    });
  });

  describe("linked signal", () => {
    it("should update linked signal correctly", () => {
      const a = signal(1);
      const linked = linkedSignal(() => a() * 2);

      const { result } = renderHook(() => useSignal(linked));
      expect(result.current).toBe(2);

      act(() => {
        a.set(3);
      });
      expect(result.current).toBe(6);

      act(() => {
        linked.set(10);
      });
      expect(result.current).toBe(10);

      act(() => {
        a.set(4);
      });
      expect(result.current).toBe(8);
    });

    it("should allow explicit configuration", () => {
      const a = signal(1);
      const linked = linkedSignal({
        source: a,
        computation: (src) => src * 3,
      });

      const { result } = renderHook(() => useSignal(linked));
      expect(result.current).toBe(3);

      act(() => {
        a.set(2);
      });
      expect(result.current).toBe(6);

      act(() => {
        linked.set(12);
      });
      expect(result.current).toBe(12);

      act(() => {
        a.set(3);
      });
      expect(result.current).toBe(9);
    });

    it("should trigger re-render only when linked value changes", () => {
      const a = signal(1);
      const linked = linkedSignal(() => a() * 2);
      const renderSpy = vi.fn();
      renderHook(() => {
        renderSpy();
        return useSignal(linked);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        a.set(1);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        a.set(2);
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);

      act(() => {
        linked.set(4);
      });
      expect(renderSpy).toHaveBeenCalledTimes(2);

      act(() => {
        a.set(3);
      });
      expect(renderSpy).toHaveBeenCalledTimes(3);
    });

    it("should clean up dependencies when no longer needed", () => {
      const a = signal(1);
      const linked = linkedSignal(() => a() * 2);

      const { result, unmount } = renderHook(() => useSignal(linked));
      expect(result.current).toBe(2);

      unmount();

      act(() => {
        a.set(3);
      });

      // No errors should occur and no updates should happen after unmount
    });

    it("should allow custom equality function in linked signal", () => {
      const a = signal(1);
      const computeSpy = vi.fn(() => a() * 2);
      const linked = linkedSignal({
        source: a,
        computation: computeSpy,
        equal: (a, b) => Math.abs(a - b) < 2,
      });

      const baseCalls = 5;
      const { result } = renderHook(() => useSignal(linked));
      expect(result.current).toBe(2);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls);

      act(() => {
        a.set(2);
      });
      expect(result.current).toBe(4);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls + 1);

      act(() => {
        a.set(3);
      });
      expect(result.current).toBe(6);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls + 2);

      act(() => {
        a.set(5);
      });
      expect(result.current).toBe(10);
      expect(computeSpy).toHaveBeenCalledTimes(baseCalls + 3);
    });

    it("should behave as a plain signal when no dependencies", () => {
      const linked = linkedSignal(() => 42);

      const { result } = renderHook(() => useSignal(linked));
      expect(result.current).toBe(42);

      act(() => {
        linked.set(24);
      });
      expect(result.current).toBe(24);

      act(() => {
        linked.update((prev) => prev + 1);
      });
      expect(result.current).toBe(25);
    });
  });
});
