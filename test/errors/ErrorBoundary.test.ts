/**
 * Tests for ErrorBoundary error handling and path validation
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ErrorBoundary } from '../../src/errors/ErrorBoundary';
import { DocumentationError, ErrorCode } from '../../src/errors/DocumentationError';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('ErrorBoundary', () => {
  describe('constructor validation', () => {
    it('should accept valid relative error log path', () => {
      expect(() => new ErrorBoundary({
        errorLogPath: './logs/errors.log'
      })).not.toThrow();
    });

    it('should accept valid absolute error log path', () => {
      const validPath = path.join(os.tmpdir(), 'test-errors.log');
      expect(() => new ErrorBoundary({
        errorLogPath: validPath
      })).not.toThrow();
    });

    it('should reject path with traversal sequence (..)', () => {
      expect(() => new ErrorBoundary({
        errorLogPath: '../../../etc/passwd'
      })).toThrow('path traversal sequences');
    });

    it('should reject path with tilde (~)', () => {
      expect(() => new ErrorBoundary({
        errorLogPath: '~/sensitive/file.log'
      })).toThrow('path traversal sequences');
    });

    it('should reject system directory paths (/etc)', () => {
      expect(() => new ErrorBoundary({
        errorLogPath: '/etc/errors.log'
      })).toThrow('system directory');
    });

    it('should reject Windows system directory paths', () => {
      // Skip on non-Windows since path resolution differs
      if (process.platform === 'win32') {
        expect(() => new ErrorBoundary({
          errorLogPath: 'C:\\Windows\\errors.log'
        })).toThrow('system directory');
      }
    });

    it('should normalize paths to absolute', () => {
      const boundary = new ErrorBoundary({
        errorLogPath: './test.log'
      });
      // Access private options via type assertion for testing
      const options = (boundary as any).options;
      expect(path.isAbsolute(options.errorLogPath)).toBe(true);
    });

    it('should handle empty errorLogPath', () => {
      expect(() => new ErrorBoundary({
        errorLogPath: ''
      })).not.toThrow();
    });

    it('should handle undefined errorLogPath', () => {
      expect(() => new ErrorBoundary()).not.toThrow();
    });
  });

  describe('error handling', () => {
    let testLogPath: string;

    beforeEach(() => {
      // Create a temporary directory for test logs
      testLogPath = path.join(os.tmpdir(), `test-error-boundary-${Date.now()}.log`);
    });

    it('should execute async operation successfully', async () => {
      const boundary = new ErrorBoundary();
      const result = await boundary.executeAsync(
        async () => 'success',
        { operation: 'test' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.error).toBeUndefined();
    });

    it('should catch and wrap errors', async () => {
      const boundary = new ErrorBoundary();
      const result = await boundary.executeAsync(
        async () => { throw new Error('Test error'); },
        { operation: 'test', resource: 'test.ts' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(DocumentationError);
      expect(result.error?.message).toContain('Test error');
    });

    it('should use fallback on error', async () => {
      const boundary = new ErrorBoundary();
      const result = await boundary.executeAsync(
        async () => { throw new Error('Primary failed'); },
        { operation: 'test' },
        async () => 'fallback-success'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('fallback-success');
      expect(result.recovered).toBe(true);
    });

    it('should respect maxErrors limit', async () => {
      const boundary = new ErrorBoundary({ maxErrors: 2, continueOnError: true });

      // First two errors should be handled
      await boundary.executeAsync(async () => { throw new Error('Error 1'); }, { operation: 'test' });
      await boundary.executeAsync(async () => { throw new Error('Error 2'); }, { operation: 'test' });

      // Third error should fail the boundary
      const result = await boundary.executeAsync(async () => { throw new Error('Error 3'); }, { operation: 'test' });

      expect(result.success).toBe(false);
      const stats = boundary.getStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.shouldContinue).toBe(false);
    });

    it('should write error logs when configured', async () => {
      const boundary = new ErrorBoundary({
        logErrors: true,
        errorLogPath: testLogPath
      });

      await boundary.executeAsync(
        async () => { throw new Error('Test error for logging'); },
        { operation: 'test', resource: 'test.ts' }
      );

      // Check that log file was created
      expect(fs.existsSync(testLogPath)).toBe(true);

      // Check log content
      const logContent = fs.readFileSync(testLogPath, 'utf-8');
      expect(logContent).toContain('Test error for logging');
      expect(logContent).toContain('operation');

      // Cleanup
      fs.unlinkSync(testLogPath);
    });

    it('should track error statistics', async () => {
      const boundary = new ErrorBoundary({ continueOnError: true });

      await boundary.executeAsync(async () => { throw new Error('Error 1'); }, { operation: 'test' });
      await boundary.executeAsync(
        async () => { throw new Error('Error 2'); },
        { operation: 'test' },
        async () => 'recovered'
      );

      const stats = boundary.getStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.recoveredCount).toBe(1);
      expect(stats.errors.length).toBe(2);
    });
  });

  describe('sync operation support', () => {
    it('should execute sync operations', () => {
      const boundary = new ErrorBoundary();
      const result = boundary.executeSync(
        () => 'sync-success',
        { operation: 'test' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('sync-success');
    });

    it('should catch sync errors', () => {
      const boundary = new ErrorBoundary();
      const result = boundary.executeSync(
        () => { throw new Error('Sync error'); },
        { operation: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(DocumentationError);
    });

    it('should use sync fallback', () => {
      const boundary = new ErrorBoundary();
      const result = boundary.executeSync(
        () => { throw new Error('Primary failed'); },
        { operation: 'test' },
        () => 'fallback-success'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('fallback-success');
      expect(result.recovered).toBe(true);
    });
  });

  describe('error reporting', () => {
    it('should generate comprehensive error report', async () => {
      const boundary = new ErrorBoundary({ continueOnError: true });

      await boundary.executeAsync(async () => { throw new Error('Error 1'); }, { operation: 'op1' });
      await boundary.executeAsync(async () => { throw new Error('Error 2'); }, { operation: 'op2' });

      const report = boundary.generateErrorReport();

      expect(report).toContain('Error Summary');
      expect(report).toContain('Total Errors: 2');
      expect(report).toContain('Error 1');
      expect(report).toContain('Error 2');
    });
  });
});
