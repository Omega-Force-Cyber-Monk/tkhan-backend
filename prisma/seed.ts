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

type DemoUserSeed = AdminSeed & {
  role: 'BUYER' | 'GROOMER' | 'ADMIN';
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

async function seedDemoUser(user: DemoUserSeed) {
  const normalizedEmail = user.email.toLowerCase();
  const password = await bcrypt.hash(user.password, bcryptRounds);

  const savedUser = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      fullName: user.fullName,
      phone: user.phone,
      password,
      locationText: user.locationText,
      state: user.state,
      role: user.role,
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
      fullName: user.fullName,
      email: normalizedEmail,
      phone: user.phone,
      password,
      locationText: user.locationText,
      state: user.state,
      role: user.role,
      emailVerified: true,
      status: 'ACTIVE',
      isBlocked: false,
    },
  });

  if (user.role === 'BUYER') {
    await prisma.buyerProfile.upsert({
      where: { userId: savedUser.id },
      update: {},
      create: { userId: savedUser.id },
    });
  }

  if (user.role === 'GROOMER') {
    await prisma.groomerProfile.upsert({
      where: { userId: savedUser.id },
      update: {
        availableForBookings: true,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
      },
      create: {
        userId: savedUser.id,
        experienceYears: 4,
        legalFullName: user.fullName,
        idNumber: `DEMO-${savedUser.id.slice(0, 8)}`,
        idType: 'PASSPORT',
        businessName: `${user.fullName} Grooming`,
        serviceArea: user.locationText || 'Austin metro',
        businessAddress: user.locationText || '120 Market Street, Austin, TX',
        idFrontImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        idBackImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        selfieWithId: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        shortBio: 'Verified demo groomer account.',
        availableForBookings: true,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
      },
    });
  }

  console.log(`Seeded ${user.role.toLowerCase()}: ${normalizedEmail}`);
}

async function main() {
  for (const admin of configuredAdmins()) {
    await seedAdmin(admin);
  }

  const shouldSeedDemoUsers =
    process.env.SEED_DEMO_USERS === 'true' ||
    (!isHostedProduction && process.env.SEED_DEMO_USERS !== 'false');

  if (shouldSeedDemoUsers) {
    for (const user of [
      {
        role: 'BUYER',
        fullName: 'Demo Buyer One',
        email: 'buyer1@tkhan.local',
        phone: '+15550001001',
        password: 'Password@123',
        locationText: 'Austin, TX',
        state: 'TX',
      },
      {
        role: 'BUYER',
        fullName: 'Demo Buyer Two',
        email: 'buyer2@tkhan.local',
        phone: '+15550001002',
        password: 'Password@123',
        locationText: 'Dallas, TX',
        state: 'TX',
      },
      {
        role: 'GROOMER',
        fullName: 'Demo Groomer One',
        email: 'groomer1@tkhan.local',
        phone: '+15550002001',
        password: 'Password@123',
        locationText: 'Austin, TX',
        state: 'TX',
      },
      {
        role: 'GROOMER',
        fullName: 'Demo Groomer Two',
        email: 'groomer2@tkhan.local',
        phone: '+15550002002',
        password: 'Password@123',
        locationText: 'Dallas, TX',
        state: 'TX',
      },
      {
        role: 'ADMIN',
        fullName: 'Demo Admin One',
        email: 'admin1@tkhan.local',
        phone: '+15550003001',
        password: 'Password@123',
        locationText: 'Austin, TX',
        state: 'TX',
      },
      {
        role: 'ADMIN',
        fullName: 'Demo Admin Two',
        email: 'admin2@tkhan.local',
        phone: '+15550003002',
        password: 'Password@123',
        locationText: 'Dallas, TX',
        state: 'TX',
      },
    ] satisfies DemoUserSeed[]) {
      await seedDemoUser(user);
    }
  } else {
    console.log('Skipped demo users. Set SEED_DEMO_USERS=true to seed them.');
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
