# Stripe Connect Flow By File

This document explains the current automated Stripe Connect payment flow file-by-file and function-by-function.

Use this as a handoff note for another engineer or agent.

## Scope

This flow covers:

- groomer registration
- groomer admin approval dependency
- Stripe Connect onboarding
- buyer booking creation
- Stripe payment intent + payment confirmation
- booking lifecycle updates
- automatic payout transfer after completion
- Stripe Connect payout schedule configuration
- notifications and realtime booking updates

## High-Level Flow

1. Groomer registers.
2. Admin approves groomer.
3. Groomer logs in and starts Stripe Connect onboarding.
4. Stripe sends `account.updated` webhook.
5. Backend marks groomer payout setup complete.
6. Buyer creates booking.
7. Backend creates Stripe PaymentIntent.
8. Buyer completes payment.
9. Backend marks payment succeeded and booking becomes a live request.
10. Groomer accepts and completes work.
11. Buyer or admin approves completion.
12. Backend automatically creates payout record and transfers groomer earning to connected account.

## Main Data Fields

Defined in [prisma/schema.prisma](/Users/softvence/arif/project/tkhan-backend/prisma/schema.prisma)

### `GroomerProfile`

Stripe Connect readiness is stored here:

- `stripeConnectedAccountId`
- `stripeOnboardingCompleted`
- `stripeTransfersEnabled`
- `stripePayoutsEnabled`
- `stripeOnboardingStartedAt`
- `stripeOnboardingCompletedAt`
- `stripeConnectCountry`
- `stripeConnectEmail`
- `availableForBookings`
- `approvalStatus`

### `Payment`

Stripe charge/payment tracking:

- `stripePaymentIntentId`
- `stripeChargeId`
- `status`
- `paidAt`
- `stripeRefundId`
- `failureReason`

### `Payout`

Automated groomer transfer tracking:

- `bookingId`
- `groomerId`
- `amount`
- `platformFee`
- `currency`
- `status`
- `stripeTransferId`
- `transferredAt`
- `payoutPaidOutAt`
- `failureReason`

## File Map

## 1. Auth Entry

File: [src/modules/auth/auth.controller.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/auth/auth.controller.ts)

Important functions:

- `registerBuyer()`
- `registerGroomer()`
- `login()`
- `verifyEmail()`

Responsibility:

- public entry routes for buyer/groomer auth
- handles multipart uploads for groomer registration
- forwards business logic to `AuthService`

File: [src/modules/auth/auth.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/auth/auth.service.ts)

Important functions:

- `registerBuyer(dto)`
- `registerGroomer(dto)`
- `login(dto)`
- `verifyEmail(dto)`

Flow details:

- `registerBuyer()` creates buyer with email OTP verification state
- `registerGroomer()` creates groomer with `status = INACTIVE` and `approvalStatus = PENDING`
- `registerGroomer()` also creates admin notification via `notifications.createForAdmins(...)`
- `login()` blocks buyer login if email not verified
- `login()` blocks groomer login until admin approval

Important note:

- Stripe Connect is not started during registration
- Stripe onboarding starts later from payout routes after groomer login

## 2. Groomer Availability Guard

File: [src/modules/groomer/groomer.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/groomer/groomer.service.ts)

Important functions:

- `updateProfile(userId, dto)`
- `toggleBookingAvailability(userId, availableForBookings)`
- `dashboard(userId)`
- `earnings(userId)`
- `assertCanEnableBookings(userId)`

Flow details:

- `assertCanEnableBookings()` blocks enabling bookings unless:
- groomer is approved
- Stripe payout setup is complete
- at least one active service exists
- at least one future free slot exists
- `dashboard()` returns `connectStatus` from `PayoutsService.connectStatus()`
- `earnings()` delegates to `PayoutsService.summary()`

This file is the guard between groomer profile readiness and actual bookability.

## 3. Booking Entry And Lifecycle

File: [src/modules/bookings/bookings.controller.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/bookings/bookings.controller.ts)

Important routes:

- `POST /bookings`
- `PATCH /bookings/:id/accept`
- `PATCH /bookings/:id/reject`
- `PATCH /bookings/:id/in-progress`
- `PATCH /bookings/:id/request-completion`
- `PATCH /bookings/:id/approve-completion`

Responsibility:

- route layer
- handles image uploads for before/after booking images
- forwards to `BookingsService`

File: [src/modules/bookings/bookings.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/bookings/bookings.service.ts)

Important functions:

