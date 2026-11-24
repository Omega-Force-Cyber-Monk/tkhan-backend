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

  const makeConfig = (values: Record<string, string> = {}) =>
    ({
      getOrThrow: jest.fn((key: string) => values[key] ?? 'sk_test_example'),
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  it('confirms a $0 booking without creating a Stripe PaymentIntent', async () => {
    stripeClient.paymentIntents.create.mockClear();
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-0',
          buyerId: 'buyer-1',
          status: 'PAYMENT_PENDING',
          totalAmount: '0.00',
        }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'payment-0',
          bookingId: 'booking-0',
          status: 'PAYMENT_PENDING',
        }),
      },
    };
    const service = new PaymentsService(
      prisma as any,
      makeConfig(),
      {} as any,
      {} as any,
    );
    const markSpy = jest
      .spyOn(service, 'markPaymentSucceeded')
      .mockResolvedValue({ id: 'payment-0', amount: 0, currency: 'cad' });

    const result = await service.createPaymentIntent('booking-0', 'buyer-1');

    expect(stripeClient.paymentIntents.create).not.toHaveBeenCalled();
    expect(markSpy).toHaveBeenCalledWith('payment-0', null, null);
    expect(result).toEqual(
      expect.objectContaining({ requiresPayment: false, clientSecret: null }),
    );
  });

  it('rejects totals below the Stripe minimum with a clear message', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          buyerId: 'buyer-1',
          status: 'PAYMENT_PENDING',
          totalAmount: '0.30',
        }),
      },
    };
    const service = new PaymentsService(
      prisma as any,
      makeConfig(),
      {} as any,
      {} as any,
    );
    await expect(
      service.createPaymentIntent('booking-1', 'buyer-1'),
    ).rejects.toThrow(/at least \$0\.50 CAD/);
  });

  it('refuses to boot when STRIPE_MODE does not match the key', () => {
    expect(
      () =>
        new PaymentsService(
          {} as any,
          makeConfig({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_MODE: 'live' }),
          {} as any,
          {} as any,
        ),
    ).toThrow(/STRIPE_MODE/);
  });
});
