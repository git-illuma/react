import type { iContainerOptions, Provider } from "@illuma/core";
import { NodeContainer } from "@illuma/core";
import { useEffect, useMemo } from "react";
import { DiContext } from "./context";
import { useDiContainer } from "./hooks/container.hook";
import { LifecycleManager } from "./lifecycle";

type ContainerOpts = Omit<iContainerOptions, "parent">;
export interface ContainerProviderProps extends ContainerOpts {
  readonly children: React.ReactNode;
  readonly providers?: Provider[];
}

export const ProviderGroup = ({
  children,
  providers,
  ...opts
}: ContainerProviderProps) => {
  const parent = useDiContainer();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Should only run once
  const container = useMemo(() => {
    const target = new NodeContainer({ ...opts, parent });

    target.provide(LifecycleManager);
    if (providers?.length) target.provide(providers);
    target.bootstrap();

    return target;
  }, []);

  useEffect(() => {
    const lm = container.get(LifecycleManager);
    lm.mount();

    return () => lm.unmount();
  }, [container]);

  return <DiContext.Provider value={container}>{children}</DiContext.Provider>;
};

export const IllumaRoot = ({ children, providers, ...opts }: ContainerProviderProps) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Should only run once
  const container = useMemo(() => {
    const root = new NodeContainer({ ...opts });

    root.provide(LifecycleManager);
    if (providers?.length) root.provide(providers);
    root.bootstrap();

    return root;
  }, []);

  useEffect(() => {
    const lm = container.get(LifecycleManager);
    lm.mount();

    return () => lm.unmount();
  }, [container]);

  return <DiContext.Provider value={container}>{children}</DiContext.Provider>;
};