- `create(buyerId, dto)`
- `listForUser(userId, role, dto)`
- `detail(userId, role, id)`
- `accept(groomerId, id)`
- `reject(groomerId, id, dto)`
- `markInProgress(groomerId, id, beforeImage)`
- `requestCompletion(groomerId, id, dto, afterImage)`
- `approveCompletion(userId, role, id)`
- `uploadImages(groomerId, id, dto)`

### `create(buyerId, dto)`

This is the main booking constructor.

What it checks:

- pet exists and belongs to buyer
- groomer exists
- groomer is approved
- groomer is not blocked
- groomer has bookings enabled
- groomer Stripe Connect setup is complete via `payouts.assertGroomerPayoutSetupComplete(...)`
- service belongs to groomer and is active
- slot belongs to groomer and is free
- add-ons belong to the selected service

What it creates:

- booking row
- booking service snapshot
- booking addon snapshots
- initial payment row with `status = PAYMENT_PENDING`

Pricing logic here:

- `serviceChargeAmount` comes from platform settings
- `platformFeeAmount` is `subtotal * 0.1`
- `groomerEarningAmount` is `subtotal - platformFee`
- `totalAmount` is `subtotal + serviceCharge`

### `accept(groomerId, id)`

Flow:

- syncs booking payment from Stripe using `payments.syncPaymentStatusForBooking(id)`
- ensures a successful payment exists
- updates booking status to `ACCEPTED`
- sends buyer notification
- emits realtime `booking.updated`

### `reject(groomerId, id, dto)`

Flow:

- marks booking rejected
- reopens availability slot
- notifies buyer and admins
- calls `payments.refundBooking(...)`

### `markInProgress(...)`

Flow:

- only allowed from `ACCEPTED`
- saves optional `beforeImage`
- updates status to `IN_PROGRESS`
- notifies buyer
- emits realtime event

### `requestCompletion(...)`

Flow:

- allowed from `ACCEPTED` or `IN_PROGRESS`
- saves optional `afterImage` and completion note
- updates status to `COMPLETION_REQUESTED`
- notifies buyer and admins
- emits realtime event

### `approveCompletion(...)`

This is the payout trigger point.

Flow:

- buyer or admin approves completion
- booking becomes `COMPLETED`
- successful payment rows become `COMPLETED`
- emits realtime event
- calls `payouts.releaseForBooking(id)`

## 4. Stripe Payment Flow

File: [src/modules/payments/payments.controller.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/payments/payments.controller.ts)

Important routes:

- `POST /payments/bookings/:bookingId/payment-intent`
- `POST /payments/bookings/:bookingId/confirm`
- `POST /payments/stripe/webhook`

File: [src/modules/payments/payments.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/payments/payments.service.ts)

Important functions:

- `createPaymentIntent(bookingId, buyerId)`
- `confirmBookingPayment(bookingId, buyerId)`
- `syncPaymentStatusForBooking(bookingId)`
- `handleWebhook(rawBody, signature)`
- `markPaymentSucceeded(paymentId, paymentIntentId, stripeChargeId?)`
- `refundBooking(bookingId, reason?, bookingStatus?)`
- `refundExpiredPendingBookings()`

### `createPaymentIntent(...)`

Flow:

- validates booking belongs to buyer
- validates booking is in payable state
- reuses existing Stripe PaymentIntent if possible
- otherwise creates a new Stripe PaymentIntent
- stores `stripePaymentIntentId` in `Payment`

Returns:

- `paymentId`
- `paymentIntentId`
- `clientSecret`
- amount/currency

### `confirmBookingPayment(...)`

Flow:

- validates booking ownership
- delegates to `syncPaymentStatusForBooking(...)`

### `syncPaymentStatusForBooking(...)`

Flow:

- loads latest payment row
- checks Stripe PaymentIntent status
- if Stripe says `succeeded`, calls `markPaymentSucceeded(...)`
- otherwise returns meaningful validation error

### `handleWebhook(...)`

This is the cross-module Stripe event hub.

Event mapping:

- `payment_intent.succeeded` -> `markPaymentSucceeded(...)`
- `payment_intent.payment_failed` -> mark payment failed
- `account.updated` -> `payouts.handleConnectedAccountUpdated(...)`

### `markPaymentSucceeded(...)`

This is where a paid booking becomes a real booking request.

Flow:

- updates payment to `SUCCEEDED`
- stores `stripeChargeId`
- updates booking status to `PENDING`
- sets `requestedAt`
- creates buyer notification
- creates groomer notification
- emits realtime `booking.updated`
- creates admin notification

