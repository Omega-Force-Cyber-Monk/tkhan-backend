import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AvailabilityQueryDto,
  UpsertAvailabilityDto,
} from './dto/availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}
  async upsert(userId: string, dto: UpsertAvailabilityDto) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    if (groomer.approvalStatus !== 'APPROVED')
      throw new ForbiddenException('Groomer approval required');
    const date = new Date(dto.date);
    if (date < new Date(new Date().toISOString().slice(0, 10)))
      throw new BadRequestException('Availability cannot be set in the past');
    return this.prisma.$transaction(async (tx) => {
      const availability = await tx.groomerAvailability.upsert({
        where: { groomerId_date: { groomerId: groomer.id, date } },
        create: {
          groomerId: groomer.id,
          date,
          isAvailable: dto.isAvailable ?? true,
        },
        update: { isAvailable: dto.isAvailable ?? true },
      });
      const booked = await tx.groomerAvailabilitySlot.count({
        where: { availabilityId: availability.id, isBooked: true },
      });
      if (booked > 0)
        throw new BadRequestException(
          'Cannot replace slots while a slot is booked',
        );
      await tx.groomerAvailabilitySlot.deleteMany({
        where: { availabilityId: availability.id },
      });
      if (dto.slots.length)
        await tx.groomerAvailabilitySlot.createMany({
          data: dto.slots.map((slot) => ({
            availabilityId: availability.id,
            startTime: new Date(slot.startTime),
            endTime: new Date(slot.endTime),
          })),
        });
      return tx.groomerAvailability.findUnique({
        where: { id: availability.id },
        include: { slots: true },
      });
    });
  }
  async list(dto: AvailabilityQueryDto) {
    return this.prisma.groomerAvailability.findMany({
      where: {
        ...(dto.groomerId && { groomerId: dto.groomerId }),
        date: {
          ...(dto.from && { gte: new Date(dto.from) }),
          ...(dto.to && { lte: new Date(dto.to) }),
        },
      },
      orderBy: { date: 'asc' },
      include: { slots: { orderBy: { startTime: 'asc' } } },
    });
  }
  async toggle(userId: string, id: string, isAvailable: boolean) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const availability =
      await this.prisma.groomerAvailability.findUniqueOrThrow({
        where: { id },
      });
    if (availability.groomerId !== groomer.id)
      throw new ForbiddenException('Availability is owned by another groomer');
    return this.prisma.groomerAvailability.update({
      where: { id },
      data: { isAvailable },
    });
  }
  async removeSlot(userId: string, slotId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const slot = await this.prisma.groomerAvailabilitySlot.findUniqueOrThrow({
      where: { id: slotId },
      include: { availability: true },
    });
    if (slot.availability.groomerId !== groomer.id)
      throw new ForbiddenException('Slot is owned by another groomer');
    if (slot.isBooked)
      throw new BadRequestException('Cannot remove a booked slot');
    return this.prisma.groomerAvailabilitySlot.delete({
      where: { id: slotId },
    });
  }
}
