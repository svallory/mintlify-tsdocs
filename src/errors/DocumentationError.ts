/**
 * @file Custom error types for documentation generation errors.
 * @author Your Name
 * @license MIT
 * @see {@link ./README.md} for a full overview of the error handling system.
 */

/**
 * Provides structured error information for better error handling and debugging.
 * These codes are used to categorize errors and allow for programmatic handling.
 */
export enum ErrorCode {
  // --- File System Errors ---
  /** Indicates that a file could not be found at the specified path. */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  /** Indicates a failure to read from a file (e.g., permissions). */
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  /** Indicates a failure to write to a file (e.g., permissions, disk full). */
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  /** Indicates that a directory could not be found. */
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  /** Represents a path traversal attempt, a security-related file system error. */
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  /** Indicates that a filename is invalid for the operating system. */
  INVALID_FILENAME = 'INVALID_FILENAME',

  // --- API Model Errors ---
  /** A failure occurred when loading an API model file (`.api.json`). */
  API_LOAD_ERROR = 'API_LOAD_ERROR',
  /** An error occurred while parsing the content of an API model file. */
  API_PARSE_ERROR = 'API_PARSE_ERROR',
  /** The API model JSON is structurally invalid or missing required fields. */
  INVALID_API_JSON = 'INVALID_API_JSON',
  /** An error occurred during the `api-extractor` run. */
  API_EXTRACTOR_ERROR = 'API_EXTRACTOR_ERROR',

  // --- Configuration Errors ---
  /** The main configuration file (e.g., `mint-tsdocs.config.json`) was not found. */
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  /** The configuration is invalid or contains conflicting settings. */
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  /** A required parameter or setting is missing from the configuration. */
  MISSING_REQUIRED_PARAMETER = 'MISSING_REQUIRED_PARAMETER',
  /** A parameter in the configuration has an invalid value. */
  INVALID_PARAMETER_VALUE = 'INVALID_PARAMETER_VALUE',

  // --- Security Errors ---
  /** A general security violation that doesn't fit other categories. */
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  /** A potential command injection attempt was detected. */
  COMMAND_INJECTION = 'COMMAND_INJECTION',
  /** Input is considered dangerous (e.g., contains unsafe scripts). */
  DANGEROUS_INPUT = 'DANGEROUS_INPUT',

  // --- Navigation Errors ---
  /** An error occurred while generating or processing documentation navigation. */
  NAVIGATION_ERROR = 'NAVIGATION_ERROR',
  /** Failed to parse the `docs.json` file for navigation. */
  DOCS_JSON_PARSE_ERROR = 'DOCS_JSON_PARSE_ERROR',
  /** Failed to write the `docs.json` file. */
  DOCS_JSON_WRITE_ERROR = 'DOCS_JSON_WRITE_ERROR',

  // --- Template/Rendering Errors ---
  /** A generic error related to templating. */
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  /** A required template file (e.g., `.liquid`) was not found. */
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  /** An error occurred while rendering a template with data. */
  TEMPLATE_RENDER_ERROR = 'TEMPLATE_RENDER_ERROR',
  /** An error occurred while compiling a template. */
  TEMPLATE_COMPILE_ERROR = 'TEMPLATE_COMPILE_ERROR',
  /** A general error during the final rendering stage. */
  RENDER_ERROR = 'RENDER_ERROR',
  /** The markdown content is invalid or malformed. */
  INVALID_MARKDOWN = 'INVALID_MARKDOWN',

  // --- Type Analysis Errors ---
  /** An error occurred during TypeScript type analysis. */
  TYPE_ANALYSIS_ERROR = 'TYPE_ANALYSIS_ERROR',

  // --- General Errors ---
  /** An unknown or unexpected error occurred. This is the default error code. */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  /** A validation rule failed. Used for general-purpose validation. */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // --- User Interaction Errors ---
  /** The user cancelled the operation (e.g., via a CLI prompt). */
  USER_CANCELLED = 'USER_CANCELLED',
  /** A command-line tool or external process failed to execute. */
  COMMAND_FAILED = 'COMMAND_FAILED'
}

/**
 * Provides structured metadata about an error, offering rich context for debugging and logging.
 */
export interface ErrorContext {
  /**
   * The file, directory, or resource that was being processed when the error occurred.
   * @example './src/index.ts'
   */
  resource?: string;

  /**
   * The specific operation or action being performed when the error occurred.
   * @example 'readFile'
   */
  operation?: string;

  /**
   * A record of additional, arbitrary data relevant to the error, useful for debugging.
   * @example { userId: 123, retries: 3 }
   */
  data?: Record<string, unknown>;

  /**
   * The original error that was caught and wrapped, allowing for error chaining.
   * This is crucial for preserving the root cause of a failure.
   */
  cause?: Error;

  /**
   * A user-friendly suggestion on how to resolve the error.
   * @example 'Ensure the file exists and has read permissions.'
   */
  suggestion?: string;

  /**
   * If the error was caused by a command, this holds the command that was executed.
   * @example 'npm install'
   */
  command?: string;

  /**
   * The exit code returned by a failed command.
   * @example 1
   */
  exitCode?: number;
}

