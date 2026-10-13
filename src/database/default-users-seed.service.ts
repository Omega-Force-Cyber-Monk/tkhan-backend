import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';

type DefaultUserSeed = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: 'ADMIN';
};

@Injectable()
export class DefaultUsersSeedService implements OnModuleInit {
  private readonly logger = new Logger(DefaultUsersSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      for (const seed of this.defaultUsers()) {
        await this.ensureUser(seed);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Skipped default user seeding: ${message}`);
    }
  }

  private defaultUsers() {
    const seeds: DefaultUserSeed[] = [
      {
        fullName: process.env.ADMIN_NAME || 'Platform Admin',
        email: process.env.ADMIN_EMAIL || 'admin@tkhan.local',
        phone: process.env.ADMIN_PHONE || '+10000000000',
        password: process.env.ADMIN_PASSWORD || 'Admin@123456',
        role: 'ADMIN',
      },
    ];

    if (process.env.SEED_LEGACY_ADMIN === 'true') {
      seeds.push({
        fullName: 'Legacy Platform Admin',
        email: 'admin@gmail.com',
        phone: '+10000000003',
        password: '123456',
        role: 'ADMIN',
      });
    }

    const emails = new Set<string>();
    return seeds.filter((seed) => {
      const email = seed.email.toLowerCase();
      if (emails.has(email)) return false;
      emails.add(email);
      return true;
    });
  }

  private async ensureUser(seed: DefaultUserSeed) {
    const email = seed.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    const password = await bcrypt.hash(
      seed.password,
      Number(process.env.BCRYPT_ROUNDS ?? 12),
    );

    if (existingUser) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: seed.fullName,
          phone: seed.phone,
          password,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
          isBlocked: false,
        },
      });
      this.logger.log(`Updated default admin: ${email}`);
      return;
    }

    await this.prisma.user.create({
      data: {
        fullName: seed.fullName,
        email,
        phone: seed.phone,
        password,
        role: seed.role,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    this.logger.log(`Created default ${seed.role.toLowerCase()}: ${email}`);
  }
}
