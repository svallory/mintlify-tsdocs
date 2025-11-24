# TSC JSX Compilation Analysis for Mintlify Components

## TSC JSX Compilation Modes

TypeScript Compiler supports 5 JSX modes (via `--jsx` flag):

| Mode | Output File | Output Syntax | Use Case |
|------|-------------|---------------|----------|
| **preserve** | `.jsx` | `<div />` (unchanged JSX) | When another tool handles JSX (Babel, esbuild, Mintlify) |
| **react** | `.js` | `React.createElement("div", null)` | Legacy React |
| **react-jsx** | `.js` | `_jsx("div", {})` | Modern React (automatic runtime) |
| **react-jsxdev** | `.js` | `_jsxDEV("div", {})` | Development mode (automatic runtime) |
| **react-native** | `.js` | `<div />` (preserved JSX) | React Native |

## Current Configuration

**tsconfig.json:**
```json
{
  "jsx": "react-jsx"  // ❌ Compiles to _jsx() function calls
}
```

**Result:**
```javascript
// TypeTreeNew.js (won't work in Mintlify)
const jsx_runtime_1 = require("react/jsx-runtime");
return ((0, jsx_runtime_1.jsxs)(ResponseField, { name: name, ... }));
```

## How Mintlify Uses Components

From `src/documenters/MarkdownDocumenter.ts:2523-2525`:

```typescript
// Line 2523-2525: Only copies .jsx files to docs/snippets/
if (/\.jsx$/i.test(item) || /\.d\.ts$/i.test(item) || item === 'README.md') {
  const relativePath = path.relative(baseDir, fullPath);
  files.push(relativePath);
}
```

**Mintlify's Expectation:**
- Import: `import { TypeTree } from '@/snippets/tsdocs/TypeTree'`
- Expects: `.jsx` files with **raw JSX syntax** (not function calls)
- Runtime: Mintlify's React runtime handles JSX parsing

## The Problem with Current Setup

### Current Build Process
```bash
"build": "tsc && cp -r src/schemas lib/ && cp -r src/components lib/ && ..."
```

Results in `lib/components/`:
```
TypeTree.jsx         ← Source file (copied by cp -r)
TypeTree.js          ← Compiled to _jsx() calls (won't work)
TypeTree.d.ts        ← Type definitions (good!)
```

### Current Generate Process
```typescript
// _discoverComponentFiles only looks for .jsx
if (/\.jsx$/i.test(item)) { /* copy to docs/snippets */ }
```

Copies `TypeTree.jsx` (source) to `docs/snippets/tsdocs/` ✅ (works by accident!)

## The Solution

### Option 1: Preserve JSX Mode (Recommended)

**Update tsconfig.json:**
```json
{
  "jsx": "preserve"  // ✅ Keeps JSX syntax, outputs .jsx files
}
```

**Build Script:**
```json
{
  "build": "tsc && cp -r src/schemas lib/ && cp -r src/templates/defaults lib/templates/ && cp src/templates/README.md lib/templates/"
}
```

**Result in lib/components/:**
```
TypeTree.jsx         ← Compiled (JSX preserved)
TypeTree.d.ts        ← Type definitions
```

**Generate command:** No changes needed (already looks for .jsx)

### Option 2: Dual Output (If needed for other consumers)

Keep `"jsx": "react-jsx"` for lib consumers, but add a second compilation step for Mintlify:

```json
{
  "scripts": {
    "build": "tsc && tsc --jsx preserve --outDir lib-jsx && cp lib-jsx/components/*.jsx lib/components/ && cp -r src/schemas lib/ && cp -r src/templates/defaults lib/templates/ && cp src/templates/README.md lib/templates/"
  }
}
```

This produces:
- `lib/components/*.js` - For Node.js/bundler consumers
- `lib/components/*.jsx` - For Mintlify
- `lib/components/*.d.ts` - For TypeScript

## Impact on Mintlify Usage

### With `jsx: "preserve"` (Raw JSX in .jsx files)

