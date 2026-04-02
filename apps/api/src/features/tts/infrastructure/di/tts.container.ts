import type pino from 'pino';
import type { Config } from '@/shared/config/index.js';

import { TTSProviderFactory } from '@/features/tts/infrastructure/persistence/tts-factory.js';

export interface TTSContainer {
  ttsService: ReturnType<typeof TTSProviderFactory.create>;
}

export function buildTTSContainer(config: Config, logger: pino.Logger): TTSContainer {
  const ttsService = TTSProviderFactory.create({
    provider: config.TTS_PROVIDER,
    googleFreeConfig: { logger },
    logger,
  });

  return { ttsService };
}