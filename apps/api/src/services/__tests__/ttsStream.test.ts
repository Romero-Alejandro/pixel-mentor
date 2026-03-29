import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as googleTTS from '@sefinek/google-tts-api';

import { TTSStreamService, TTS_EVENT_TYPES } from '../ttsStream';

describe('TTSStreamService', () => {
  let mockGetAudioBase64: jest.Mock;

  beforeEach(() => {
    // Mock the correct function: getAudioBase64 (not getAllAudioBase64)
    mockGetAudioBase64 = jest
      .spyOn(googleTTS, 'getAudioBase64')
      .mockImplementation(() => Promise.resolve(''));
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockGetAudioBase64.mockRestore();
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
      // The service splits text into chunks (max 200 chars each) and calls getAudioBase64 for each.
      // Use a long text to ensure at least 2 chunks are generated.
      const base64Chunk1 = 'base64string1';
      const base64Chunk2 = 'base64string2';
      mockGetAudioBase64.mockResolvedValueOnce(base64Chunk1).mockResolvedValueOnce(base64Chunk2);

      // Create text > 200 chars to force splitting (using 250 'a' chars -> 2 chunks)
      const longText = 'a'.repeat(250);
      const service = new TTSStreamService(longText);

      const dataChunks: string[] = [];
      const endPromise = new Promise<void>((resolve) => {
        service.on('end', () => resolve());
      });
      service.on('data', (chunk: string) => {
        dataChunks.push(chunk);
      });

      await (service as any)._read();
      await endPromise;

      // Filter only audio events (skip potential end event)
      const audioEvents = dataChunks.filter((chunk) => chunk.startsWith('event: audio\ndata: '));

      // Should have at least 2 audio events (one per text chunk)
      expect(audioEvents.length).toBeGreaterThanOrEqual(2);

      // Verify each audio event contains a base64 string and valid JSON with audioBase64 field
      for (const [idx, event] of audioEvents.entries()) {
        expect(event).toMatch(/^event: audio\ndata: /);
        const data = JSON.parse(event.split('\ndata: ')[1]);
        expect(data).toHaveProperty('audioBase64');
        // base64 strings should be from our mocks in order
        if (idx === 0) expect(data.audioBase64).toBe(base64Chunk1);
        if (idx === 1) expect(data.audioBase64).toBe(base64Chunk2);
      }
    });

    it('should handle googleTTS errors and emit error event as data chunk', async () => {
      const error = new Error('TTS failed');
      mockGetAudioBase64.mockRejectedValueOnce(error);

      // Use long text to ensure at least one chunk is generated
      const longText = 'a'.repeat(250);
      const service = new TTSStreamService(longText);

      const dataChunks: string[] = [];
      const endPromise = new Promise<void>((resolve) => {
        service.on('end', () => resolve());
      });
      service.on('data', (chunk: string) => {
        dataChunks.push(chunk);
      });

      await (service as any)._read();
      await endPromise;

      // Find error event in data chunks
      const errorEvents = dataChunks.filter((chunk) => chunk.startsWith('event: error\ndata: '));
      expect(errorEvents.length).toBeGreaterThanOrEqual(1);

      const errorData = JSON.parse(errorEvents[0].split('\ndata: ')[1]);
      expect(errorData.message).toBe('TTS failed');
      expect(errorData.code).toBe('CHUNK_ERROR');
    });
  });
});
