# Init Command Enhancements

## Summary

Enhanced the `init` command with package validation, Mintlify config checking, and support for `--yes`, `--verbose`, and `--debug` flags.

## Changes Made

### 1. Package Installation Checks (src/cli/InitAction.ts:194-253)

The `_checkRequiredPackages` method now:
- Validates that required packages are installed:
  - `mintlify-tsdocs`
  - `@microsoft/api-extractor`
- Shows verbose logging when `--verbose` flag is used
- Auto-installs missing packages with `--yes` flag
- Prompts for installation in interactive mode

### 2. Mintlify Config Validation (src/cli/InitAction.ts:258-296)

The `_validateMintlifyConfig` method:
- Checks for `mint.json` or `docs.json` (supports both formats)
- Validates JSON structure and required fields (e.g., `name`)
- Shows verbose logging with `--verbose` flag
- Prevents re-initialization if valid config exists

### 3. Flag Support

#### `--yes` / `-y` Flag
- Uses defaults for all prompts
- **Does NOT override existing files** (no `--force` flag used)
- Auto-detects TypeScript entry point from common locations:
  - `./lib/index.d.ts`
  - `./dist/index.d.ts`
  - `./build/index.d.ts`
- Uses default values:
  - Docs directory: `./docs`
  - API JSON folder: `./temp`
  - Output folder: `./docs/api`
  - Tab name: `API Reference`
  - Group name: `API`

#### `--verbose` / `-v` Flag
- Shows command output in real-time (uses `stdio: 'inherit'`)
- Displays package installation status
- Shows Mintlify config validation details
- Already defined at CLI level (src/cli/ApiDocumenterCommandLine.ts)

#### `--debug` Flag
- **Implies `--verbose`** (automatically enables verbose mode)
- Shows executed commands and working directories
- Displays command output when not in verbose mode
- Already defined at CLI level (src/cli/ApiDocumenterCommandLine.ts)

### 4. Enhanced `_runCommand` Method (src/cli/InitAction.ts:744-828)

Updated to support verbose and debug modes:
- `--verbose`: Uses `stdio: 'inherit'` to show real-time output
- `--debug`: Logs command being executed and working directory
- Improved error messages with full context

### 5. Updated Constructor (src/cli/InitAction.ts:35-71)

- Now accepts `DocumenterCli` instance to access global flags
- Added `_yesParameter` flag definition

### 6. Updated Entry Points

**src/cli/ApiDocumenterCommandLine.ts:91**
- Changed `new InitAction()` to `new InitAction(this)`
- Passes CLI instance for flag access

## Usage Examples

### Interactive Mode (Default)
```bash
mintlify-tsdocs init
```
Prompts user for all configuration options.

### Non-Interactive Mode
```bash
mintlify-tsdocs init --yes
```
Uses defaults, auto-detects entry point, doesn't override files.

### Verbose Output
```bash
mintlify-tsdocs init --verbose
```
Shows command output in real-time.

### Debug Mode
```bash
mintlify-tsdocs init --debug
```
Shows commands being executed and working directories.

### Combined Flags
```bash
mintlify-tsdocs init --yes --verbose
```
Non-interactive with real-time output.

```bash
mintlify-tsdocs init --debug
```
Debug mode automatically enables verbose (no need for `--verbose` flag).

## Safety Features

1. **No Data Loss with `--yes`**
   - Never uses `--force` flag with mint new
   - Keeps existing files in docs directory
   - Fails gracefully if entry point not found

2. **Package Validation**
   - Checks for required packages before proceeding
   - Offers to install missing packages
   - Validates package.json exists

3. **Config Validation**
   - Validates existing Mintlify config before overwriting
   - Skips initialization if valid config exists
   - Checks for both `mint.json` and `docs.json`

## Error Handling

- Uses proper `DocumentationError` with error codes
- Provides helpful error messages
- Suggests solutions (e.g., "run without --yes to specify manually")
- Fails fast on missing dependencies

## Files Modified

1. `src/cli/InitAction.ts` - Main implementation
2. `src/cli/ApiDocumenterCommandLine.ts` - Pass CLI instance to InitAction, `--debug` implies `--verbose`

## Compilation Status

✅ InitAction.ts compiles successfully
✅ ApiDocumenterCommandLine.ts compiles successfully

(Pre-existing errors in MarkdownDocumenter.ts and ErrorBoundary.ts are unrelated)
