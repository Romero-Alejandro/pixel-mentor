import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  clean: true,
  minify: true,
  sourcemap: true,
  splitting: false,
  tsconfig: 'tsconfig.json',
  external: ['@prisma/client', 'argon2', 'express'],
  noExternal: ['@pixel-mentor/utils'],
});
