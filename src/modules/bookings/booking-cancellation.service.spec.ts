/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../payments/payments.service', () => ({
  PaymentsService: class PaymentsService {},
}));

import { BookingCancellationService } from './booking-cancellation.service';
import { wallClockNow } from './cancellation-policy';

const TZ = 'America/Toronto';
const startIn = (hours: number) =>
  new Date(wallClockNow(TZ).getTime() + hours * 3600 * 1000);

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  id: 'b1',
  bookingNumber: 'BK-1',
  buyerId: 'buyer-1',
  groomerId: 'groomer-1',
  status: 'ACCEPTED',
  availabilitySlotId: 'slot-1',
  availabilitySlot: { id: 'slot-1', startTime: startIn(48) },
  payments: [
    {
      id: 'p1',
      status: 'SUCCEEDED',
      amount: '100.00',
      refundedAmount: null,
      stripePaymentIntentId: 'pi_1',
    },
  ],
  payouts: [],
  buyer: { id: 'buyer-1', fullName: 'Buyer' },
  groomer: {
    id: 'groomer-1',
    fullName: 'Groomer',
    groomerProfile: { id: 'gp1', noShowCount: 0, suspendedUntil: null },
  },
  ...overrides,
});

describe('BookingCancellationService policy', () => {
  const config = {
    get: (key: string) => (key === 'BUSINESS_TIME_ZONE' ? TZ : undefined),
  };
  const make = (booking: any) => {
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    };
    return new BookingCancellationService(
      prisma as any,
      {} as any,
      {} as any,
      config as any,
    );
  };

  it('buyer 24h+ before gets 100%', async () => {
    const q = await make(makeBooking()).preview('buyer-1', 'BUYER', 'b1');
    expect(q.canCancel).toBe(true);
    expect(q.refundPercent).toBe(100);
    expect(q.refundAmount).toBe(100);
    expect(q.title).toBe('Cancel this appointment?');
    expect(q.confirmLabel).toBe('Cancel & Refund');
  });

  it('buyer under 3h gets 70% with 30% late fee', async () => {
    const q = await make(
      makeBooking({
        availabilitySlot: { id: 'slot-1', startTime: startIn(2) },
      }),
    ).preview('buyer-1', 'BUYER', 'b1');
    expect(q.title).toBe('Late Cancellation');
    expect(q.refundPercent).toBe(70);
    expect(q.refundAmount).toBe(70);
    expect(q.lateFeeAmount).toBe(30);
    expect(q.confirmLabel).toBe('Cancel & Receive 70% Refund');
  });

  it('buyer cannot cancel after the appointment started', async () => {
    const q = await make(
      makeBooking({
        availabilitySlot: { id: 'slot-1', startTime: startIn(-1) },
      }),
    ).preview('buyer-1', 'BUYER', 'b1');
    expect(q.canCancel).toBe(false);
  });

  it('groomer 24h+ is not a no-show', async () => {
    const q = await make(makeBooking()).preview('groomer-1', 'GROOMER', 'b1');
    expect(q.countsAsNoShow).toBe(false);
    expect(q.refundAmount).toBe(100);
    expect(q.confirmLabel).toBe('Confirm Cancellation');
  });

  it('groomer under 24h is a late cancellation / no-show', async () => {
    const q = await make(
      makeBooking({
        availabilitySlot: { id: 'slot-1', startTime: startIn(10) },
      }),
    ).preview('groomer-1', 'GROOMER', 'b1');
    expect(q.title).toBe('Late Groomer Cancellation');
    expect(q.countsAsNoShow).toBe(true);
    expect(q.refundPercent).toBe(100);
  });

  it('unpaid booking cancels with no refund', async () => {
    const q = await make(
      makeBooking({
        status: 'PAYMENT_PENDING',
        payments: [{ id: 'p1', status: 'PAYMENT_PENDING', amount: '0.00' }],
      }),
    ).preview('buyer-1', 'BUYER', 'b1');
    expect(q.canCancel).toBe(true);
    expect(q.refundAmount).toBe(0);
  });
});
