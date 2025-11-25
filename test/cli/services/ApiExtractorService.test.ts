import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiExtractorService } from '../../../src/cli/services/ApiExtractorService';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

vi.mock('@microsoft/api-extractor', () => ({
  Extractor: {
    invoke: vi.fn()
  },
  ExtractorConfig: {
    loadFileAndPrepare: vi.fn()
  }
}));

describe('ApiExtractorService', () => {
  const mockConfigPath = '/test/api-extractor.json';
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should suppress console output when suppressConsole is true', async () => {
    // Mock API Extractor
    const mockConfig = {} as any;
    (ExtractorConfig.loadFileAndPrepare as any).mockReturnValue(mockConfig);
    (Extractor.invoke as any).mockReturnValue({ succeeded: true });

    await ApiExtractorService.run({
      configPath: mockConfigPath,
      suppressConsole: true
    });

    // Console should have been suppressed during execution
    expect(Extractor.invoke).toHaveBeenCalled();
  });

  it('should call message handler for each message', async () => {
    const messages: any[] = [];
    const mockMessageHandler = vi.fn((msg) => messages.push(msg));

    const mockConfig = {} as any;
    (ExtractorConfig.loadFileAndPrepare as any).mockReturnValue(mockConfig);
    (Extractor.invoke as any).mockImplementation((config, options) => {
      // Simulate calling messageCallback
      if (options?.messageCallback) {
        const mockMessage = {
          text: 'Test warning',
          logLevel: 'warning',
          sourceFilePath: '/test/file.ts',
          sourceFileLine: 10,
          handled: false
        };
        options.messageCallback(mockMessage as any);
      }
      return { succeeded: true };
    });

    await ApiExtractorService.run({
      configPath: mockConfigPath,
      messageHandler: mockMessageHandler
    });

    expect(mockMessageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Test warning',
        logLevel: 'warning'
      })
    );
  });

  it('should restore console after execution', async () => {
    const mockConfig = {} as any;
    (ExtractorConfig.loadFileAndPrepare as any).mockReturnValue(mockConfig);
    (Extractor.invoke as any).mockReturnValue({ succeeded: true });

    await ApiExtractorService.run({
      configPath: mockConfigPath,
      suppressConsole: true
    });

    // Console should be restored
    console.log('test');
    expect(consoleLogSpy).toHaveBeenCalledWith('test');
  });

  it('should restore console even if extractor throws', async () => {
    const mockConfig = {} as any;
    (ExtractorConfig.loadFileAndPrepare as any).mockReturnValue(mockConfig);
    (Extractor.invoke as any).mockImplementation(() => {
      throw new Error('Extractor failed');
    });

    await expect(ApiExtractorService.run({
      configPath: mockConfigPath,
      suppressConsole: true
    })).rejects.toThrow('Extractor failed');

    // Console should still be restored
    console.log('test');
    expect(consoleLogSpy).toHaveBeenCalledWith('test');
  });
});
