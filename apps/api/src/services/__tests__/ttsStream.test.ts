import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TTSStreamService, TTS_EVENT_TYPES } from '../ttsStream';
import * as googleTTS from '@sefinek/google-tts-api';

describe('TTSStreamService', () => {
  let mockGetAllAudioBase64: jest.Mock;

  beforeEach(() => {
    // Use jest.spyOn for read-only external modules
    mockGetAllAudioBase64 = jest
      .spyOn(googleTTS, 'getAllAudioBase64')
      .mockImplementation(() => Promise.resolve([]));
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockGetAllAudioBase64.mockRestore();
  });

  it('should create instance with custom options', () => {
    const service = new TTSStreamService('test', {
      lang: 'es',
      slow: true,
      timeout: 5000,
    });
    expect(service).toBeInstanceOf(TTSStreamService);
  });

  it('should have correct TTS_EVENT_TYPES constant', () => {
    expect(TTS_EVENT_TYPES.AUDIO).toBe('audio');
    expect(TTS_EVENT_TYPES.END).toBe('end');
    expect(TTS_EVENT_TYPES.ERROR).toBe('error');
  });

  describe('Readable stream behavior', () => {
    it('should be in objectMode', () => {
      const service = new TTSStreamService('test text');
      expect((service as any).readableObjectMode).toBe(true);
    });

    it('should generate audio chunks and emit SSE formatted messages', async () => {
      const mockChunks = [{ base64: 'chunk1' }, { base64: 'chunk2' }];
      mockGetAllAudioBase64.mockResolvedValue(mockChunks);

      const service = new TTSStreamService('test text');

      const dataChunks: string[] = [];
      const endPromise = new Promise<void>((resolve) => {
        service.on('end', () => resolve());
      });
      service.on('data', (chunk: string) => {
        dataChunks.push(chunk);
      });

      // Trigger the read (the stream will call _read automatically when needed)
      // For unit testing, we manually call _read
      await (service as any)._read();

      await endPromise;

      // SSE format uses LF (\n), not CRLF (\r\n)
      expect(dataChunks.length).toBeGreaterThanOrEqual(2);
      expect(dataChunks[0]).toMatch(/^event: audio\ndata: /);
      expect(dataChunks[0]).toContain('chunk1');
      expect(dataChunks[1]).toMatch(/^event: audio\ndata: /);
      expect(dataChunks[1]).toContain('chunk2');
      // Last chunk or separate end event
      const lastChunk = dataChunks[dataChunks.length - 1];
      expect(lastChunk).toMatch(/^event: (audio|end)\ndata: /);
    });

    it('should handle googleTTS errors and emit error event', async () => {
      const error = new Error('TTS failed');
      mockGetAllAudioBase64.mockRejectedValue(error);

      const service = new TTSStreamService('test text');

      const errorPromise = new Promise<void>((resolve, reject) => {
        service.on('error', (err: Error) => {
          expect(err.message).toBe('TTS failed');
          resolve();
        });
        service.on('end', () => {
          // End also emitted after error, but we already resolved on error
        });
      });

      await (service as any)._read();

      await errorPromise;
    });
  });
});
