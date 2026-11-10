/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { ForbiddenException } from '@nestjs/common';

jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../notifications/review-reminder.service', () => ({
  ReviewReminderService: class ReviewReminderService {},
}));
jest.mock('../payments/payments.service', () => ({
  PaymentsService: class PaymentsService {},
}));
jest.mock('../payouts/payouts.service', () => ({
  PayoutsService: class PayoutsService {},
}));

import { BookingsService } from './bookings.service';

describe('BookingsService payment gating', () => {
  const createService = () => {
    const tx = {
      pet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pet-1',
          buyerId: 'buyer-1',
        }),
      },
      groomerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'groomer-profile-1',
          userId: 'groomer-1',
          approvalStatus: 'APPROVED',
          availableForBookings: true,
          user: { id: 'groomer-1', isBlocked: false },
        }),
      },
      service: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'service-1',
          groomerId: 'groomer-profile-1',
          title: 'Full Groom',
          description: 'Full grooming service',
          durationMinutes: 60,
          price: 50,
          active: true,
          category: { name: 'Grooming' },
          addonMappings: [],
        }),
      },
      groomerAvailabilitySlot: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'slot-1',
          isBooked: false,
          availability: {
            groomerId: 'groomer-profile-1',
            isAvailable: true,
          },
        }),
        update: jest.fn(),
      },
      platformSetting: {
        findUnique: jest.fn().mockResolvedValue({ serviceChargeAmount: 10 }),
      },
      booking: {
        create: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: 'PAYMENT_PENDING',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUniqueOrThrow: jest.fn(),
      },
    };
    const payouts = {
      assertGroomerPayoutSetupComplete: jest.fn(),
    };
    const service = new BookingsService(
      prisma as any,
      {} as any,
      {} as any,
      payouts as any,
      {} as any,
    );
    return { service, prisma, tx };
  };

  it('creates a buyer-only payment draft without booking the slot', async () => {
    const { service, tx } = createService();

    await service.create('buyer-1', {
      groomerId: 'groomer-profile-1',
      serviceId: 'service-1',
      availabilitySlotId: 'slot-1',
      petId: 'pet-1',
      serviceLocation: 'Salon',
    });

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PAYMENT_PENDING',
          payments: {
            create: expect.objectContaining({ status: 'PAYMENT_PENDING' }),
          },
        }),
      }),
    );
    expect(tx.groomerAvailabilitySlot.update).not.toHaveBeenCalled();
  });

  it('excludes payment-pending drafts from the groomer booking list', async () => {
    const { service, prisma } = createService();

    await service.listForUser('groomer-1', 'GROOMER', {} as any);

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { groomerId: 'groomer-1' },
            { status: { not: 'PAYMENT_PENDING' } },
            { requestedAt: { not: null } },
            {
              payments: {
                some: {
                  status: {
                    in: [
                      'SUCCEEDED',
                      'COMPLETED',
                      'REFUNDED',
                      'PARTIALLY_REFUNDED',
                    ],
                  },
                },
              },
            },
          ],
        },
      }),
    );
  });

  it('prevents a groomer from opening an unpaid booking draft', async () => {
    const { service, prisma } = createService();
    prisma.booking.findUniqueOrThrow.mockResolvedValue({
      id: 'booking-1',
      buyerId: 'buyer-1',
      groomerId: 'groomer-1',
      status: 'PAYMENT_PENDING',
      requestedAt: null,
      payments: [{ status: 'PAYMENT_PENDING' }],
      payouts: [],
      reviews: [],
    });

    await expect(
      service.detail('groomer-1', 'GROOMER', 'booking-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides a refunded slot-conflict draft that was never requested', async () => {
    const { service, prisma } = createService();
    prisma.booking.findUniqueOrThrow.mockResolvedValue({
      id: 'booking-2',
      buyerId: 'buyer-2',
      groomerId: 'groomer-1',
      status: 'CANCELLED',
      requestedAt: null,
      payments: [{ status: 'REFUNDED' }],
      payouts: [],
      reviews: [],
    });

    await expect(
      service.detail('groomer-1', 'GROOMER', 'booking-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
