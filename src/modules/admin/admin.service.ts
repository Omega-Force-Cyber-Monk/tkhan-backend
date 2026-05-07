import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CreateAdminDto } from './dto/admin.dto';
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  pendingGroomers() {
    return this.prisma.groomerProfile.findMany({
      where: { approvalStatus: 'PENDING' },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
  }
  async approvalCounts() {
    const [pending, approved, rejected] = await Promise.all(
      ['PENDING', 'APPROVED', 'REJECTED'].map((status) =>
        this.prisma.groomerProfile.count({
          where: { approvalStatus: status as any },
        }),
      ),
    );
    return { pending, approved, rejected };
  }
  async approveGroomer(adminId: string, groomerId: string) {
    const groomer = await this.prisma.groomerProfile.update({
      where: { id: groomerId },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedById: adminId,
        availableForBookings: true,
        user: { update: { status: 'ACTIVE', emailVerified: true } },
      },
      include: { user: true },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: groomer.userId,
        action: 'GROOMER_APPROVED',
      },
    });
    return groomer;
  }
  async rejectGroomer(adminId: string, groomerId: string, reason: string) {
    const groomer = await this.prisma.groomerProfile.update({
      where: { id: groomerId },
      data: {
        approvalStatus: 'REJECTED',
        rejectionReason: reason,
        availableForBookings: false,
        user: { update: { status: 'INACTIVE' } },
      },
      include: { user: true },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: groomer.userId,
        action: 'GROOMER_REJECTED',
        note: reason,
      },
    });
    return groomer;
  }
  payments() {
    return this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { booking: true },
    });
  }
  actionLogs() {
    return this.prisma.adminActionLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { admin: true, targetUser: true },
    });
  }
  async createAdmin(createdById: string, dto: CreateAdminDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const admin = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        password: hashedPassword,
        locationText: dto.locationText,
        state: dto.state,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId: createdById,
        targetUserId: admin.id,
        action: 'ADMIN_CREATED',
      },
    });
    const { password, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }
}
