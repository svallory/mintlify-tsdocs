// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as os from 'os';

import { PackageJsonLookup } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';

import { DocumenterCli } from './cli/ApiDocumenterCommandLine';
import { createDebugger, enableDebug, type Debugger } from './utils/debug';
import { showCliHeader } from './cli/CliHelpers';
import * as InitHelp from './cli/help/InitHelp';
import * as GenerateHelp from './cli/help/GenerateHelp';
import * as CustomizeHelp from './cli/help/CustomizeHelp';
import * as ShowHelp from './cli/help/ShowHelp';

const myPackageVersion: string = PackageJsonLookup.loadOwnPackageJson(__dirname).version;

const debug: Debugger = createDebugger('start');

// Check for --help flag before parser runs and handle it ourselves
const args = process.argv.slice(2);

// Handle command-specific help (e.g., "customize --help" or "help customize")
if (args.includes('--help') || args.includes('-h')) {
  const commandIndex = args.findIndex(arg => !arg.startsWith('-'));
  if (commandIndex !== -1) {
    const command = args[commandIndex];

    switch (command) {
      case 'init':
        InitHelp.showHelp();
        process.exit(0);
      case 'generate':
        GenerateHelp.showHelp();
        process.exit(0);
      case 'customize':
        CustomizeHelp.showHelp();
        process.exit(0);
      case 'show':
        ShowHelp.showHelp();
        process.exit(0);
      default:
        // Let the parser handle unknown commands
        break;
    }
  }
}

function startParser(): void {
  const parser: DocumenterCli = new DocumenterCli();
  parser.executeAsync().catch(debug.error);
}

// Configure debug output based on CLI flags
// Check for flags in process.argv before parser runs
const hasVerbose = args.includes('--verbose') || args.includes('-v');
const hasDebug = args.includes('--debug');
const hasQuiet = args.includes('--quiet') || args.includes('-q');

// Set up debug levels (flags override DEBUG env var)
if (hasQuiet) {
  // Only show errors when quiet
  enableDebug('mint-tsdocs:*:error');
} else if (hasDebug) {
  // Show debug, info, warn, and error
  enableDebug('mint-tsdocs:*:debug,mint-tsdocs:*:info,mint-tsdocs:*:warn,mint-tsdocs:*:error');
} else if (hasVerbose) {
  // Show info, warn, and error
  enableDebug('mint-tsdocs:*:info,mint-tsdocs:*:warn,mint-tsdocs:*:error');
} else if (!process.env.DEBUG) {
  // Default: only show warnings and errors
  enableDebug('mint-tsdocs:*:warn,mint-tsdocs:*:error');
}
// If DEBUG env var is set, respect it (don't override)

// Start the parser (unless --help was already handled above)
startParser();
