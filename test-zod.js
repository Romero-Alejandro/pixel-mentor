"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var zod_1 = require("zod");
var CreateRecipeInputSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional(),
    expectedDurationMinutes: zod_1.z.number().int().min(1).nullable().optional(),
    moduleId: zod_1.z.string().uuid().nullable().optional(),
    published: zod_1.z.boolean().optional().default(false),
});
var UpdateRecipeInputSchema = CreateRecipeInputSchema.partial();
console.log('Test 1 (true):', UpdateRecipeInputSchema.parse({ title: 'hola', published: true }));
console.log('Test 2 (false):', UpdateRecipeInputSchema.parse({ title: 'hola', published: false }));
console.log('Test 3 (undefined):', UpdateRecipeInputSchema.parse({ title: 'hola' }));
