# VSCode Path Resolution for TypeInfo

## The Problem

In Mintlify MDX files, you import components like this:

```jsx
import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"
```

The `/snippets/` path is **relative to the docs folder**, but VSCode doesn't know this Mintlify convention, so it can't:
- ❌ Find the `TypeInfo.d.ts` file for autocomplete
- ❌ Provide IntelliSense
- ❌ Show type hints
- ❌ Navigate to definitions

## The Solution

**Auto-generated `tsconfig.json`** in the docs folder that:
1. Maps `/snippets/*` to `./snippets/*` for path resolution
2. Configures the MDX language server for strict type checking
3. Enables VSCode IntelliSense for MDX files

## How It Works

### 1. Auto-Generation (First Run)

When you run `mint-tsdocs generate` for the first time:

```bash
bun run mint-tsdocs
```

Output:
```
✓ Generated TypeInfo.jsx with type information
✓ Generated TypeInfo.d.ts for VSCode autocomplete
✓ Generated tsconfig.json for VSCode path resolution and MDX support
```

Creates:
```
docs/
├── tsconfig.json          ← NEW! Path mapping & MDX config
├── snippets/
│   └── tsdocs/
│       ├── TypeInfo.jsx   ← Runtime data
│       └── TypeInfo.d.ts  ← Type definitions
└── reference/             ← Generated API docs
```

### 2. Safe Updates (Subsequent Runs)

On subsequent runs, it **won't overwrite** existing `tsconfig.json`:

```bash
bun run mint-tsdocs
```

Output:
```
⚠ tsconfig.json already exists, skipping generation
```

This allows you to customize `tsconfig.json` without losing your changes.

## The tsconfig.json File

### Generated Content

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "/snippets/*": ["./snippets/*"]
    },
    "jsx": "react",
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "checkJs": false,
    "allowJs": true,
    "noEmit": true
  },
  "mdx": {
    "checkMdx": true
  },
  "include": [
    "**/*.jsx",
    "**/*.mdx",
    "**/*.js",
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": [
    "node_modules",
    ".tsdocs"
  ]
}
```

### What Each Part Does

#### `baseUrl: "."`
Sets the base directory for path resolution (the docs folder).

#### `paths: { "/snippets/*": ["./snippets/*"] }`
**Most important!** Maps Mintlify's `/snippets/` paths to actual file locations.

```jsx
// In MDX file
import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"
//                        ↓ VSCode resolves to
//                        ./snippets/tsdocs/TypeInfo.jsx
```

#### `jsx: "react"`
Tells VSCode to treat JSX syntax correctly.

#### `moduleResolution: "bundler"`
Uses modern bundler-style module resolution (supports `/` paths).

#### `allowJs: true` & `noEmit: true`
- Allows JavaScript files to be type-checked
- Prevents TypeScript from generating output (this is just for IDE support)

#### `mdx: { "checkMdx": true }`
**NEW!** Enables strict type checking in MDX files via the [MDX Language Server](https://github.com/mdx-js/mdx-analyzer).

This provides:
- Type checking for JSX components in MDX
- Props validation
- Import/export type checking
- Better error messages

#### `include: ["**/*.jsx", "**/*.mdx", "**/*.js", "**/*.ts", "**/*.tsx"]`
Applies to all JavaScript, TypeScript, and MDX files in the docs folder.

#### `exclude: ["node_modules", ".tsdocs"]`
Ignores dependencies and cache folder.

## How VSCode Finds Types

### The Full Resolution Chain

1. **Import Statement**
   ```jsx
   import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"
   ```

2. **tsconfig.json Path Mapping**
   ```
   "/snippets/*" → "./snippets/*"
   ```

3. **File Discovery**
   ```
   docs/snippets/tsdocs/TypeInfo.jsx  ← Found!
   docs/snippets/tsdocs/TypeInfo.d.ts ← Also found!
   ```

4. **Type Loading**
   VSCode loads `TypeInfo.d.ts` for autocomplete

5. **Autocomplete Works!**
   ```jsx
   TypeInfo.MintTsdocs.IMarkdownDocumenterOptions
   //       ↑ autocomplete   ↑ autocomplete
   ```

## Testing Autocomplete

### Quick Test

1. Open any `.mdx` file in the `docs/` folder
2. Add the import:
   ```jsx
   import { TypeInfo } from "/snippets/tsdocs/TypeInfo.jsx"
   ```
3. Type: `TypeInfo.`
4. You should see `MintTsdocs` in the autocomplete dropdown

### If Autocomplete Doesn't Work

#### Step 1: Verify Files Exist

```bash
ls docs/tsconfig.json
ls docs/snippets/tsdocs/TypeInfo.d.ts
```

Both should exist.

#### Step 2: Restart TypeScript Server

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: `TypeScript: Restart TS Server`
3. Press Enter

#### Step 3: Check VSCode is in the Right Folder

Open VSCode **at the project root**, not just the docs folder:

```bash
# ✅ Correct
code /path/to/your-project

