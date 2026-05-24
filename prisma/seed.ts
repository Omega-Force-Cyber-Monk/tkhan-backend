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
  streetAddress?: string;
  unitSuite?: string;
  city?: string;
  province?: string;
  postalCode?: string;
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
      streetAddress: process.env.ADMIN_STREET_ADDRESS,
      unitSuite: process.env.ADMIN_UNIT_SUITE,
      city: process.env.ADMIN_CITY,
      province: process.env.ADMIN_PROVINCE,
      postalCode: process.env.ADMIN_POSTAL_CODE,
    },
  ];

  if (process.env.SEED_LEGACY_ADMIN !== 'false') {
    admins.push({
      fullName: 'Admin Roy Chowdhury',
      email: 'admin@gmail.com',
      phone: '0123456789',
      password: '123456',
      streetAddress: 'House 12, Road 7',
      city: 'Dhaka',
      province: 'Dhaka',
      postalCode: '1207',
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
      streetAddress: admin.streetAddress,
      unitSuite: admin.unitSuite,
      city: admin.city,
      province: admin.province,
      postalCode: admin.postalCode,
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
      streetAddress: admin.streetAddress,
      unitSuite: admin.unitSuite,
      city: admin.city,
      province: admin.province,
      postalCode: admin.postalCode,
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
      streetAddress: user.streetAddress,
      unitSuite: user.unitSuite,
      city: user.city,
      province: user.province,
      postalCode: user.postalCode,
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
      streetAddress: user.streetAddress,
      unitSuite: user.unitSuite,
      city: user.city,
      province: user.province,
      postalCode: user.postalCode,
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
        serviceArea: user.city || 'Austin metro',
        businessAddress:
          user.streetAddress || '120 Market Street, Austin, TX',
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

async function seedPendingGroomer() {
  const password = await bcrypt.hash('Password@123', bcryptRounds);
  const user = await prisma.user.upsert({
    where: { email: 'pending.groomer@tkhan.local' },
    update: {
      fullName: 'Pending Groomer Demo',
      phone: '+15550004001',
      password,
      streetAddress: '400 Demo Lane',
      city: 'Houston',
      province: 'TX',
      role: 'GROOMER',
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
      fullName: 'Pending Groomer Demo',
      email: 'pending.groomer@tkhan.local',
      phone: '+15550004001',
      password,
      streetAddress: '400 Demo Lane',
      city: 'Houston',
      province: 'TX',
      role: 'GROOMER',
      emailVerified: true,
      status: 'ACTIVE',
      isBlocked: false,
    },
  });

  await prisma.groomerProfile.upsert({
    where: { userId: user.id },
    update: {
      experienceYears: 2,
      legalFullName: user.fullName,
      idNumber: `PENDING-${user.id.slice(0, 8)}`,
      idType: 'DRIVING_LICENSE',
      businessName: 'Pending Paws Demo',
      serviceArea: 'Houston, TX',
      businessAddress: '400 Demo Lane, Houston, TX',
      idFrontImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      idBackImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      selfieWithId: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      shortBio: 'Demo groomer waiting for admin approval.',
      availableForBookings: false,
      approvalStatus: 'PENDING',
      approvedAt: null,
      approvedById: null,
      rejectionReason: null,
    },
    create: {
      userId: user.id,
      experienceYears: 2,
      legalFullName: user.fullName,
      idNumber: `PENDING-${user.id.slice(0, 8)}`,
      idType: 'DRIVING_LICENSE',
      businessName: 'Pending Paws Demo',
      serviceArea: 'Houston, TX',
      businessAddress: '400 Demo Lane, Houston, TX',
      idFrontImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      idBackImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      selfieWithId: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      shortBio: 'Demo groomer waiting for admin approval.',
      availableForBookings: false,
      approvalStatus: 'PENDING',
    },
  });

  console.log('Seeded pending groomer: pending.groomer@tkhan.local');
}

async function seedDemoPayout() {
  const category = await prisma.serviceCategory.upsert({
    where: { name: 'Demo Payout Services' },
    update: {
      description: 'Seed services used for payout examples.',
      active: true,
    },
    create: {
      name: 'Demo Payout Services',
      description: 'Seed services used for payout examples.',
      active: true,
    },
  });
  const buyer = await prisma.user.findUniqueOrThrow({
    where: { email: 'buyer1@tkhan.local' },
  });
  const groomerUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'groomer1@tkhan.local' },
    include: { groomerProfile: true },
  });
  if (!groomerUser.groomerProfile) {
    throw new Error('Demo groomer profile is required before seeding payout.');
  }

  const pet =
    (await prisma.pet.findFirst({
      where: { buyerId: buyer.id, name: 'Payout Demo Pet' },
    })) ??
    (await prisma.pet.create({
      data: {
        buyerId: buyer.id,
        name: 'Payout Demo Pet',
        breed: 'Mixed Breed',
        age: 4,
        petType: 'DOG',
        petSize: 'MEDIUM',
        temperament: 'Friendly',
      },
    }));

  const service =
    (await prisma.service.findFirst({
      where: {
        groomerId: groomerUser.groomerProfile.id,
        title: 'Completed Demo Groom',
      },
    })) ??
    (await prisma.service.create({
      data: {
        groomerId: groomerUser.groomerProfile.id,
        categoryId: category.id,
        title: 'Completed Demo Groom',
        description: 'Completed service used to demonstrate payout records.',
        durationMinutes: 90,
        price: 80,
        active: true,
      },
    }));

  const completedAt = new Date();
  const booking = await prisma.booking.upsert({
    where: { bookingNumber: 'BK-DEMO-PAYOUT-001' },
    update: {
      buyerId: buyer.id,
      groomerId: groomerUser.id,
      petId: pet.id,
      serviceLocation: 'Customer home',
      addressLine: '123 Demo Street',
      state: 'TX',
      city: 'Austin',
      postalCode: '73301',
      status: 'COMPLETED',
      subtotalAmount: 80,
      platformFeeAmount: 8,
      groomerEarningAmount: 72,
      totalAmount: 80,
      requestedAt: completedAt,
      acceptedAt: completedAt,
      inProgressAt: completedAt,
      completionRequestedAt: completedAt,
      completedAt,
    },
    create: {
      bookingNumber: 'BK-DEMO-PAYOUT-001',
      buyerId: buyer.id,
      groomerId: groomerUser.id,
      petId: pet.id,
      serviceLocation: 'Customer home',
      addressLine: '123 Demo Street',
      state: 'TX',
      city: 'Austin',
      postalCode: '73301',
      status: 'COMPLETED',
      subtotalAmount: 80,
      platformFeeAmount: 8,
      groomerEarningAmount: 72,
      totalAmount: 80,
      requestedAt: completedAt,
      acceptedAt: completedAt,
      inProgressAt: completedAt,
      completionRequestedAt: completedAt,
      completedAt,
      services: {
        create: {
          serviceId: service.id,
          serviceTitle: service.title,
          serviceDescription: service.description,
          durationMinutes: service.durationMinutes,
          price: service.price,
          categoryName: category.name,
        },
      },
    },
  });

  const payment = await prisma.payment.findFirst({
    where: { bookingId: booking.id },
  });
  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        amount: 80,
        currency: 'usd',
        status: 'SUCCEEDED',
        paidAt: completedAt,
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 80,
        currency: 'usd',
        status: 'SUCCEEDED',
        paidAt: completedAt,
      },
    });
  }

  const payout = await prisma.payout.findFirst({
    where: { bookingId: booking.id },
  });
  if (payout) {
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        groomerId: groomerUser.groomerProfile.id,
        amount: 72,
        platformFee: 8,
        currency: 'usd',
      },
    });
  } else {
    await prisma.payout.create({
      data: {
        bookingId: booking.id,
        groomerId: groomerUser.groomerProfile.id,
        amount: 72,
        platformFee: 8,
        currency: 'usd',
      },
    });
  }

  console.log('Seeded payout demo booking: BK-DEMO-PAYOUT-001');
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
        streetAddress: '120 Market Street',
        city: 'Austin',
        province: 'TX',
        postalCode: '78701',
      },
      {
        role: 'BUYER',
        fullName: 'Demo Buyer Two',
        email: 'buyer2@tkhan.local',
        phone: '+15550001002',
        password: 'Password@123',
        streetAddress: '240 Elm Street',
        city: 'Dallas',
        province: 'TX',
        postalCode: '75201',
      },
      {
        role: 'GROOMER',
        fullName: 'Demo Groomer One',
        email: 'groomer1@tkhan.local',
        phone: '+15550002001',
        password: 'Password@123',
        streetAddress: '120 Market Street',
        city: 'Austin',
        province: 'TX',
        postalCode: '78701',
      },
      {
        role: 'GROOMER',
        fullName: 'Demo Groomer Two',
        email: 'groomer2@tkhan.local',
        phone: '+15550002002',
        password: 'Password@123',
        streetAddress: '240 Elm Street',
        city: 'Dallas',
        province: 'TX',
        postalCode: '75201',
      },
      {
        role: 'ADMIN',
        fullName: 'Demo Admin One',
        email: 'admin1@tkhan.local',
        phone: '+15550003001',
        password: 'Password@123',
        streetAddress: '120 Market Street',
        city: 'Austin',
        province: 'TX',
        postalCode: '78701',
      },
      {
        role: 'ADMIN',
        fullName: 'Demo Admin Two',
        email: 'admin2@tkhan.local',
        phone: '+15550003002',
        password: 'Password@123',
        streetAddress: '240 Elm Street',
        city: 'Dallas',
        province: 'TX',
        postalCode: '75201',
      },
    ] satisfies DemoUserSeed[]) {
      await seedDemoUser(user);
    }

    await seedPendingGroomer();
    await seedDemoPayout();
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
