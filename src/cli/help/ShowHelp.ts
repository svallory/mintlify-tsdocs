// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { showCommandHelp } from '../CliHelpers';

/**
 * Display help for the show command
 */
export function showHelp(): void {
  showCommandHelp({
    commandName: 'show',
    summary: 'Display configuration or statistics',
    description:
      'Displays the current mint-tsdocs configuration or performance statistics from the last run. ' +
      'Useful for debugging and verifying configuration settings.',
    usage: 'mint-tsdocs show [OPTIONS]',
    options: [
      {
        long: '--target TYPE',
        description: 'What to display: "config" or "stats" (default: config)'
      },
      {
        short: '-h',
        long: '--help',
        description: 'Show this help message'
      }
    ],
    examples: [
      {
        description: 'Show current configuration',
        command: 'mint-tsdocs show'
      },
      {
        description: 'Show configuration explicitly',
        command: 'mint-tsdocs show --target config'
      },
      {
        description: 'Show performance statistics',
        command: 'mint-tsdocs show --target stats'
      }
    ]
  });
}
