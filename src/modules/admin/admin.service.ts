import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import {
  AdminBlockUserDto,
  AdminUserFilterDto,
  CreateAdminDto,
} from './dto/admin.dto';

const safeUserSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  profileImage: true,
  locationText: true,
  state: true,
  role: true,
  emailVerified: true,
  status: true,
  isBlocked: true,
  createdAt: true,
  updatedAt: true,
};

const bookingDetailInclude = {
  services: true,
  addons: true,
  pet: true,
  buyer: { select: safeUserSelect },
  groomer: { select: safeUserSelect },
  availabilitySlot: {
    include: {
      availability: true,
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const } },
  payouts: { orderBy: { createdAt: 'desc' as const } },
  reviews: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      reviewer: { select: safeUserSelect },
      reviewee: { select: safeUserSelect },
    },
  },
  supportTickets: {
    orderBy: { createdAt: 'desc' as const },
  },
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async users(dto: AdminUserFilterDto) {
    const where: any = {
      ...(dto.role && { role: dto.role }),
      ...(dto.status && { status: dto.status }),
      ...(typeof dto.isBlocked === 'boolean' && { isBlocked: dto.isBlocked }),
      ...(dto.search && {
        OR: [
          { fullName: { contains: dto.search, mode: 'insensitive' } },
          { email: { contains: dto.search, mode: 'insensitive' } },
          { phone: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
        select: {
          ...safeUserSelect,
          buyerProfile: true,
          groomerProfile: true,
          _count: {
            select: {
              bookingsAsBuyer: true,
              bookingsAsGroomer: true,
              reviewsReceived: true,
              reviewsWritten: true,
              tickets: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, dto.page, dto.limit);
  }

  async userDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        buyerProfile: true,
        groomerProfile: {
          include: {
            services: {
              include: { category: true, addonMappings: true },
              orderBy: { createdAt: 'desc' },
            },
            addons: { orderBy: { createdAt: 'desc' } },
            availability: {
              orderBy: { date: 'desc' },
              take: 30,
              include: { slots: { orderBy: { startTime: 'asc' } } },
            },
          },
        },
        pets: { orderBy: { createdAt: 'desc' } },
        favoriteGroomers: {
          orderBy: { createdAt: 'desc' },
          include: {
            groomer: {
              include: {
                user: { select: safeUserSelect },
              },
            },
          },
        },
        reviewsReceived: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: { select: safeUserSelect },
            booking: {
              select: {
                id: true,
                bookingNumber: true,
                status: true,
                totalAmount: true,
                createdAt: true,
              },
            },
          },
        },
        reviewsWritten: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewee: { select: safeUserSelect },
            booking: {
              select: {
                id: true,
                bookingNumber: true,
                status: true,
                totalAmount: true,
                createdAt: true,
              },
            },
          },
        },
        targetActionLogs: {
          orderBy: { createdAt: 'desc' },
          include: { admin: { select: safeUserSelect } },
        },
        _count: {
          select: {
            bookingsAsBuyer: true,
            bookingsAsGroomer: true,
            reviewsReceived: true,
            reviewsWritten: true,
            pets: true,
            tickets: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [{ buyerId: id }, { groomerId: id }],
      },
      orderBy: { createdAt: 'desc' },
      include: bookingDetailInclude,
    });

    return {
      user: sanitizeUser(user),
      bookings,
      feedback: {
        received: user.reviewsReceived,
        written: user.reviewsWritten,
      },
    };
  }

  async blockUser(adminId: string, id: string, dto: AdminBlockUserDto) {
    if (adminId === id)
      throw new ForbiddenException('Admins cannot block themselves');

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');

    const isBlocked = dto.isBlocked ?? true;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isBlocked,
        status: isBlocked ? 'SUSPENDED' : 'ACTIVE',
      },
      select: safeUserSelect,
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: id,
        action: isBlocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
        note: dto.note,
      },
    });
    return user;
  }

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
