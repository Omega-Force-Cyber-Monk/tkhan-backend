import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash('Admin@123456', 12);
  await prisma.user.upsert({
    where: { email: 'admin@tkhan.local' },
    update: {},
    create: {
      fullName: 'Platform Admin',
      email: 'admin@tkhan.local',
      phone: '+10000000000',
      password,
      role: 'ADMIN',
      emailVerified: true,
      status: 'ACTIVE',
    },
  });

  for (const category of [
    { name: 'Bath & Brush', description: 'Bathing, brushing, and coat refresh services.' },
    { name: 'Full Grooming', description: 'Complete grooming packages for pets.' },
    { name: 'Nail & Paw Care', description: 'Nail trims and paw care add-ons.' },
    { name: 'De-shedding', description: 'Seasonal coat and shedding treatments.' },
  ]) {
    await prisma.serviceCategory.upsert({ where: { name: category.name }, update: category, create: category });
  }
}

main().finally(async () => prisma.$disconnect());
