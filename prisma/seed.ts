import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

type AdminSeed = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  locationText?: string;
  state?: string;
};

function loadEnvFile(fileName: string) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match || match[1].startsWith('#')) continue;
    if (process.env[match[1]] !== undefined) continue;

    const value = match[2] ?? '';
    process.env[match[1]] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadEnvFile('.env');

const isHostedProduction =
  process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
if (!isHostedProduction) {
  loadEnvFile('.env.example');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required before running the seed script.');
}

if (isHostedProduction && !process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD is required before running production seed.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const bcryptRounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

function configuredAdmins(): AdminSeed[] {
  const admins: AdminSeed[] = [
    {
      fullName: process.env.ADMIN_NAME || 'Platform Admin',
      email: process.env.ADMIN_EMAIL || 'admin@tkhan.local',
      phone: process.env.ADMIN_PHONE || '+10000000000',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      locationText: process.env.ADMIN_LOCATION_TEXT,
      state: process.env.ADMIN_STATE,
    },
  ];

  if (process.env.SEED_LEGACY_ADMIN !== 'false') {
    admins.push({
      fullName: 'Admin Roy Chowdhury',
      email: 'admin@gmail.com',
      phone: '0123456789',
      password: '123456',
      locationText: 'dhaka',
      state: 'dhaka',
    });
  }

  return admins;
}

async function seedAdmin(admin: AdminSeed) {
  const normalizedEmail = admin.email.toLowerCase();
  const password = await bcrypt.hash(admin.password, bcryptRounds);

  await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      fullName: admin.fullName,
      phone: admin.phone,
      password,
      locationText: admin.locationText,
      state: admin.state,
      role: 'ADMIN',
      emailVerified: true,
      status: 'ACTIVE',
      isBlocked: false,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
      refreshTokenHash: null,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
    create: {
      fullName: admin.fullName,
      email: normalizedEmail,
      phone: admin.phone,
      password,
      locationText: admin.locationText,
      state: admin.state,
      role: 'ADMIN',
      emailVerified: true,
      status: 'ACTIVE',
      isBlocked: false,
    },
  });

  console.log(`Seeded admin: ${normalizedEmail}`);
}

async function main() {
  for (const admin of configuredAdmins()) {
    await seedAdmin(admin);
  }

  for (const category of [
    {
      name: 'Bath & Brush',
      description: 'Bathing, brushing, and coat refresh services.',
    },
    {
      name: 'Full Grooming',
      description: 'Complete grooming packages for pets.',
    },
    {
      name: 'Nail & Paw Care',
      description: 'Nail trims and paw care add-ons.',
    },
    {
      name: 'De-shedding',
      description: 'Seasonal coat and shedding treatments.',
    },
  ]) {
    await prisma.serviceCategory.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    });
  }

  console.log('Seeded service categories.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
