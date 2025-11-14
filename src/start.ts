// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as os from 'os';

import { PackageJsonLookup } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';

import { DocumenterCli } from './cli/ApiDocumenterCommandLine';
import { createDebugger, enableDebug, type Debugger } from './utils/debug';

const myPackageVersion: string = PackageJsonLookup.loadOwnPackageJson(__dirname).version;

const debug: Debugger = createDebugger('start');

clack.intro(
  Colorize.bold(
    `mintlify-tsdocs ${myPackageVersion} ` + Colorize.cyan(' - https://mintlify-tsdocs.saulo.engineer/')
  )
);

// Configure debug output based on CLI flags
// Check for flags in process.argv before parser runs
const args = process.argv.slice(2);
const hasVerbose = args.includes('--verbose') || args.includes('-v');
const hasDebug = args.includes('--debug');
const hasQuiet = args.includes('--quiet') || args.includes('-q');

// Set up debug levels (flags override DEBUG env var)
if (hasQuiet) {
  // Only show errors when quiet
  enableDebug('mintlify-tsdocs:*:error');
} else if (hasDebug) {
  // Show debug, info, warn, and error
  enableDebug('mintlify-tsdocs:*:debug,mintlify-tsdocs:*:info,mintlify-tsdocs:*:warn,mintlify-tsdocs:*:error');
} else if (hasVerbose) {
  // Show info, warn, and error
  enableDebug('mintlify-tsdocs:*:info,mintlify-tsdocs:*:warn,mintlify-tsdocs:*:error');
} else if (!process.env.DEBUG) {
  // Default: only show warnings and errors
  enableDebug('mintlify-tsdocs:*:warn,mintlify-tsdocs:*:error');
}
// If DEBUG env var is set, respect it (don't override)

const parser: DocumenterCli = new DocumenterCli();

parser.executeAsync().catch(debug.error); // CommandLineParser.executeAsync() should never reject the promise