/**
 * Base class for all custom errors in the documentation generation process.
 * It extends the native `Error` class with additional structured context.
 */
export class DocumentationError extends Error {
  /**
   * A standardized, machine-readable error code from the `ErrorCode` enum.
   * This allows for programmatic handling of different error types.
   * @readonly
   */
  public readonly code: ErrorCode;

  /**
   * An object containing additional, structured information about the error.
   * @readonly
   */
  public readonly context: ErrorContext;

  /**
   * The exact time when the error instance was created.
   * @readonly
   */
  public readonly timestamp: Date;

  /**
   * A boolean flag indicating whether the error is likely caused by user input
   * (`true`) or by a system/internal failure (`false`). This helps in tailoring
   * the error message to the appropriate audience.
   * @readonly
   */
  public readonly isUserError: boolean;

  /**
   * Creates an instance of DocumentationError.
   *
   * @param {string} message - The primary, human-readable error message.
   * @param {ErrorCode} [code=ErrorCode.UNKNOWN_ERROR] - The standardized error code.
   * @param {ErrorContext} [context={}] - Additional structured context about the error.
   * @param {boolean} [isUserError=false] - Whether the error is a user-facing error.
   */
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context: ErrorContext = {},
    isUserError: boolean = false
  ) {
    super(message);
    this.name = 'DocumentationError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.isUserError = isUserError;

    // Ensure the prototype chain is correctly set up.
    Object.setPrototypeOf(this, DocumentationError.prototype);

    // Capture the stack trace, excluding the constructor call from it.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DocumentationError);
    }
  }

  /**
   * Generates a detailed, multi-line string representation of the error,
   * including all available context.
   *
   * @returns {string} A formatted, detailed error message.
   */
  public getDetailedMessage(): string {
    let detailedMessage = `[${this.code}] ${this.message}`;

    if (this.context.resource) {
      detailedMessage += `\n  Resource: ${this.context.resource}`;
    }

    if (this.context.operation) {
      detailedMessage += `\n  Operation: ${this.context.operation}`;
    }

    if (this.context.suggestion) {
      detailedMessage += `\n  Suggestion: ${this.context.suggestion}`;
    }

    if (this.context.cause) {
      detailedMessage += `\n  Caused by: ${this.context.cause.message}`;
    }

    if (this.context.data && Object.keys(this.context.data).length > 0) {
      detailedMessage += `\n  Context: ${JSON.stringify(this.context.data, null, 2)}`;
    }

    return detailedMessage;
  }

  /**
   * Converts the error object into a JSON-serializable format,
   * suitable for logging or transmission.
   *
   * @returns {Record<string, unknown>} A plain object representation of the error.
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      isUserError: this.isUserError,
      context: {
        resource: this.context.resource,
        operation: this.context.operation,
        suggestion: this.context.suggestion,
        data: this.context.data,
        cause: this.context.cause?.message
      },
      stack: this.stack
    };
  }
}

/**
 * Represents an error related to security, such as path traversal or command injection.
 * These are always considered user errors.
 */
export class SecurityError extends DocumentationError {
  /**
   * Creates an instance of SecurityError.
   * @param {string} message - The primary, human-readable error message.
   * @param {ErrorCode} [code=ErrorCode.SECURITY_VIOLATION] - The standardized error code.
   * @param {ErrorContext} [context={}] - Additional structured context about the error.
   */
  constructor(message: string, code: ErrorCode = ErrorCode.SECURITY_VIOLATION, context: ErrorContext = {}) {
    super(message, code, context, true);
    this.name = 'SecurityError';
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

/**
 * Represents an error related to file system operations (read, write, etc.).
 */
export class FileSystemError extends DocumentationError {
  /**
   * Creates an instance of FileSystemError.
   * @param {string} message - The primary, human-readable error message.
   * @param {ErrorCode} [code=ErrorCode.FILE_WRITE_ERROR] - The standardized error code.
   * @param {ErrorContext} [context={}] - Additional structured context about the error.
   */
  constructor(message: string, code: ErrorCode = ErrorCode.FILE_WRITE_ERROR, context: ErrorContext = {}) {
    super(message, code, context);
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Represents an error related to input validation.
 * These are always considered user errors.
 */
export class ValidationError extends DocumentationError {
  /**
   * Creates an instance of ValidationError.
   * @param {string} message - The primary, human-readable error message.
   * @param {ErrorContext} [context={}] - Additional structured context about the error.
   */
  constructor(message: string, context: ErrorContext = {}) {
    super(message, ErrorCode.VALIDATION_ERROR, context, true);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Represents an error related to loading or parsing API model files (`.api.json`).
 */
export class ApiModelError extends DocumentationError {
  /**
   * Creates an instance of ApiModelError.
   * @param {string} message - The primary, human-readable error message.
   * @param {ErrorCode} [code=ErrorCode.API_LOAD_ERROR] - The standardized error code.
   * @param {ErrorContext} [context={}] - Additional structured context about the error.
   */
  constructor(message: string, code: ErrorCode = ErrorCode.API_LOAD_ERROR, context: ErrorContext = {}) {
    super(message, code, context);
    this.name = 'ApiModelError';
    Object.setPrototypeOf(this, ApiModelError.prototype);
  }
}