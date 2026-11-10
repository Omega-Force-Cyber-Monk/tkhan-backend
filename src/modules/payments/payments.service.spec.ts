/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { ConfigService } from '@nestjs/config';

const stripeClient = {
  paymentIntents: { retrieve: jest.fn(), create: jest.fn() },
  refunds: { create: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => stripeClient),
}));
jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../payouts/payouts.service', () => ({
  PayoutsService: class PayoutsService {},
}));

import { PaymentsService } from './payments.service';

describe('PaymentsService booking finalization', () => {
  it('claims the slot and exposes the booking only after payment succeeds', async () => {
    const originalPayment = {
      id: 'payment-1',
      bookingId: 'booking-1',
      status: 'PAYMENT_PENDING',
      stripeChargeId: null,
      booking: {
        id: 'booking-1',
        buyerId: 'buyer-1',
        groomerId: 'groomer-1',
        availabilitySlotId: 'slot-1',
        status: 'PAYMENT_PENDING',
        requestedAt: null,
      },
    };
    const paidBooking = {
      ...originalPayment.booking,
      status: 'PENDING',
      requestedAt: new Date(),
      updatedAt: new Date(),
    };
    const succeededPayment = {
      ...originalPayment,
      status: 'SUCCEEDED',
      booking: originalPayment.booking,
    };
    const tx = {
      groomerAvailabilitySlot: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        update: jest.fn().mockResolvedValue(succeededPayment),
      },
      booking: {
        update: jest.fn().mockResolvedValue(paidBooking),
      },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(originalPayment),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ fullName: 'Buyer Example' })
          .mockResolvedValueOnce({ fullName: 'Groomer Example' }),
      },
    };
    const notifications = {
      create: jest.fn().mockResolvedValue({}),
      createForAdmins: jest.fn().mockResolvedValue([]),
      emitBookingUpdated: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('sk_test_example'),
      get: jest.fn(),
    } as unknown as ConfigService;
    const service = new PaymentsService(
      prisma as any,
      config,
      notifications as any,
      {} as any,
    );

    await service.markPaymentSucceeded(originalPayment.id, 'pi_123', 'ch_123');

    expect(tx.groomerAvailabilitySlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot-1', isBooked: false },
      data: { isBooked: true },
    });
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      'groomer-1',
      'BOOKING_CREATED',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ bookingId: 'booking-1' }),
    );
  });
});
