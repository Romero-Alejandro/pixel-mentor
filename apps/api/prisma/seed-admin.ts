/**
 * Admin Seed Script
 *
 * Creates a default admin user for development and production bootstrap.
 *
 * SECURITY:
 * - Credentials are read from environment variables
 * - Default password only used in development (NODE_ENV !== 'production')
 * - Script is idempotent — safe to run multiple times
 * - Admin user is only created if no ADMIN role exists in the system
 *
 * Usage:
 *   pnpm db:seed:admin
 *
 * Environment variables:
 *   ADMIN_EMAIL     — Admin email (default: admin@pixel-mentor.local)
 *   ADMIN_PASSWORD  — Admin password (required in production)
 *   ADMIN_NAME      — Admin display name (default: Administrador)
 *   ADMIN_USERNAME  — Admin username (default: admin)
 */

import argon2 from 'argon2';

import { PrismaClient } from '../src/infrastructure/adapters/database/client.js';

const prisma = new PrismaClient();

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
};

interface SeedAdminConfig {
  email: string;
  password: string;
  name: string;
  username: string;
}

function loadConfig(): SeedAdminConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  const email = process.env.ADMIN_EMAIL ?? 'admin@pixel-mentor.local';
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const name = process.env.ADMIN_NAME ?? 'Administrador';
  let password = process.env.ADMIN_PASSWORD;

  if (isProduction && !password) {
    console.error('❌ ADMIN_PASSWORD environment variable is required in production.');
    console.error('   Set it with: ADMIN_PASSWORD=<strong-password> pnpm db:seed:admin');
    process.exit(1);
  }

  if (!password) {
    // Development default — strong but memorable
    password = 'DevAdmin2026!';
    console.warn('⚠️  Using development default password. Set ADMIN_PASSWORD for production.');
  }

  return { email, password, name, username };
}

async function main() {
  console.log('🔐 Admin Seed — Starting...');

  const config = loadConfig();

  // Check if any admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin) {
    console.log(`✅ Admin user already exists: ${existingAdmin.email}`);
    console.log('   Skipping creation. Use the admin panel to manage users.');
    return;
  }

  // Check if email is already taken by a non-admin user
  const existingUser = await prisma.user.findUnique({
    where: { email: config.email },
  });

  if (existingUser) {
    console.log(`📧 Email ${config.email} already exists with role ${existingUser.role}.`);
    console.log('   Promoting to ADMIN...');

    await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: 'ADMIN' },
    });

    console.log(`✅ User ${config.email} promoted to ADMIN.`);
    return;
  }

  // Create the admin user
  const passwordHash = await argon2.hash(config.password, HASH_OPTIONS);

  const admin = await prisma.user.create({
    data: {
      email: config.email,
      username: config.username,
      passwordHash,
      name: config.name,
      role: 'ADMIN',
      quota: 0,
      cohort: 'default',
    },
  });

  console.log('');
  console.log('✅ Admin user created successfully!');
  console.log('┌─────────────────────────────────────────┐');
  console.log(`│ Email:    ${admin.email.padEnd(28)}│`);
  console.log(`│ Username: ${(admin.username ?? 'N/A').padEnd(28)}│`);
  console.log(`│ Name:     ${admin.name.padEnd(28)}│`);
  console.log(`│ Role:     ${admin.role.padEnd(28)}│`);
  console.log('└─────────────────────────────────────────┘');

  if (process.env.NODE_ENV !== 'production') {
    console.log('');
    console.log('🔑 Development credentials:');
    console.log(`   Email:    ${config.email}`);
    console.log(`   Password: ${config.password}`);
    console.log('');
    console.log('   Login at: POST /api/auth/login');
    console.log('   Body: { "identifier": "${config.email}", "password": "${config.password}" }');
  }

  console.log('');
  console.log('⚠️  Remember to change the password after first login!');
}

main()
  .catch((error) => {
    console.error('❌ Admin seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
