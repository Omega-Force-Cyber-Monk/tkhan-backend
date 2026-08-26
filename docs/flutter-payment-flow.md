# Flutter Payment And Stripe Connect Flow

This document is for the Flutter developer integrating buyer payment, groomer Stripe Connect onboarding, booking completion, and payout visibility.

Base API:

- Local: `http://localhost:3000/api/v1`
- Production: use the deployed backend URL

All protected routes need:

```http
Authorization: Bearer ACCESS_TOKEN
```

## 1. Groomer Stripe Connect Setup

Before a groomer can receive bookings, the groomer must complete Stripe Connect onboarding.

### Check current Connect status

`GET /payouts/connect/status`

Role: `GROOMER`

Use this to decide what UI to show.

Important response fields:

```json
{
  "connectedAccountId": "acct_xxx",
  "onboardingCompleted": true,
  "transfersEnabled": true,
  "payoutsEnabled": true,
  "payoutSetupComplete": true,
  "availableForBookings": false
}
```

If `payoutSetupComplete` is `false`, show a button like **Complete payout setup**.

### Start or resume onboarding

`POST /payouts/connect/onboarding-link`

Role: `GROOMER`

Response:

```json
{
  "url": "https://connect.stripe.com/setup/e/...",
  "expiresAt": "2026-07-13T08:09:41.000Z",
  "accountId": "acct_xxx"
}
```

Flutter should open `url` in browser/webview. After Stripe redirects back to the app return URL, call `GET /payouts/connect/status` again.

### Open Express dashboard

`POST /payouts/connect/dashboard-link`

Role: `GROOMER`

Use this after onboarding is complete so groomers can see their Stripe Express balance, bank payout status, account requirements, and payout history.

## 2. Groomer Booking Availability

After Connect setup is complete, groomer can enable bookings.

`PATCH /groomer/booking-availability`

Role: `GROOMER`

```json
{
  "availableForBookings": true
}
```

Backend may reject this if the groomer is not approved, Connect setup is incomplete, no active service exists, or no future availability slot exists.

## 3. Buyer Booking And Payment

### Create booking

`POST /bookings`

Role: `BUYER`

```json
{
  "groomerId": "GROOMER_PROFILE_ID",
  "serviceId": "SERVICE_ID",
  "addonIds": ["ADDON_ID"],
  "availabilitySlotId": "SLOT_ID",
  "petId": "PET_ID",
  "serviceLocation": "Customer home",
  "addressLine": "123 Main Street",
  "state": "Ontario",
  "city": "Toronto",
  "postalCode": "M5V 2T6",
  "note": "Please be gentle with the pet."
}
```

Save `bookingId` from the response.

Important: `groomerId` here means `groomerProfileId`, not groomer user id.

### Create Stripe PaymentIntent

`POST /payments/bookings/{bookingId}/payment-intent`

Role: `BUYER`

Response:

```json
{
  "paymentId": "payment-uuid",
  "paymentIntentId": "pi_xxx",
  "clientSecret": "pi_xxx_secret_xxx",
  "amount": "78.00",
  "currency": "cad"
}
```

Flutter should use Stripe SDK with `clientSecret` to collect and confirm card payment.

### Sync backend after payment

`POST /payments/bookings/{bookingId}/confirm`

Role: `BUYER`

Call this after Stripe SDK payment succeeds. Backend verifies the PaymentIntent with Stripe and marks payment as `SUCCEEDED`.

After payment success, booking becomes visible to groomer as a new request.

## 4. Booking Fulfillment

### Groomer accepts booking

`PATCH /bookings/{bookingId}/accept`

Role: `GROOMER`

### Groomer starts work

`PATCH /bookings/{bookingId}/in-progress`

Role: `GROOMER`

Use `multipart/form-data` if sending `beforeImage`.

### Groomer requests completion

`PATCH /bookings/{bookingId}/request-completion`

Role: `GROOMER`

Use `multipart/form-data` if sending `afterImage`.

Optional fields:

- `note`
- `afterImage`

### Buyer or admin approves completion

`PATCH /bookings/{bookingId}/approve-completion`

Role: `BUYER` or `ADMIN`

This is the payout trigger. After approval:

- booking becomes `COMPLETED`
- groomer earning is transferred to the groomer connected Stripe account
- platform fee stays in the platform Stripe account
- Stripe sends the connected account balance to groomer bank according to payout schedule

## 5. Groomer Earnings UI

### Summary

`GET /payouts/summary`

Role: `GROOMER`

Use this for earnings screen.

Important fields:

- `totalEarned`
- `paidOutTotal`
- `pendingTransferTotal`
- `failedTransferTotal`
- `thisWeekIncome`
- `thisMonthIncome`
- `recentEarnings`
- `connectStatus`

### Single payout detail

`GET /payouts/transactions/{payoutId}`

Role: `GROOMER` or `ADMIN`

Use this for transaction detail screens.

## 6. Admin Payment Visibility

Admin can view:

- `GET /admin/payments`
- `GET /payouts`
- `GET /payouts/transactions/{payoutId}`
- `GET /dashboard/overview`
- `GET /dashboard/trends`

Admin can approve completion through:

- `PATCH /bookings/{bookingId}/approve-completion`

## 7. Realtime And Notifications

Booking status updates emit realtime socket events through the notifications socket namespace. Flutter should listen for booking update events and refresh relevant booking screens.

Stored notifications are available from:

- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

## 8. Important Frontend Rules

- Do not create custom card payment UI manually; use Stripe Flutter SDK with `clientSecret`.
- Do not let buyer create booking unless groomer is bookable from backend response.
- If payment succeeds in Stripe SDK, always call backend confirm route.
- If `payoutSetupComplete` is false, groomer should finish Connect onboarding before enabling booking availability.
- Groomer bank payout is handled by Stripe payout schedule, not by a custom withdraw button.

