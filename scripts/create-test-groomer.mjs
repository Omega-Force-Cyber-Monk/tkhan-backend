/**
 * One-time script: creates a test groomer with all Stripe Connect flags set to true.
 * Email: wuffvgvh@frostypeak.info
 * Password: 12345678
 *
 * Run: node scripts/create-test-groomer.mjs
 */
import pkg from '../../generated/prisma/client/index.js';
const { PrismaClient } = pkg;
import bcryptPkg from 'bcrypt';
const bcrypt = bcryptPkg;

const prisma = new PrismaClient();

async function main() {
  const email = 'wuffvgvh@frostypeak.info';
  const password = '12345678';

  // Check if already exists
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
    console.log('Updated existing groomer. Done.');
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user + groomer profile in one transaction
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
          // ── Stripe Connect mocked as fully complete ──
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

  console.log('');
  console.log('✅ Groomer account created successfully!');
  console.log('');
  console.log('  Email    :', email);
  console.log('  Password :', password);
  console.log('  User ID  :', user.id);
  console.log('  Profile ID:', user.groomerProfile?.id);
  console.log('');
  console.log('  Stripe Connect Status:');
  console.log('    connectedAccountId  : acct_test_mock_wuff_12345');
  console.log('    onboardingCompleted : true');
  console.log('    transfersEnabled    : true');
  console.log('    payoutsEnabled      : true');
  console.log('    payoutSetupComplete : true');
  console.log('');
  console.log('  → You can now log in and test payment flow directly.');
}

main()
  .catch((e) => {
    console.error('Script failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
