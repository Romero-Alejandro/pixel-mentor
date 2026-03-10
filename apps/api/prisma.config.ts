import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// Equivalente a __dirname en ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargamos el .env de la carpeta local de la API
dotenv.config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