# ❌ Wrong
code /path/to/your-project/docs
```

VSCode needs to see both the project structure and the docs folder.

#### Step 4: Verify tsconfig.json is Valid

Open `docs/tsconfig.json` and check for syntax errors. VSCode will show red squiggles if there are problems.

#### Step 5: Check MDX Extension is Installed

The MDX language server requires the [MDX extension](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-mdx):

```bash
code --install-extension unifiedjs.vscode-mdx
```

## Why tsconfig.json, Not jsconfig.json?

### tsconfig.json (Used) ✅

- ✅ Required by **MDX language server** for type checking
- ✅ Supports the `mdx` configuration section
- ✅ Works for both JavaScript and TypeScript files
- ✅ Better IntelliSense in MDX files
- ✅ Doesn't interfere with root TypeScript config (uses `noEmit: true`)

### jsconfig.json (Not Used) ❌

- ❌ **Not recognized by MDX language server**
- ❌ No support for `mdx` configuration section
- ❌ Limited type checking capabilities
- ❌ Less powerful IntelliSense

## Why Not in Root tsconfig.json?

The root `tsconfig.json` is for the **mint-tsdocs package itself**:

```
root/
├── tsconfig.json      ← For src/ TypeScript files (package code)
├── src/               ← Package source code
└── docs/
    ├── tsconfig.json  ← For docs MDX/JSX files (documentation)
    └── *.mdx          ← Documentation files
```

They serve different purposes and should remain separate. The docs `tsconfig.json`:
- Uses `noEmit: true` (no compilation)
- Includes MDX-specific configuration
- Maps Mintlify-specific paths
- Doesn't force users to modify their root config

## MDX Language Server Integration

The MDX language server (from the `unifiedjs.vscode-mdx` extension) automatically discovers `tsconfig.json` files and uses them for:

1. **Type Checking**: Validates component props in MDX
2. **Import Resolution**: Uses path mappings to resolve imports
3. **Autocomplete**: Provides suggestions for imported types
4. **Error Detection**: Shows errors for invalid JSX/types

### Configuration Options

You can customize MDX behavior in the `mdx` section:

```json
{
  "mdx": {
    // Enable strict type checking (recommended)
    "checkMdx": true,

    // Add remark plugins (optional)
    "plugins": [
      ["remark-frontmatter", ["yaml", "toml"]],
      "remark-gfm"
    ]
  }
}
```

**Note**: Transformer plugins like `remark-mdx-frontmatter` are not yet supported by the MDX language server.

## Customization

Since `tsconfig.json` won't be overwritten after first generation, you can customize it:

### Add More Path Mappings

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "/snippets/*": ["./snippets/*"],
      "/components/*": ["./components/*"],
      "/utils/*": ["./utils/*"]
    }
  }
}
```

