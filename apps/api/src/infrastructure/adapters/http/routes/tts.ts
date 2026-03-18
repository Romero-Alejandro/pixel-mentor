import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import { TTSStreamService } from '../../../../services/ttsStream.js';

import type { TTSService, VoiceCharacter, TTSOptions } from '@/domain/ports/tts-service.js';

// Debug logging helper
const debugLog = (logger: pino.Logger, message: string, ...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(message, ...args);
  }
};

export interface AppRequest extends Request {
  logger?: pino.Logger;
  ttsService?: TTSService;
}

// Text sanitization - remove potentially dangerous content
function sanitizeText(input: string): string {
  if (input.length > 50000) {
    throw new Error('El texto no puede exceder 50000 caracteres');
  }
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/<[^>]*>/g, '') // Remove HTML tags (prevent XSS)
    .trim();
}

// Normalize language code: "es-ES" -> "es", "en-US" -> "en", "fr" -> "fr"
function normalizeLanguageCode(lang: string | undefined): string {
  return lang?.split('-')[0]?.toLowerCase() || 'es';
}

// Input validation schemas with strict limits
export const SpeakInputSchema = z.object({
  text: z
    .string()
    .min(1, 'El texto no puede estar vacío')
    .max(5000, 'El texto no puede exceder 5000 caracteres')
    .transform(sanitizeText), // Sanitize on input
  character: z.enum(['robot', 'animal', 'person', 'cartoon']).optional().default('person'),
  languageCode: z
    .string()
    .optional()
    .default('es-ES')
    .refine((val) => ['es-ES', 'es-MX', 'es-US', 'en-US', 'en-GB'].includes(val), {
      message: 'Idioma no soportado',
    }),
  speakingRate: z
    .number()
    .min(0.25, 'Velocidad mínima es 0.25')
    .max(4.0, 'Velocidad máxima es 4.0')
    .optional()
    .default(1.0),
  pitch: z
    .number()
    .min(-20, 'Tono mínimo es -20')
    .max(20, 'Tono máximo es 20')
    .optional()
    .default(0),
});

export type SpeakInput = z.infer<typeof SpeakInputSchema>;

export const ListVoicesInputSchema = z.object({
  languageCode: z.string().optional(),
});

export type ListVoicesInput = z.infer<typeof ListVoicesInputSchema>;

export function createTTSRouter(ttsService: TTSService): Router {
  const router = Router();

  /**
   * POST /api/tts/speak
   * Synthesize text to speech
   *
   * Request body:
   * {
   *   text: string,        // Text to synthesize (required, max 50000 chars)
   *   character?: string, // Voice character: robot, animal, person, cartoon
   *   languageCode?: string, // Language code (default: es-ES)
   *   speakingRate?: number, // Speech rate 0.25-4.0 (default: 1.0)
   *   pitch?: number       // Pitch -20 to 20 (default: 0)
   * }
   *
   * Response: audio/mpeg
   */
  router.post(
    '/speak',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const validated = SpeakInputSchema.parse(request.body);

        const { text, character, languageCode, speakingRate, pitch } = validated;

        const options: TTSOptions = {
          character: character as VoiceCharacter,
          languageCode,
          speakingRate,
          pitch,
        };

        // Add timeout for TTS synthesis (60 seconds for long text)
        const timeoutMs = 60000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('TTS timeout: La solicitud tardó demasiado')),
            timeoutMs,
          );
        });

        const result = await Promise.race([ttsService.speak(text, options), timeoutPromise]);

        // Return audio as base64 for frontend to play
        response.json({
          audioContent: result.audioContentBase64,
          voice: result.voice,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        // Handle timeout specifically
        if (error instanceof Error && error.message.includes('timeout')) {
          response
            .status(504)
            .json({ error: 'Tiempo de espera agotado (60s). Intenta con un texto más corto.' });
          return;
        }
        next(error);
      }
    },
  );

  /**
   * GET /api/tts/voices
   * List available voices
   *
   * Query params:
   *   languageCode?: string // Filter by language (default: es-ES)
   *
   * Response:
   * {
   *   voices: Voice[]
   * }
   */
  router.get(
    '/voices',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const validated = ListVoicesInputSchema.parse(request.query);

        const voices = await ttsService.listVoices(validated.languageCode);

        response.json({ voices });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  /**
   * GET /api/tts/health
   * Check TTS service availability
   */
  router.get(
    '/health',
    async (_request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const available = await ttsService.isAvailable();

        response.json({
          available,
          provider: 'google-cloud',
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/tts/stream
   * Stream text-to-speech audio via Server-Sent Events (SSE)
   *
   * Query params:
   *   text: string          // Text to synthesize (required, max 50000 chars)
   *   lang?: string        // Language code (e.g., 'es-ES', default: 'en')
   *   slow?: boolean      // Slow speech (default: false)
   *
   * Response: text/event-stream
   *   Events:
   *   - audio: { audioBase64: string }
   *   - end: { reason?: string }
   *   - error: { message: string, code?: string }
   */
  router.get(
    '/stream',
    async (request: Request, response: Response, _next: NextFunction): Promise<void> => {
      const { text, lang, slow } = request.query;
      const logger = (request as any).logger;

      // Validate input
      if (!text || typeof text !== 'string') {
        response.status(400).json({ error: 'Text query parameter is required' });
        return;
      }

      const sanitizedText = sanitizeText(text);
      if (sanitizedText.length === 0) {
        response.status(400).json({ error: 'Text cannot be empty after sanitization' });
        return;
      }

      // Normalize language code: "es-ES" -> "es", etc.
      const normalizedLang = normalizeLanguageCode(lang as string | undefined);
      debugLog(logger, 'TTS stream language normalized', {
        original: lang,
        normalized: normalizedLang,
      });

      // Set SSE headers
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.flushHeaders();

      try {
        const ttsStream = new TTSStreamService(sanitizedText, {
          lang: normalizedLang,
          slow: slow === 'true',
        });

        ttsStream.on('data', (chunk: string) => {
          response.write(chunk);
        });

        ttsStream.on('end', () => {
          response.end();
        });

        ttsStream.on('error', (error: any) => {
          console.error('SSE Stream Error:', error);
          const errorMessage = `event: error\ndata: ${JSON.stringify({
            message: error.message || 'Internal Server Error',
            code: error.code || 'SSE_STREAM_ERROR',
          })}\n\n`;
          response.write(errorMessage);
          response.end();
        });

        // Handle client disconnect
        request.on('close', () => {
          console.log('Client disconnected from TTS stream.');
          ttsStream.destroy();
        });
      } catch (error) {
        console.error('Failed to initialize TTS stream:', error);
        response.status(500).json({ error: 'Failed to initialize TTS stream' });
        return;
      }
    },
  );

  return router;
}