**TypeTree.jsx output:**
```jsx
export const TypeTree = ({ name, type, ...props }) => {
  return (
    <ResponseField name={name} type={type} required={required}>
      {description}
      {hasNested && (
        <Expandable title="props">
          {properties.map((prop, idx) => (
            <TypeTree key={key} {...prop} />
          ))}
        </Expandable>
      )}
    </ResponseField>
  );
};
```

✅ Mintlify can parse and render this
✅ Works with Mintlify's React runtime
✅ No external dependencies (no react/jsx-runtime import)

### With `jsx: "react-jsx"` (Function calls in .js files)

**TypeTree.js output:**
```javascript
const jsx_runtime_1 = require("react/jsx-runtime");
return ((0, jsx_runtime_1.jsxs)(ResponseField, { name: name, ... }));
```

❌ Mintlify expects JSX syntax, not function calls
❌ `require()` may not work in Mintlify's ESM environment
❌ Mintlify provides ResponseField/Expandable globally, not via imports

## Recommended Changes

### 1. Update tsconfig.json
```diff
{
  "compilerOptions": {
-   "jsx": "react-jsx",
+   "jsx": "preserve",
    ...
  }
}
```

### 2. Update build script
```diff
{
  "scripts": {
-   "build": "tsc && cp -r src/schemas lib/ && cp -r src/components lib/ && cp src/components/*.d.ts lib/components/ && cp -r src/templates/defaults lib/templates/ && cp src/templates/README.md lib/templates/",
+   "build": "tsc && cp -r src/schemas lib/ && cp -r src/templates/defaults lib/templates/ && cp src/templates/README.md lib/templates/"
  }
}
```

### 3. Update _discoverComponentFiles (optional, future-proof)
```diff
- if (/\.jsx$/i.test(item) || /\.d\.ts$/i.test(item) || item === 'README.md') {
+ if (/\.(jsx|tsx)$/i.test(item) || /\.d\.ts$/i.test(item) || item === 'README.md') {
```

### 4. Convert components to .tsx
- Delete manual `.d.ts` files
- Delete `TypeTree.types.ts` (redundant)
- Rename `.jsx` → `.tsx`
- TSC will auto-generate `.d.ts` (always in sync!)

## File Structure After Changes

**Source:**
```
src/components/
├── TypeTree.tsx        ← Single source of truth
├── PageLink.tsx
├── RefLink.tsx
└── Preview.tsx
```

**Built (lib/):**
```
lib/components/
├── TypeTree.jsx        ← Compiled (JSX preserved)
├── TypeTree.d.ts       ← Auto-generated
├── TypeTree.d.ts.map   ← Source map
├── PageLink.jsx
├── PageLink.d.ts
├── RefLink.jsx
├── RefLink.d.ts
├── Preview.jsx
└── Preview.d.ts
```

**Deployed (docs/snippets/tsdocs/):**
```
docs/snippets/tsdocs/
├── TypeTree.jsx        ← Copied from lib/ (JSX preserved)
├── TypeTree.d.ts       ← For TS support in MDX
├── PageLink.jsx
├── PageLink.d.ts
├── RefLink.jsx
├── RefLink.d.ts
├── Preview.jsx
└── Preview.d.ts
```

## Benefits

✅ **Single source of truth** - No manual .d.ts sync
✅ **Auto-generated types** - Always accurate
✅ **Works with Mintlify** - Raw JSX output
✅ **TypeScript support** - Full IntelliSense in MDX
✅ **Smaller lib/** - No source duplication
✅ **Cleaner build** - Only compiled output

## Testing Plan

1. Update tsconfig.json (`jsx: "preserve"`)
2. Update build script (remove `cp -r src/components`)
3. Run `bun run build`
4. Check `lib/components/TypeTree.jsx` contains raw JSX (not _jsx() calls)
5. Run `mint-tsdocs generate`
6. Check `docs/snippets/tsdocs/TypeTree.jsx` exists
7. Test in Mintlify MDX: `import { TypeTree } from '@/snippets/tsdocs/TypeTree'`
