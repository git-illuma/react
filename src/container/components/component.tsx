import type { Provider } from "@illuma/core";
import type { ComponentType, FunctionComponent } from "react";
import { ProviderGroup } from "../provider";

/**
 * Creates a React component wrapped into it's own DI container.
 * It is useful when the component needs to provide it's own providers down the tree.
 * Providers will live as long as the component is mounted and will be disposed when the component unmounts.
 * @param Cmp - The React component to wrap.
 * @param providers - An optional array of providers to be included in the component's DI container.
 * @returns A new React component wrapped with the specified providers.
 *
 *
 * Example usage:
 * ```tsx
 * const TodoScreenComponent = createComponent(() => {
 *   const service = useDependency(TodoScopeService);
 *   return <div>{service.getListLength()}</div>;
 * }, [TodoScopeService]);
 * ```
 * In this example, `TodoScreenComponent` is a React component that has its own DI container with `TodoScopeService` provided.
 * When `TodoScreenComponent` is rendered, it's children and itself can access `TodoScopeService` through the DI container.
 */
export function createComponent<P extends object>(
  Cmp: ComponentType<P>,
  providers?: Provider[],
): FunctionComponent<P> {
  return (props: P) => (
    <ProviderGroup providers={providers}>
      <Cmp {...props} />
    </ProviderGroup>
  );
}
