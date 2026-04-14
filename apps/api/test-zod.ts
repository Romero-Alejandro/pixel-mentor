import { z } from 'zod';

const CreateRecipeInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  expectedDurationMinutes: z.number().int().min(1).nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  published: z.boolean().optional().default(false),
});

const UpdateRecipeInputSchema = CreateRecipeInputSchema.partial();

console.log('Test 1 (true):', UpdateRecipeInputSchema.parse({ title: 'hola', published: true }));
console.log('Test 2 (false):', UpdateRecipeInputSchema.parse({ title: 'hola', published: false }));
console.log('Test 3 (undefined):', UpdateRecipeInputSchema.parse({ title: 'hola' }));