### Stricter Type Checking

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "/snippets/*": ["./snippets/*"]
    },
    "checkJs": true,  // ← Enable JS type checking
    "strict": true    // ← Strict mode
  }
}
```

### Add Remark Plugins

```json
{
  "mdx": {
    "checkMdx": true,
    "plugins": [
      "remark-gfm",  // GitHub Flavored Markdown
      ["remark-frontmatter", ["yaml"]]
    ]
  }
}
```

## Gitignore Considerations

### Should You Commit tsconfig.json?

**Yes!** Commit it to version control:

```bash
git add docs/tsconfig.json
git commit -m "feat: add tsconfig for VSCode autocomplete and MDX support"
```

**Why?**
- ✅ Other developers get autocomplete too
- ✅ Consistent IDE experience across team
- ✅ MDX type checking works for everyone
- ✅ Won't be regenerated/overwritten
- ✅ Can be customized per project

## Troubleshooting

### Import Shows Red Squiggle

**Symptom**: VSCode shows error on import line

**Cause**: Path mapping not working

**Fix**:
1. Verify `tsconfig.json` exists in docs folder
2. Check path mapping is correct: `"/snippets/*": ["./snippets/*"]`
3. Restart TS Server: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
4. Ensure MDX extension is installed

### Autocomplete Shows Wrong Types

**Symptom**: Old types appearing after API changes

**Cause**: Cached types from previous generation

**Fix**:
```bash
# Regenerate TypeInfo files
bun run mint-tsdocs

# Restart TS Server
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Can't Find Module Error

**Symptom**: `Cannot find module '/snippets/tsdocs/TypeInfo.jsx'`

**Cause**: VSCode not loading tsconfig.json

**Fix**:
1. Ensure you're opening VSCode at project root, not docs folder
2. Check tsconfig.json has no syntax errors
3. Reload VSCode window: `Cmd+Shift+P` → "Developer: Reload Window"
4. Install MDX extension: `code --install-extension unifiedjs.vscode-mdx`

### MDX Type Checking Not Working

**Symptom**: No type errors shown in MDX files

**Cause**: MDX extension not installed or configured

**Fix**:
1. Install extension: `code --install-extension unifiedjs.vscode-mdx`
2. Check `tsconfig.json` has `"mdx": { "checkMdx": true }`
3. Restart VSCode
4. Open an MDX file and check status bar for "MDX" language mode

## Complete Setup Checklist

After running `mint-tsdocs generate`, verify:

- [ ] `docs/tsconfig.json` exists
- [ ] `docs/snippets/tsdocs/TypeInfo.jsx` exists
- [ ] `docs/snippets/tsdocs/TypeInfo.d.ts` exists
- [ ] MDX extension is installed (`unifiedjs.vscode-mdx`)
- [ ] VSCode is opened at project root
- [ ] Import `TypeInfo` in MDX file shows no errors
- [ ] Typing `TypeInfo.` shows autocomplete
- [ ] Hover over `TypeInfo` shows type information
- [ ] MDX files show type checking errors (if any)

## Summary

### Three Files Work Together

1. **TypeInfo.jsx** (46KB)
   - Runtime data for Mintlify components
   - Contains all type information as JSON

2. **TypeInfo.d.ts** (4.1KB)
   - TypeScript declarations
   - VSCode uses for autocomplete

3. **tsconfig.json** (< 1KB)
   - Path mapping configuration
   - MDX language server configuration
   - Tells VSCode how to resolve `/snippets/*`

### The Magic Formula

```
tsconfig.json (path mapping + MDX config)
    +
TypeInfo.d.ts (type definitions)
    +
MDX Language Server (type checking)
    =
Full VSCode Autocomplete & Type Safety! ✨
```

## Benefits

- ✅ **Zero Manual Setup** - Auto-generated on first run
- ✅ **Safe Updates** - Won't overwrite existing config
- ✅ **Team Friendly** - Commit to git for everyone
- ✅ **Customizable** - Modify as needed
- ✅ **Standard Pattern** - Uses official VSCode/TS conventions
- ✅ **MDX Support** - Strict type checking in MDX files
- ✅ **No Root Modification** - Doesn't require changes to root tsconfig.json

Now your VSCode autocomplete and MDX type checking should work perfectly! 🎉
