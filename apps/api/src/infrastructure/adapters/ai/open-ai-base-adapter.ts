import OpenAI from 'openai';
import type pino from 'pino';
import type { z } from 'zod';
import { BaseLLMAdapter } from './base-llm-adapter';

export abstract class OpenAIBaseClientAdapter extends BaseLLMAdapter {
  protected readonly client: OpenAI;
  protected readonly model: string;

  constructor(apiKey: string, baseURL: string, model: string, logger?: pino.Logger) {
    super(logger);
    this.model = model;
    this.client = new OpenAI({ apiKey, baseURL });
  }

  protected async executeCall<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const result = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = result.choices[0]?.message?.content || '{}';
    return schema.parse(JSON.parse(content));
  }
}
