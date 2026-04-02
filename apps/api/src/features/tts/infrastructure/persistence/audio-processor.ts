import { spawn } from 'node:child_process';

export interface AudioProcessingOptions {
  speed?: number;
  pitch?: number;
  character?: string;
}

export class AudioProcessor {
  static async applyEffects(audioBuffer: Buffer, options: AudioProcessingOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const filters: string[] = [];

      if (options.character) {
        const effects: Record<string, string> = {
          robot: 'aecho=0.8:0.9:30:0.3',
          animal: 'vibrato=f=6:d=0.3',
          cartoon: 'flanger=delay=0:depth=0.5:speed=1',
        };
        if (effects[options.character]) {
          filters.push(effects[options.character]);
        }
      }

      if (options.speed && options.speed !== 1.0) {
        let speed = options.speed;
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

      if (options.pitch && options.pitch !== 0) {
        const pitchRate = Math.pow(2, options.pitch / 12);
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