### `refundBooking(...)`

Flow:

- creates Stripe refund if there is a Stripe payment intent
- marks payment `REFUNDED`
- updates booking to `REJECTED` or `REFUNDED`
- reopens slot
- notifies buyer and admins

## 5. Stripe Connect And Payout Core

File: [src/modules/payouts/payouts.controller.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/payouts/payouts.controller.ts)

Important routes:

- `GET /payouts`
- `GET /payouts/transactions/:id`
- `GET /payouts/summary`
- `GET /payouts/connect/status`
- `POST /payouts/connect/onboarding-link`
- `POST /payouts/connect/dashboard-link`

File: [src/modules/payouts/payouts.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/payouts/payouts.service.ts)

Important functions:

- `releaseForBooking(bookingId)`
- `list()`
- `detail(userId, role, id)`
- `summary(userId)`
- `connectStatus(userId)`
- `createOnboardingLink(userId)`
- `createDashboardLink(userId)`
- `handleConnectedAccountUpdated(account)`
- `releasePendingPayoutsForGroomer(groomerId)`
- `assertGroomerPayoutSetupComplete(groomer)`
- `ensureConnectedAccount(groomer)`
- `configureConnectedAccountPayoutSchedule(accountId)`
- `buildConnectedAccountPayoutSettings()`

### `createOnboardingLink(userId)`

Flow:

- loads groomer profile
- requires admin approval
- ensures connected account exists via `ensureConnectedAccount(...)`
- creates Stripe onboarding link with `refresh_url` and `return_url`
- stores `stripeOnboardingStartedAt`

### `ensureConnectedAccount(groomer)`

Flow:

- if account already exists, applies the configured payout schedule and reuses it
- otherwise creates Stripe `express` connected account
- applies payout schedule settings during account creation
- stores:
- `stripeConnectedAccountId`
- `stripeConnectCountry`
- `stripeConnectEmail`
- `stripeOnboardingStartedAt`

Payout schedule env:

- `STRIPE_CONNECT_PAYOUT_INTERVAL`: `daily`, `weekly`, `monthly`, or `manual`
- `STRIPE_CONNECT_PAYOUT_DELAY_DAYS`: `minimum` or a number from `0` to `31`
- `STRIPE_CONNECT_PAYOUT_WEEKLY_DAY`: used when interval is `weekly`
- `STRIPE_CONNECT_PAYOUT_MONTHLY_DAY`: used when interval is `monthly`

Important distinction:

- `releaseForBooking(...)` transfers groomer earning from the platform Stripe account to the groomer connected Stripe account
- the connected account bank payout then follows the Stripe payout schedule

### `handleConnectedAccountUpdated(account)`

This function is the main Connect state sync.

Called from:

- `PaymentsService.handleWebhook(...)`

What it updates on `GroomerProfile`:

- `stripeOnboardingCompleted`
- `stripeTransfersEnabled`
- `stripePayoutsEnabled`
- `stripeOnboardingCompletedAt`
- `stripeConnectCountry`
- `stripeConnectEmail`

Extra behavior:

- if account becomes ready for the first time, sends groomer notification
- retries pending or failed payouts using `releasePendingPayoutsForGroomer(...)`

### `assertGroomerPayoutSetupComplete(groomer)`

This is the main readiness guard.

It throws if:

- Connect account not created
- onboarding not completed
- transfers not enabled
- payouts not enabled

Used by:

- `BookingsService.create(...)`
- `GroomerService.assertCanEnableBookings(...)`

### `releaseForBooking(bookingId)`

This is the automated payout engine.

When called:

- after booking completion approval
- when previously pending payouts are retried

Flow:

- loads completed booking
- loads groomer profile
- finds/creates payout row
- if payout already transferred, returns it
- if Connect not ready, keeps payout pending
- if `stripeChargeId` missing, marks payout failed
- otherwise creates Stripe transfer from platform payment to groomer connected account

Stripe call:

- `stripe.transfers.create(...)`

Important transfer inputs:

- `source_transaction = payment.stripeChargeId`
- `destination = groomerProfile.stripeConnectedAccountId`
- `amount = payout.amount`

Side effects:

- updates payout status to `TRANSFERRED`
- stores `stripeTransferId`
- stores `transferredAt`
- notifies groomer and admins

### `summary(userId)`

Builds groomer payout dashboard data:

- total earned
- available balance
- pending transfer total
- transferred total
- failed transfer total
- this week income
- this month income
- recent earnings
- connect status

