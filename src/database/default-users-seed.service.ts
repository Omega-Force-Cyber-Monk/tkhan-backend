import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';

type DefaultUserSeed = {
  fullName: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'BUYER' | 'GROOMER';
};

@Injectable()
export class DefaultUsersSeedService implements OnModuleInit {
  private readonly logger = new Logger(DefaultUsersSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const password = await bcrypt.hash(
        '123456',
        Number(process.env.BCRYPT_ROUNDS ?? 12),
      );

      await this.ensureUser(
        {
          fullName: 'Platform Admin',
          email: 'admin@gmail.com',
          phone: '+10000000000',
          role: 'ADMIN',
        },
        password,
      );
      await this.ensureUser(
        {
          fullName: 'Default Groomer',
          email: 'gromer@gmail.com',
          phone: '+10000000001',
          role: 'GROOMER',
        },
        password,
      );
      await this.ensureUser(
        {
          fullName: 'Default Buyer',
          email: 'buyer@gmail.com',
          phone: '+10000000002',
          role: 'BUYER',
        },
        password,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Skipped default user seeding: ${message}`);
    }
  }

  private async ensureUser(seed: DefaultUserSeed, password: string) {
    const email = seed.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
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
        ...(seed.role === 'BUYER'
          ? {
              buyerProfile: {
                create: {},
              },
            }
          : {}),
        ...(seed.role === 'GROOMER'
          ? {
              groomerProfile: {
                create: {
                  experienceYears: 3,
                  legalFullName: seed.fullName,
                  idNumber: 'DEFAULT-GROOMER-ID',
                  idType: 'PASSPORT',
                  businessName: 'Default Groomer Business',
                  serviceArea: 'Toronto',
                  businessAddress: '123 Default Street, Toronto',
                  idFrontImage:
                    'https://res.cloudinary.com/demo/image/upload/sample.jpg',
                  idBackImage:
                    'https://res.cloudinary.com/demo/image/upload/sample.jpg',
                  availableForBookings: true,
                  approvalStatus: 'APPROVED',
                  approvedAt: new Date(),
                },
              },
            }
          : {}),
      },
    });

    this.logger.log(`Created default ${seed.role.toLowerCase()}: ${email}`);
  }
}
