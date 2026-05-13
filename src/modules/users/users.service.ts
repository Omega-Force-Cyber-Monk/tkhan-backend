import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { paginate, paginated } from '../../common/utils/pagination';
import { BlockUserDto, UpdateProfileDto, UserFilterDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { buyerProfile: true, groomerProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return sanitizeUser(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    return sanitizeUser(user);
  }

  async list(dto: UserFilterDto) {
    const where: any = {
      ...(dto.role && { role: dto.role }),
      ...(dto.status && { status: dto.status }),
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
        include: { buyerProfile: true, groomerProfile: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items.map(sanitizeUser), total, dto.page, dto.limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        buyerProfile: true,
        groomerProfile: true,
        bookingsAsBuyer: true,
        bookingsAsGroomer: true,
        reviewsReceived: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return sanitizeUser(user);
  }

  async deleteMe(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({
        where: { OR: [{ buyerId: userId }, { groomerId: userId }] },
        select: { id: true, availabilitySlotId: true },
      });
      const bookingIds = bookings.map((booking) => booking.id);
      const slotIds = bookings
        .map((booking) => booking.availabilitySlotId)
        .filter((id): id is string => Boolean(id));

      if (bookingIds.length > 0) {
        await tx.chatConversation.deleteMany({
          where: { bookingId: { in: bookingIds } },
        });
        await tx.booking.deleteMany({
          where: { id: { in: bookingIds } },
        });
      }

      await tx.chatConversation.deleteMany({
        where: { OR: [{ buyerId: userId }, { groomerId: userId }] },
      });

      if (slotIds.length > 0) {
        await tx.groomerAvailabilitySlot.updateMany({
          where: { id: { in: slotIds } },
          data: { isBooked: false },
        });
      }

      await tx.user.delete({ where: { id: userId } });
    });

    return { message: 'Account permanently deleted' };
  }

  async block(adminId: string, id: string, dto: BlockUserDto) {
    if (adminId === id)
      throw new ForbiddenException('Admins cannot block themselves');
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isBlocked: dto.isBlocked ?? true,
        status: dto.isBlocked === false ? 'ACTIVE' : 'SUSPENDED',
      },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: id,
        action: dto.isBlocked === false ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
        note: dto.note,
      },
    });
    return sanitizeUser(user);
  }
}
