/**
 * One-time script: creates a test groomer with all Stripe Connect flags set to true.
 * Email: wuffvgvh@frostypeak.info  |  Password: 12345678
 *
 * Run: node -r dotenv/config scripts/create-test-groomer.cjs
 */
'use strict';

require('dotenv').config();

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client.js');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'wuffvgvh@frostypeak.info';
  const password = '12345678';

  // ── Check if already exists ──────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log('User already exists. Updating Stripe Connect fields to true...');
    const groomerProfile = await prisma.groomerProfile.findUnique({ where: { userId: existing.id } });
    if (!groomerProfile) {
      console.error('Groomer profile not found for existing user!');
      return;
    }
    await prisma.groomerProfile.update({
      where: { id: groomerProfile.id },
      data: {
        stripeConnectedAccountId: 'acct_test_mock_wuff_12345',
        stripeOnboardingCompleted: true,
        stripeTransfersEnabled: true,
        stripePayoutsEnabled: true,
        stripeOnboardingStartedAt: new Date(),
        stripeOnboardingCompletedAt: new Date(),
        stripeConnectCountry: 'CA',
        stripeConnectEmail: email,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        availableForBookings: true,
      },
    });
    await prisma.user.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', emailVerified: true },
    });
    const updated = await prisma.groomerProfile.findUnique({ where: { userId: existing.id } });
    console.log('\n✅ Existing groomer updated successfully!');
    printSummary(existing.id, updated?.id, email, password);
    return;
  }

  // ── Create new account ───────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      fullName: 'Test Groomer Wuff',
      email,
      phone: '+19990001111',
      password: hashedPassword,
      role: 'GROOMER',
      status: 'ACTIVE',
      emailVerified: true,
      groomerProfile: {
        create: {
          experienceYears: 5,
          legalFullName: 'Test Groomer Wuff',
          idNumber: 'TEST-ID-WUFF-12345',
          idType: 'PASSPORT',
          businessName: 'Wuff Mobile Grooming',
          serviceArea: 'Toronto',
          businessAddress: '123 Test Street, Toronto, ON M5V 1A1',
          idFrontImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          idBackImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          selfieWithId: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          serviceModes: ['AT_HOME_GROOMING'],
          certifications: [],
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          availableForBookings: true,
          // ── Stripe Connect mocked as fully complete ──────────────────────
          stripeConnectedAccountId: 'acct_test_mock_wuff_12345',
          stripeOnboardingCompleted: true,
          stripeTransfersEnabled: true,
          stripePayoutsEnabled: true,
          stripeOnboardingStartedAt: new Date(),
          stripeOnboardingCompletedAt: new Date(),
          stripeConnectCountry: 'CA',
          stripeConnectEmail: email,
        },
      },
    },
    include: { groomerProfile: true },
  });

  console.log('\n✅ Groomer account created successfully!');
  printSummary(user.id, user.groomerProfile?.id, email, password);
}

function printSummary(userId, profileId, email, password) {
  console.log('\n  Login Credentials:');
  console.log('    Email    :', email);
  console.log('    Password :', password);
  console.log('\n  IDs:');
  console.log('    User ID      :', userId);
  console.log('    Profile ID   :', profileId);
  console.log('\n  Stripe Connect Status (mocked as complete):');
  console.log('    connectedAccountId  : acct_test_mock_wuff_12345');
  console.log('    onboardingCompleted : true');
  console.log('    transfersEnabled    : true');
  console.log('    payoutsEnabled      : true');
  console.log('    payoutSetupComplete : true  ← booking creation will pass');
  console.log('\n  → You can now log in and test the Stripe payment flow directly.');
  console.log('  → GET /payouts/connect/status will show payoutSetupComplete: true');
  console.log('  → Booking creation will pass all Stripe Connect checks.');
  console.log('  → NOTE: Actual payout transfer will fail (mock account ID) — that is expected.');
  console.log('');
}

main()
  .catch((e) => {
    console.error('\n❌ Script failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
