import { spawn } from 'node:child_process';

import { z } from 'zod';

/**
 * Strict validation for audio processing options to prevent command injection.
 * All values are constrained to safe ranges before being passed to FFmpeg.
 */
const AudioProcessingOptionsSchema = z.object({
  speed: z.number().min(0.25).max(4.0).optional(),
  pitch: z.number().int().min(-24).max(24).optional(),
  character: z.enum(['robot', 'animal', 'cartoon']).optional(),
});

export type AudioProcessingOptions = z.infer<typeof AudioProcessingOptionsSchema>;

export class AudioProcessor {
  static async applyEffects(audioBuffer: Buffer, options: AudioProcessingOptions): Promise<Buffer> {
    // Validate and sanitize all options before passing to FFmpeg (command injection prevention)
    const validated = AudioProcessingOptionsSchema.parse(options);

    return new Promise((resolve, reject) => {
      const filters: string[] = [];

      if (validated.character) {
        // SECURITY: Character effects are selected from a strict enum whitelist,
        // never constructed from user input. This prevents command injection via
        // the -af (audio filter) parameter passed to FFmpeg.
        const effects: Record<string, string> = {
          robot: 'aecho=0.8:0.9:30:0.3',
          animal: 'vibrato=f=6:d=0.3',
          cartoon: 'flanger=delay=0:depth=0.5:speed=1',
        };
        if (effects[validated.character]) {
          filters.push(effects[validated.character]);
        }
      }

      if (validated.speed && validated.speed !== 1.0) {
        // SECURITY: Speed is validated to be between 0.25 and 4.0 by Zod schema.
        // toFixed(2) ensures the value is a safe decimal string.
        let speed = validated.speed;
        while (speed < 0.5) {
          filters.push('atempo=0.5');
          speed /= 0.5;
        }
        while (speed > 2.0) {
          filters.push('atempo=2.0');
          speed /= 2.0;
        }
        if (speed !== 1.0) {
          filters.push(`atempo=${speed.toFixed(2)}`);
        }
      }

      if (validated.pitch && validated.pitch !== 0) {
        // SECURITY: Pitch is validated to be an integer between -24 and 24 semitones.
        // Math.pow produces a safe numeric result, toFixed(2) ensures safe string format.
        const pitchRate = Math.pow(2, validated.pitch / 12);
        filters.push(`rubberband=pitch=${pitchRate.toFixed(2)}`);
      }

      const args: string[] = ['-i', 'pipe:0', '-y'];
      if (filters.length > 0) {
        args.push('-af', filters.join(','));
      }
      args.push('-acodec', 'libmp3lame', '-ab', '48k', '-ar', '24000', '-f', 'mp3', 'pipe:1');

      const ffmpeg = spawn('ffmpeg', args);
      const outputChunks: Buffer[] = [];
      const errorChunks: Buffer[] = [];

      ffmpeg.stdout.on('data', (chunk: Buffer) => outputChunks.push(chunk));
      ffmpeg.stderr.on('data', (chunk: Buffer) => errorChunks.push(chunk));

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(outputChunks));
        } else {
          reject(new Error(`FFmpeg error: ${Buffer.concat(errorChunks).toString()}`));
        }
      });

      ffmpeg.on('error', reject);

      ffmpeg.stdin.write(audioBuffer);
      ffmpeg.stdin.end();
    });
  }
}
