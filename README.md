# Tkhan Service Marketplace Backend

Production-oriented NestJS backend for a buyer/groomer service marketplace.

## Stack

- NestJS 11
- Prisma 7 with PostgreSQL
- JWT access and refresh auth
- Bcrypt password hashing
- Swagger/OpenAPI at `/docs`
- Socket.IO gateways for chat and notifications
- Stripe checkout, webhook, refund, and Connect payout structure

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

The API runs at `http://localhost:3000/api/v1`; Swagger is at `http://localhost:3000/docs`.

Seeded admin:

- email: `admin@tkhan.local`
- password: `Admin@123456`

## Core Flow

1. Buyer registers, verifies email, logs in.
2. Groomer registers and waits for admin approval.
3. Admin approves groomer.
4. Groomer creates services, add-ons, and availability slots.
5. Buyer creates a booking in `PAYMENT_PENDING`.
6. Buyer creates Stripe checkout for the booking.
7. Stripe webhook marks payment `SUCCEEDED` and booking `REQUESTED`.
8. Groomer accepts or rejects. Reject issues full refund.
9. Groomer sends completion request.
10. Buyer approves completion, booking becomes `COMPLETED`, payout release is prepared.

## Important Endpoints

- `POST /api/v1/auth/register/buyer`
- `POST /api/v1/auth/register/groomer`
- `POST /api/v1/auth/login`
- `PATCH /api/v1/admin/groomers/:id/approve`
- `POST /api/v1/services`
- `POST /api/v1/addons`
- `POST /api/v1/availability`
- `POST /api/v1/bookings`
- `POST /api/v1/payments/bookings/:bookingId/checkout`
- `POST /api/v1/payments/stripe/webhook`

## Notes

- Stripe Connect transfers are implemented when a groomer has a default payout-enabled payment method with `stripeAccountId`. Without that external onboarding, payouts remain `PENDING`.
- Email sending is intentionally scaffolded: verification/reset token delivery should be wired to a mail provider before production launch.
- All sensitive user fields are stripped by user-facing services.
