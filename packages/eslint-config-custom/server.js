import tseslint from 'typescript-eslint';
import globals from 'globals';

import baseConfig from './index.js';

/**
 * @file server.js
 * @description Configuración de ESLint específica para entornos de Node.js y
 * cumplimiento estricto de Arquitectura Hexagonal.
 */
export default tseslint.config(
  ...baseConfig,
  {
    // Aplicar a todos los archivos TypeScript del backend
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
    },
    rules: {
      /**
       * REGLAS DE ARQUITECTURA HEXAGONAL (ESTRICTAS)
       * Justificación: Estas restricciones previenen el acoplamiento bidireccional
       * y aseguran que el núcleo del negocio (Domain) sea agnóstico a la tecnología.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // El Dominio es el núcleo: no puede depender de capas externas.
              group: ['@/application/*', '@/infrastructure/*'],
              message:
                'Violación de Arquitectura Hexagonal: El Dominio no puede importar de Aplicación o Infraestructura.',
            },
            {
              // Prevenir el uso de rutas relativas que salten las capas de abstracción.
              group: [
                '../application/*',
                '../../application/*',
                '../infrastructure/*',
                '../../infrastructure/*',
              ],
              message:
                'Violación de Arquitectura Hexagonal: No se permiten imports relativos hacia capas superiores.',
            },
          ],
        },
      ],

      // Reglas de Robustez y Calidad Senior
      'no-console': 'error', // Prohíbe console.* en código de producción.
      '@typescript-eslint/explicit-function-return-type': 'error', // Obliga a documentar el contrato de salida de las funciones.
      '@typescript-eslint/no-explicit-any': 'error', // Prohíbe 'any' para mantener la integridad del sistema de tipos.
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }], // Optimiza el bundling eliminando tipos en tiempo de ejecución.
    },
  },
  {
    // REGLA ESPECÍFICA PARA LA CAPA DE APLICACIÓN
    files: ['**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // La Aplicación orquestiza el Dominio, pero no debe tocar la Infraestructura (Prisma, Gemini, etc).
              group: ['@/infrastructure/*', '../infrastructure/*', '../../infrastructure/*'],
              message:
                'Violación de Arquitectura Hexagonal: La Aplicación debe usar Puertos (interfaces), no Adaptadores directamente.',
            },
          ],
        },
      ],
    },
  },
);
