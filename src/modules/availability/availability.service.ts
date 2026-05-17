import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AvailabilityQueryDto,
  AvailabilitySlotDto,
  UpdateAvailabilitySlotDto,
  UpsertAvailabilityDto,
} from './dto/availability.dto';

const SLOT_MINUTES = 60;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}
  async upsert(userId: string, dto: UpsertAvailabilityDto) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    if (groomer.approvalStatus !== 'APPROVED')
      throw new ForbiddenException('Groomer approval required');
    const date = this.parseDateOnly(dto.date);
    if (date < new Date(new Date().toISOString().slice(0, 10)))
      throw new BadRequestException('Availability cannot be set in the past');
    const slots = this.expandHourlySlots(dto.date, dto.slots);
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
      const slotsToCreate = await this.filterNewSlots(
        tx,
        availability.id,
        slots,
      );
      if (slotsToCreate.length)
        await tx.groomerAvailabilitySlot.createMany({
          data: slotsToCreate.map((slot) => ({
            availabilityId: availability.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
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
        ...(dto.panel === 'BUYER' && { isAvailable: true }),
        date: {
          ...(dto.from && { gte: this.parseDateOnly(dto.from) }),
          ...(dto.to && { lte: this.parseDateOnly(dto.to) }),
        },
      },
      orderBy: { date: 'asc' },
      include: {
        slots: {
          where: dto.panel === 'BUYER' ? { isBooked: false } : undefined,
          orderBy: { startTime: 'asc' },
        },
      },
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
  async updateSlot(
    userId: string,
    slotId: string,
    dto: UpdateAvailabilitySlotDto,
  ) {
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
      throw new BadRequestException('Cannot update a booked slot');

    const replacements = this.expandHourlySlots(
      slot.availability.date.toISOString().slice(0, 10),
      [dto],
    );
    if (replacements.length !== 1)
      throw new BadRequestException(
        'Specific slot update must be exactly 1 hour',
      );
    const [replacement] = replacements;
    await this.assertSlotDoesNotOverlap(
      this.prisma,
      slot.availabilityId,
      replacement,
      slotId,
    );

    return this.prisma.groomerAvailabilitySlot.update({
      where: { id: slotId },
      data: {
        startTime: replacement.startTime,
        endTime: replacement.endTime,
      },
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

  private async filterNewSlots(
    tx: any,
    availabilityId: string,
    slots: { startTime: Date; endTime: Date }[],
  ) {
    const existingSlots = await tx.groomerAvailabilitySlot.findMany({
      where: { availabilityId },
      select: { id: true, startTime: true, endTime: true },
    });
    const slotsToCreate: { startTime: Date; endTime: Date }[] = [];

    for (const slot of slots) {
      const exactMatch = existingSlots.some((existing) =>
        this.isSameSlot(existing, slot),
      );
      if (exactMatch) continue;

      const overlapsExisting = existingSlots.some((existing) =>
        this.slotsOverlap(existing, slot),
      );
      const overlapsNew = slotsToCreate.some((existing) =>
        this.slotsOverlap(existing, slot),
      );
      if (overlapsExisting || overlapsNew)
        throw new BadRequestException(
          'Availability slot overlaps an existing slot',
        );

      slotsToCreate.push(slot);
    }

    return slotsToCreate;
  }

  private async assertSlotDoesNotOverlap(
    prisma: PrismaService,
    availabilityId: string,
    slot: { startTime: Date; endTime: Date },
    excludedSlotId: string,
  ) {
    const existingSlots = await prisma.groomerAvailabilitySlot.findMany({
      where: {
        availabilityId,
        id: { not: excludedSlotId },
      },
      select: { startTime: true, endTime: true },
    });
    if (existingSlots.some((existing) => this.slotsOverlap(existing, slot)))
      throw new BadRequestException(
        'Availability slot overlaps an existing slot',
      );
  }

  private isSameSlot(
    a: { startTime: Date; endTime: Date },
    b: { startTime: Date; endTime: Date },
  ) {
    return (
      a.startTime.getTime() === b.startTime.getTime() &&
      a.endTime.getTime() === b.endTime.getTime()
    );
  }

  private slotsOverlap(
    a: { startTime: Date; endTime: Date },
    b: { startTime: Date; endTime: Date },
  ) {
    return a.startTime < b.endTime && b.startTime < a.endTime;
  }

  private expandHourlySlots(date: string, slots: AvailabilitySlotDto[]) {
    const expanded: { startTime: Date; endTime: Date }[] = [];
    const seen = new Set<string>();

    for (const slot of slots) {
      const startTime = this.parseSlotBoundary(date, slot.startTime);
      const endTime = this.parseSlotBoundary(date, slot.endTime);
      if (endTime <= startTime)
        throw new BadRequestException('Slot endTime must be after startTime');

      const durationMinutes =
        (endTime.getTime() - startTime.getTime()) / (60 * 1000);
      if (!Number.isInteger(durationMinutes) || durationMinutes % SLOT_MINUTES)
        throw new BadRequestException(
          'Slot range must be divisible into 1 hour slots',
        );

      for (
        let cursor = startTime.getTime();
        cursor < endTime.getTime();
        cursor += SLOT_MINUTES * 60 * 1000
      ) {
        const next = cursor + SLOT_MINUTES * 60 * 1000;
        const key = `${cursor}-${next}`;
        if (seen.has(key))
          throw new BadRequestException('Duplicate availability slot');
        seen.add(key);
        expanded.push({
          startTime: new Date(cursor),
          endTime: new Date(next),
        });
      }
    }

    return expanded.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );
  }

  private parseDateOnly(date: string) {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private parseSlotBoundary(date: string, time: string) {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return new Date(`${date}T${time}:00.000Z`);
    }

    const parsed = new Date(time);
    if (Number.isNaN(parsed.getTime()))
      throw new BadRequestException('Invalid slot time');

    return parsed;
  }
}
