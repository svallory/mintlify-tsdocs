# mintlify-tsdocs

This tool generates [Mintlify](https://mintlify.com/)-compatible API documentation for your TypeScript library.
It reads the `*.api.json` data files produced by [API Extractor](https://api-extractor.com/) and generates
MDX files with proper frontmatter, navigation integration, and Mintlify-specific components.

## Features

- Generates MDX files with Mintlify frontmatter (title, description, icon)
- Automatic navigation integration via `docs.json` updates
- Rich UI components: `<ParamField>`, `<ResponseField>`, `<Expandable>` for nested types
- Support for complex TypeScript types with nested object documentation
- README.md conversion to index.mdx for package overview pages

## Quick Start

```bash
# Initialize project (creates mintlify-tsdocs.config.json)
npx mint-ts init

# Build your TypeScript project to generate .d.ts files
npm run build  # or your build command

# Generate Mintlify documentation (auto-loads config)
npx mint-ts generate
```

## Configuration

mintlify-tsdocs uses a single configuration file at the project root: `mintlify-tsdocs.config.json`

### Auto-Detection

The tool auto-detects:
- TypeScript entry point (from `package.json` `types`/`typings` field or common paths)
- Mintlify `docs.json` location
- Output folder

### Example Configuration

```json
{
  "$schema": "./node_modules/mintlify-tsdocs/lib/schemas/config.schema.json",
  "entryPoint": "./lib/index.d.ts",
  "outputFolder": "./docs/reference",
  "docsJson": "./docs/docs.json",
  "tabName": "API Reference",
  "groupName": "API"
}
```

See the [JSON Schema](./src/schemas/config.schema.json) for all available options.

## CLI Commands

### `mint-ts init` (alias: `mintlify-tsdocs init`)
Initialize a project with mintlify-tsdocs configuration. Creates `mintlify-tsdocs.config.json` at the project root and sets up the `.tsdocs/` cache directory.

**Options:**
- `--skip-mintlify` - Skip Mintlify initialization (if already set up)
- `--skip-api-extractor` - Skip API Extractor installation (if already installed)
- `--project-dir <path>` - Project directory (default: current directory)

### `mint-ts generate` (alias: `mintlify-tsdocs generate`)
Generate documentation from TypeScript source. Auto-loads configuration from `mintlify-tsdocs.config.json`, generates API Extractor and TSDoc configs in `.tsdocs/`, runs api-extractor, and creates MDX files.

**Options:**
- `--skip-extractor` - Skip running api-extractor (use existing `.api.json` files in `.tsdocs/`)

### `mint-ts customize` (alias: `mintlify-tsdocs customize`)
Initialize a template directory with default Liquid templates for customization.

**Options:**
- `-t, --template-dir <path>` - Directory where templates should be created (default: `./templates`)
- `-f, --force` - Overwrite existing templates in the target directory

## Publishing

This package is published under two names for convenience:
- `mintlify-tsdocs` (full name, better for SEO)
- `mint-ts` (short alias)

### Automated Publishing

On every git tag starting with `v` (e.g., `v0.0.2`), GitHub Actions automatically:
1. Builds the project
2. Publishes as `mintlify-tsdocs`
3. Publishes as `mint-ts` (alias)
4. Creates a GitHub release

**Setup required:**
1. Create npm token at https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Add as `NPM_TOKEN` secret in GitHub repository settings

**To publish a new version:**
```bash
# Update version in package.json, then:
git tag v0.0.2
git push origin v0.0.2
```

### Manual Publishing

```bash
npm publish                    # Publishes as mintlify-tsdocs
./scripts/publish-alias.sh     # Publishes as mint-ts
```

## Links

- [API Reference](https://hyperdev.saulo.engineer/sdk-reference/mintlify-tsdocs/)
- [Architecture Documentation](./docs/architecture.md)
- [Contributing Guide](./CONTRIBUTING.md)

This project is based on [API Documenter](https://github.com/microsoft/rushstack/tree/main/apps/api-documenter) from the [Rush Stack](https://rushstack.io/) family of projects, enhanced with Mintlify-specific features.
