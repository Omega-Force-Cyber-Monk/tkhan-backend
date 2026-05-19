# Tkhan Service Marketplace Backend

Production-oriented NestJS backend for a buyer/groomer service marketplace.

## Stack

- NestJS 11
- Prisma 7 with PostgreSQL
- JWT access and refresh auth
- Bcrypt password hashing
- Swagger/OpenAPI at `/docs`
- Socket.IO gateways for chat and notifications
- Stripe PaymentIntent, webhook, refund, and Connect payout structure

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:setup
npm run start:dev
```

The API runs at `http://localhost:3000/api/v1`; Swagger is at `http://localhost:3000/docs`.

Seeded admin:

- email: `ADMIN_EMAIL` from `.env`, default `admin@tkhan.local`
- password: `ADMIN_PASSWORD` from `.env`, default `Admin@123456`

The seed is safe to run more than once. It creates or repairs the configured
admin as an active, verified, unblocked `ADMIN` user and also seeds service
categories. By default it also keeps the legacy demo admin
`admin@gmail.com` / `123456`; set `SEED_LEGACY_ADMIN=false` to skip that
account.

## Render Deploy

Set these environment variables in Render:

- `DATABASE_URL` - Neon pooled/runtime URL
- `MIGRATE_DATABASE_URL` - Neon direct/non-pooler URL for Prisma migrations
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Prisma CLI commands use `MIGRATE_DATABASE_URL` when it is set and fall back to
`DATABASE_URL` otherwise. On Neon, keep `DATABASE_URL` pointed at the pooled
host for the running API, but set `MIGRATE_DATABASE_URL` to the direct database
host so `prisma migrate deploy` does not run through the pooler.

Use this build command:

```bash
npm install && npm run render:build
```

Use this start command:

```bash
npm run start:prod
```

## Core Flow

1. Buyer registers, verifies email, logs in.
2. Groomer registers and waits for admin approval.
3. Admin approves groomer.
4. Groomer creates services, add-ons, and availability slots.
5. Buyer creates a booking in `PAYMENT_PENDING`.
6. Buyer requests a Stripe PaymentIntent for the booking.
7. Flutter confirms payment with Stripe SDK and Stripe webhook marks payment `SUCCEEDED` and booking `PENDING`.
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
- `POST /api/v1/payments/bookings/:bookingId/payment-intent`
- `POST /api/v1/payments/stripe/webhook`

## Notes

- Stripe Connect transfers are implemented when a groomer has a default payout-enabled payment method with `stripeAccountId`. Without that external onboarding, payouts remain `PENDING`.
- Email sending is intentionally scaffolded: verification/reset token delivery should be wired to a mail provider before production launch.
- All sensitive user fields are stripped by user-facing services ..
