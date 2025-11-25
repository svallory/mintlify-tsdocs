import { Extractor, ExtractorConfig, ExtractorResult, ExtractorMessage } from '@microsoft/api-extractor';
import { DocumentationError, ErrorCode } from '../../errors/DocumentationError';

export interface ApiExtractorMessageHandler {
  (message: ExtractorMessage): void;
}

export interface ApiExtractorOptions {
  configPath: string;
  messageHandler?: ApiExtractorMessageHandler;
  suppressConsole?: boolean;
  showVerboseMessages?: boolean;
}

interface ConsoleBackup {
  log: typeof console.log;
  error: typeof console.error;
  warn: typeof console.warn;
}

/**
 * Service for running API Extractor with configurable message handling
 * Eliminates code duplication across GenerateAction, LintAction, and CoverageAction
 */
export class ApiExtractorService {
  /**
   * Run API Extractor with provided configuration
   */
  public static async run(options: ApiExtractorOptions): Promise<ExtractorResult> {
    const { configPath, messageHandler, suppressConsole = true, showVerboseMessages = false } = options;

    // Load and prepare config
    const extractorConfig = ExtractorConfig.loadFileAndPrepare(configPath);

    // Suppress console if requested
    const consoleBackup = suppressConsole ? this.suppressConsole() : undefined;

    try {
      // Run extractor with message callback
      const extractorResult = Extractor.invoke(extractorConfig, {
        localBuild: true,
        showVerboseMessages,
        messageCallback: messageHandler ? (message: ExtractorMessage) => {
          messageHandler(message);
          message.handled = true;
        } : undefined
      });

      return extractorResult;
    } finally {
      // Restore console
      if (consoleBackup) {
        this.restoreConsole(consoleBackup);
      }
    }
  }

  /**
   * Suppress console output to prevent duplicate messages
   */
  private static suppressConsole(): ConsoleBackup {
    const backup: ConsoleBackup = {
      log: console.log,
      error: console.error,
      warn: console.warn
    };

    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};

    return backup;
  }

  /**
   * Restore console output
   */
  private static restoreConsole(backup: ConsoleBackup): void {
    console.log = backup.log;
    console.error = backup.error;
    console.warn = backup.warn;
  }
}
