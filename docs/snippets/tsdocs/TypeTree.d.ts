export function TypeTree({ name, type, description, required, deprecated, properties, defaultValue, level }: {
    name: string;
    type: string;
    description?: string | undefined;
    required?: boolean | undefined;
    deprecated?: boolean | undefined;
    properties?: Object[] | undefined;
    defaultValue?: string | undefined;
    level?: number | undefined;
}): import("react/jsx-runtime").JSX.Element;
export function TypeTreeGroup({ title, children }: {
    title?: string | undefined;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export default TypeTree;
//# sourceMappingURL=TypeTree.d.ts.map