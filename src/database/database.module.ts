import { Global, Module } from '@nestjs/common';
import { DefaultUsersSeedService } from './default-users-seed.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, DefaultUsersSeedService],
  exports: [PrismaService],
})
export class DatabaseModule {}
