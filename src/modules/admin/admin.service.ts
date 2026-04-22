import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
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
}
