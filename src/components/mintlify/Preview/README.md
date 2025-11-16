# Preview Component

A tabbed component that displays both a live preview and the source code of React components, with copy-to-clipboard functionality on both tabs.

## Features

- **Two Tabs**: Toggle between Preview and Code views
- **Copy Button**: Copy code from either tab
- **Syntax Highlighting**: Code is displayed with proper formatting
- **Dark Mode Support**: Automatic dark mode styling
- **Mintlify Integration**: Matches Mintlify's design system

## Usage

```tsx
import { Preview } from './components/mintlify/Preview';
import { TypeTree } from './components/TypeTree';

<Preview
  code={`<TypeTree
  name="config"
  type="object"
  description="Configuration settings"
/>`}
>
  <TypeTree
    name="config"
    type="object"
    description="Configuration settings"
  />
</Preview>
```

## Props

### `code` (required)

**Type**: `string`

The JSX code as a string. This is what gets displayed in the Code tab and what gets copied to the clipboard.

```tsx
code={`<MyComponent prop="value" />`}
```

### `children` (required)

**Type**: `ReactNode`

The rendered component to display in the Preview tab. This should be the actual component instance.

```tsx
<Preview code="...">
  <MyComponent prop="value" />
</Preview>
```

### `title`

**Type**: `string` (optional)

Optional title displayed above the preview content.

```tsx
title="API Response Type"
```

### `tooltipColor`

**Type**: `string` (optional)

**Default**: `#0D9373`

Background color for the copy button tooltip.

```tsx
tooltipColor="#0D9373"
```

### `onCopied`

**Type**: `(result: CopyToClipboardResult, textToCopy?: string) => void` (optional)

Callback function triggered when the copy button is clicked.

```tsx
onCopied={(result, text) => {
  console.log('Copied:', result, text);
}}
```

### `className`

**Type**: `string` (optional)

Additional CSS classes for the container.

```tsx
className="my-8"
```

### `defaultTab`

**Type**: `'preview' | 'code'` (optional)

**Default**: `'preview'`

Which tab should be active by default.

```tsx
defaultTab="code"
```

## Examples

### Basic Component Preview

```tsx
<Preview
  code={`<Button variant="primary">Click me</Button>`}
>
  <Button variant="primary">Click me</Button>
</Preview>
```

### With TypeTree

```tsx
<Preview
  code={`<TypeTree
  name="user"
  type="object"
  required={true}
  properties={[
    { name: "id", type: "string", required: true },
    { name: "email", type: "string", required: true },
    { name: "name", type: "string" }
  ]}
/>`}
>
  <TypeTree
    name="user"
    type="object"
    required={true}
    properties={[
      { name: "id", type: "string", required: true },
      { name: "email", type: "string", required: true },
      { name: "name", type: "string" }
    ]}
  />
</Preview>
```

### With Title and Custom Color

```tsx
<Preview
  title="Configuration Object"
  tooltipColor="#FF6B6B"
  code={`<MyConfig />`}
>
  <MyConfig />
</Preview>
```

### Default to Code Tab

```tsx
<Preview
  defaultTab="code"
  code={`<Example />`}
>
  <Example />
</Preview>
```

## Styling

The Preview component uses Tailwind CSS classes and integrates with Mintlify's design system:

- **Preview Tab**: White background (dark mode: dark slate)
- **Code Tab**: Uses syntax highlighting from your setup
- **Tabs**: Matches Mintlify's tab styling
- **Copy Button**: Reuses CopyToClipboardButton from Code components

## Tips

### Code Formatting

Use template literals with proper indentation for clean code display:

```tsx
code={`<TypeTree
  name="example"
  type="string"
  required={true}
/>`}
```

### Multiline Code

For complex components, consider using `String.raw` or formatting the code string:

```tsx
const exampleCode = `
<ComplexComponent
  prop1="value1"
  prop2="value2"
>
  <ChildComponent />
</ComplexComponent>
`.trim();

<Preview code={exampleCode}>
  <ComplexComponent prop1="value1" prop2="value2">
    <ChildComponent />
  </ComplexComponent>
</Preview>
```

### Reusing Code

Extract the code string as a constant to ensure the code and preview stay in sync:

```tsx
const code = `<TypeTree name="id" type="string" required />`;

<Preview code={code}>
  <TypeTree name="id" type="string" required />
</Preview>
```

## Integration with Documentation

### In MDX Files

```mdx
import { Preview } from '@/components/mintlify/Preview';
import { TypeTree } from '@/components/TypeTree';

## Component Example

<Preview code={`<TypeTree name="example" type="string" />`}>
  <TypeTree name="example" type="string" />
</Preview>
```

### Programmatic Usage

```tsx
import { Preview } from './components/mintlify/Preview';

export function ComponentDocs({ component, code }) {
  return (
    <div>
      <h2>Interactive Example</h2>
      <Preview code={code}>
        {component}
      </Preview>
    </div>
  );
}
```

## Browser Support

The copy-to-clipboard functionality requires:
- Modern browsers with Clipboard API support
- HTTPS connection (Clipboard API restriction)

The component gracefully handles unsupported browsers by hiding the copy button.

## Related Components

- **CopyToClipboardButton** - Used internally for copy functionality
- **CodeBlock** - For displaying code without preview
- **CodeGroup** - For multiple code blocks in tabs
- **Tabs** - Alternative tabbed interface
