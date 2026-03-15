import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';
import type { TTSService, VoiceCharacter, TTSOptions } from '@/domain/ports/tts-service.js';

export interface AppRequest extends Request {
  logger?: pino.Logger;
  ttsService?: TTSService;
}

// Text sanitization - remove potentially dangerous content
function sanitizeText(input: string): string {
  return input
    .slice(0, 5000) // Limit length
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/<[^>]*>/g, '') // Remove HTML tags (prevent XSS)
    .trim();
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
   *   text: string,        // Text to synthesize (required)
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

        // Add timeout for TTS synthesis (15 seconds)
        const timeoutMs = 15000;
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
            .json({ error: 'Tiempo de espera agotado. Intenta con un texto más corto.' });
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

  return router;
}