### `detail(userId, role, id)`

Returns one payout transaction with booking, buyer, groomer, pet, services, and addons.

## 6. Notifications And Realtime

File: [src/modules/notifications/notifications.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/notifications/notifications.service.ts)

Important functions:

- `create(userId, type, title, body?, data?)`
- `createForAdmins(type, title, body?, data?)`
- `emitBookingUpdated(userIds, payload)`

Flow details:

- every notification is stored in DB
- notification is emitted to socket room
- push notification is attempted through Firebase if device tokens exist
- `createForAdmins(...)` fans out one event to all active admins
- `emitBookingUpdated(...)` is the realtime booking-status event used by buyer and groomer

File: [src/modules/notifications/notifications.gateway.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/notifications/notifications.gateway.ts)

Important functions:

- `handleConnection(socket)`
- `emitToUser(userId, event, payload)`
- `emitToUsers(userIds, event, payload)`

Flow details:

- namespace is `notifications`
- socket auth uses JWT access token
- each user joins room `user:{userId}`
- backend emits:
- `notification.created`
- `booking.updated`

## 7. Default Test Users

File: [src/database/default-users-seed.service.ts](/Users/softvence/arif/project/tkhan-backend/src/database/default-users-seed.service.ts)

Important functions:

- `onModuleInit()`
- `ensureUser(seed, password)`

What it does:

- auto-creates `admin@gmail.com`, `gromer@gmail.com`, `buyer@gmail.com` if they do not already exist
- default password is `123456`
- existing users are not overwritten

Important current caveat:

- if `admin@gmail.com` already exists in DB, this service will not reset its password

## 8. Error Normalization

File: [src/common/filters/http-exception.filter.ts](/Users/softvence/arif/project/tkhan-backend/src/common/filters/http-exception.filter.ts)

Responsibility:

- all thrown errors are returned in normalized shape
- common Prisma errors are mapped to readable API errors

Response shape:

```json
{
  "success": false,
  "statusCode": 400,
  "path": "/api/v1/example",
  "timestamp": "2026-07-12T00:00:00.000Z",
  "error": {
    "message": "Readable message here",
    "error": "Bad Request",
    "statusCode": 400
  }
}
```

## Practical Route-To-Function Call Chain

### Groomer onboarding

1. `POST /payouts/connect/onboarding-link`
2. `PayoutsController.createOnboardingLink()`
3. `PayoutsService.createOnboardingLink()`
4. `PayoutsService.ensureConnectedAccount()`
5. Stripe `accounts.create`
6. Stripe `accountLinks.create`

### Connect readiness update

1. Stripe sends `account.updated`
2. `POST /payments/stripe/webhook`
3. `PaymentsController.webhook()`
4. `PaymentsService.handleWebhook()`
5. `PayoutsService.handleConnectedAccountUpdated()`

### Buyer payment flow

1. `POST /bookings`
2. `BookingsService.create()`
3. `POST /payments/bookings/:bookingId/payment-intent`
4. `PaymentsService.createPaymentIntent()`
5. buyer completes Stripe payment
6. Stripe `payment_intent.succeeded` webhook or manual confirm route
7. `PaymentsService.markPaymentSucceeded()`
8. booking request becomes visible to groomer

### Completion to payout flow

1. groomer requests completion
2. buyer/admin approves completion
3. `BookingsService.approveCompletion()`
4. `PayoutsService.releaseForBooking()`
5. Stripe `transfers.create(...)`
6. payout row becomes `TRANSFERRED`

## Known Current Testing Restrictions

1. Stripe Connect onboarding depends on the current Stripe account country and capabilities.
2. If Stripe test account does not support Connect for that country, onboarding-link route will fail before any booking flow can pass the payout guard.
3. Booking creation is intentionally blocked until Stripe Connect setup is complete.
4. Existing seeded admin user may not use password `123456` if that email already existed before the seed service ran.

## Suggested Files To Inspect First

If another agent has very little time, inspect these first:

1. [src/modules/payouts/payouts.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/payouts/payouts.service.ts)
2. [src/modules/payments/payments.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/payments/payments.service.ts)
3. [src/modules/bookings/bookings.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/bookings/bookings.service.ts)
4. [prisma/schema.prisma](/Users/softvence/arif/project/tkhan-backend/prisma/schema.prisma)
5. [src/modules/groomer/groomer.service.ts](/Users/softvence/arif/project/tkhan-backend/src/modules/groomer/groomer.service.ts)
