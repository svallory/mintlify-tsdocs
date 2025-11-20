# VSCode Autocomplete for TypeInfo

## How It Works

VSCode automatically provides autocomplete for `TypeInfo` imports thanks to the generated `TypeInfo.d.ts` file.

## Setup (Automatic)

When you run `mint-tsdocs generate`, two files are created:

1. **TypeInfo.jsx** (46KB) - Runtime data for Mintlify
2. **TypeInfo.d.ts** (4.1KB) - Type definitions for VSCode

```
docs/snippets/tsdocs/
├── TypeInfo.jsx    ← Used at runtime by Mintlify
└── TypeInfo.d.ts   ← Used by VSCode for autocomplete
```

## How VSCode Finds Types

VSCode automatically discovers `.d.ts` files in the same directory as imported modules:

```jsx
// In your MDX file
import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"
```

VSCode looks for:
1. `TypeInfo.jsx` ✓
2. `TypeInfo.d.ts` ✓ (found! Use this for types)

## Autocomplete Features

### 1. Package Navigation

```javascript
TypeInfo.
  └─ MintTsdocs  ← Autocomplete suggests package names
```

### 2. Interface/Class Navigation

```javascript
TypeInfo.MintTsdocs.
  ├─ IMarkdownDocumenterOptions  ← All exported types
  ├─ TypeTreeProperty
  ├─ MarkdownDocumenter
  └─ ...
```

### 3. Property Access

```javascript
const config = TypeInfo.MintTsdocs.IMarkdownDocumenterOptions
//    ^^^^^^
//    Type: TypeTreeProperty
//    - name: string
//    - type: string
//    - description?: string
//    - properties?: TypeTreeProperty[]
```

### 4. IntelliSense Hints

When you hover over `TypeInfo.MintTsdocs.IMarkdownDocumenterOptions`:

```
(property) IMarkdownDocumenterOptions: TypeTreeProperty

Configuration options for MarkdownDocumenter
```

### 5. Property Autocomplete

```javascript
TypeInfo.MintTsdocs.IMarkdownDocumenterOptions.
  ├─ name          ← "IMarkdownDocumenterOptions"
  ├─ type          ← "interface"
  ├─ description   ← "Configuration options..."
  └─ properties    ← Array of nested properties
```

## Type Declaration Structure

The generated `TypeInfo.d.ts` looks like:

```typescript
export interface TypeTreeProperty {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  defaultValue?: string;
  properties?: TypeTreeProperty[];
}

export const TypeInfo: {
  "MintTsdocs": {
    "IMarkdownDocumenterOptions": TypeTreeProperty;
    "TypeTreeProperty": TypeTreeProperty;
    // ... all other types
  }
};
```

## Usage Examples

### Example 1: Basic Autocomplete

```jsx
import { TypeTree } from "/snippets/tsdocs/TypeTree.jsx"
import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"

// Start typing and VSCode suggests:
TypeInfo.MintTsdocs.IMarkdown...
//                   ↑ autocomplete kicks in
```

### Example 2: Property Access

```jsx
// Navigate through properties with full autocomplete
const apiModel = TypeInfo
  .MintTsdocs                              // ← autocomplete
  .IMarkdownDocumenterOptions              // ← autocomplete
  .properties                              // ← autocomplete
  .find(p => p.name === "apiModel")        // ← type-safe

<TypeTree {...apiModel} />
```

### Example 3: Spread Operator

```jsx
// Full type safety with spread
<TypeTree {...TypeInfo.MintTsdocs.IMarkdownDocumenterOptions} />
//             ↑ all properties autocomplete
```

## Verification

To verify autocomplete is working:

1. Open any `.mdx` file in VSCode
2. Add the import: `import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"`
3. Type: `TypeInfo.`
4. You should see: `MintTsdocs` in autocomplete list
5. Continue: `TypeInfo.MintTsdocs.`
6. You should see all exported types

## Troubleshooting

### No Autocomplete Appearing

**Problem**: VSCode doesn't show suggestions

**Solutions**:
1. Restart VSCode TypeScript server:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type: "TypeScript: Restart TS Server"
   - Press Enter

2. Check if `TypeInfo.d.ts` exists:
   ```bash
   ls docs/snippets/tsdocs/TypeInfo.d.ts
   ```

3. Regenerate the file:
   ```bash
   bun run mint-tsdocs
   ```

### Wrong Types Showing

**Problem**: Old types showing after API changes

**Solution**: Regenerate TypeInfo files:
```bash
bun run mint-tsdocs
```

### Can't Import TypeInfo

**Problem**: Import fails in MDX

**Solution**: Check path - Mintlify uses absolute paths from docs folder:
```jsx
// ✅ Correct
import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"

// ❌ Wrong
import { TypeInfo } from "./snippets/tsdocs/TypeInfo.jsx"
import { TypeInfo } from "../snippets/tsdocs/TypeInfo.jsx"
```

## How It Compares to Manual Typing

### Without TypeInfo.d.ts

```jsx
import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"

TypeInfo.   // ← No autocomplete, just "any" type
```

### With TypeInfo.d.ts

```jsx
import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"

TypeInfo.MintTsdocs.   // ← Full autocomplete with all types!
```

## Benefits

1. **Zero Configuration** - Works automatically
2. **Always Up-to-Date** - Regenerated on every build
3. **No Manual Typing** - Type definitions auto-generated
4. **Full IntelliSense** - Descriptions from JSDoc
5. **Type Safety** - Catch errors before runtime

## Technical Details

### Why .d.ts and not .ts?

- `.jsx` files are for Mintlify (runtime)
- `.d.ts` files are for VSCode (compile-time)
- `.ts` files would need compilation

### File Size

- **TypeInfo.jsx**: 46KB (all data)
- **TypeInfo.d.ts**: 4.1KB (just types)
- Ratio: 11x smaller for types

### Performance

- **No Runtime Cost** - `.d.ts` not included in bundle
- **VSCode** - Loads types on-demand
- **Mintlify** - Ignores `.d.ts` files

## Conclusion

The combination of `TypeInfo.jsx` + `TypeInfo.d.ts` provides:
- ✅ Runtime data for components
- ✅ Compile-time autocomplete
- ✅ Zero configuration
- ✅ Always synchronized
