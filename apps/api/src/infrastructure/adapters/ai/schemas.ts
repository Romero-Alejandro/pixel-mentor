import { z } from 'zod';

export const MicroInteractionSchema = z.object({
  type: z.enum(['HOOK', 'QUESTION', 'REINFORCE']),
  text: z.string(),
});

export const AIResponseSchema = z.object({
  explanation: z.string(),
  supportQuotes: z.array(z.string()),
  verificationQuestion: z.string().optional(),
  microInteraction: MicroInteractionSchema.optional(),
});

export const ClassificationSchema = z.object({
  intent: z.enum(['question', 'answer', 'statement', 'greeting', 'other']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export const ComprehensionSchema = z.object({
  result: z.enum(['correct', 'partial', 'incorrect']),
  confidence: z.number().min(0).max(1),
  hint: z.string().optional(),
  shouldEscalate: z.boolean(),
});
