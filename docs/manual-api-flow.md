# Manual API Test Flow

This document is for manually testing the current backend flow from registration to completed booking and payout.

Base URL examples:

- Local: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`

## Before You Start

Make sure these are working first:

- App is running
- Database is connected
- SMTP is configured for buyer OTP email verification
- Cloudinary is configured for multipart image uploads
- Stripe test keys are configured
- Stripe webhook points to `POST /api/v1/payments/stripe/webhook`

Important webhook note:

- `payment_intent.succeeded` helps mark booking payment as paid automatically
- `payment_intent.payment_failed` updates failed payment state
- `account.updated` is required for Stripe Connect onboarding status sync

If `account.updated` does not reach the backend, groomer `payoutSetupComplete` will stay `false` even if onboarding is finished in Stripe.

## Useful Default Users

These users are auto-created on app boot if they do not already exist:

- Admin: `admin@gmail.com` / `123456`
- Groomer: `gromer@gmail.com` / `123456`
- Buyer: `buyer@gmail.com` / `123456`

If you want to test the full registration flow, use fresh email addresses instead of these defaults.

## IDs You Should Save While Testing

Keep these values as you go:

- `buyerAccessToken`
- `groomerAccessToken`
- `adminAccessToken`
- `groomerUserId`
- `groomerProfileId`
- `buyerUserId`
- `categoryId`
- `serviceId`
- `addonId` if used
- `slotId`
- `petId`
- `bookingId`
- `paymentIntentId`
- `payoutId`

## 1. Buyer Registration Flow

### 1.1 Register buyer

`POST /auth/register/buyer`

```json
{
  "fullName": "Buyer Test",
  "phone": "+15550000001",
  "email": "buyer.flow@example.com",
  "password": "Password@123",
  "streetAddress": "123 Main Street",
  "unitSuite": "Apt 4B",
  "city": "Toronto",
  "province": "Ontario",
  "postalCode": "M5V 2T6"
}
```

Expected:

- buyer user is created
- status is `PENDING_EMAIL_VERIFICATION`
- OTP is sent to the buyer email

### 1.2 Verify buyer email

`POST /auth/verify-email`

```json
{
  "email": "buyer.flow@example.com",
  "otp": "123456"
}
```

Expected:

- response message says email verified
- buyer status becomes `ACTIVE`

### 1.3 Buyer login

`POST /auth/login`

```json
{
  "email": "buyer.flow@example.com",
  "password": "Password@123"
}
```

Save:

- `buyerAccessToken`
- `buyerUserId`

## 2. Groomer Registration Flow

### 2.1 Register groomer

`POST /auth/register/groomer`

Use `multipart/form-data`.

Required text fields:

- `fullName`
- `phone`
- `email`
- `password`
- `streetAddress`
- `city`
- `province`
- `postalCode`
- `experienceYears`
- `legalFullName`
- `idNumber`
- `idType`
- `businessName`
- `serviceArea`
- `businessAddress`

Optional text fields:

- `unitSuite`
- `gstHstRegistrationNumber`
- `certifications`
- `serviceModes`

Required files:

- `idFrontImage`
- `idBackImage`

Optional files:

- `profileImage`
- `selfieWithId`

Example text values:

```text
fullName = Groomer Test
phone = +15550000002
email = groomer.flow@example.com
password = Password@123
streetAddress = 456 Queen Street
city = Toronto
province = Ontario
postalCode = M5V 2T7
experienceYears = 4
legalFullName = Groomer Test
idNumber = P1234567
idType = PASSPORT
businessName = Groomer Flow Spa
serviceArea = Toronto
businessAddress = 456 Queen Street, Toronto
gstHstRegistrationNumber = 123456789RT0001
```

Expected:

- groomer user is created
- groomer profile approval status is `PENDING`
- login will still fail until admin approval

## 3. Admin Approval Flow

### 3.1 Admin login

`POST /auth/login`

```json
{
  "email": "admin@gmail.com",
  "password": "123456"
}
```

Save:

- `adminAccessToken`

### 3.2 See pending groomers

`GET /admin/groomers/pending`

Bearer:

- `adminAccessToken`

Find your newly registered groomer and save:

- `groomerUserId`

### 3.3 Approve groomer

`PATCH /admin/groomers/{groomerUserId}/approve`

Bearer:

- `adminAccessToken`

Expected:

- groomer approval becomes `APPROVED`
- user status becomes `ACTIVE`
- `availableForBookings` is still not enough by itself
- Stripe Connect setup must also be completed before bookings work

## 4. Groomer Login And Stripe Connect Setup

### 4.1 Groomer login

`POST /auth/login`

```json
{
  "email": "groomer.flow@example.com",
  "password": "Password@123"
}
```

Save:

- `groomerAccessToken`

### 4.2 Generate Stripe onboarding link

`POST /payouts/connect/onboarding-link`

Bearer:

- `groomerAccessToken`

Expected:

- response returns `url`
- open that URL in browser
- complete Stripe Express onboarding

### 4.3 Check Connect status

`GET /payouts/connect/status`

Bearer:

- `groomerAccessToken`

Wait until this becomes true:

- `payoutSetupComplete = true`

Also check these:

- `connectedAccountId` is not null
- `onboardingCompleted = true`
- `transfersEnabled = true`
- `payoutsEnabled = true`

If these values do not update after onboarding, webhook delivery is the first thing to check.

### 4.4 Enable booking availability

`PATCH /groomer/booking-availability`

Bearer:

- `groomerAccessToken`

```json
{
  "availableForBookings": true
}
```

## 5. Category, Service, Addon, Availability Setup

## 5.1 Get categories

`GET /categories`

If category already exists, save one `categoryId`.

If no category exists, create one as admin.

### 5.2 Create category if needed

`POST /categories`

Bearer:

- `adminAccessToken`

Use `multipart/form-data`.

Text fields:

```text
name = Dog Grooming
description = Dog grooming services
active = true
```

Save:

- `categoryId`

### 5.3 Create groomer service

`POST /services`

Bearer:

- `groomerAccessToken`

```json
{
  "categoryId": "CATEGORY_ID",
  "title": "Full Grooming",
  "description": "Bath, haircut, nail trim",
  "durationMinutes": 90,
  "price": 75,
  "active": true
}
```

Save:

- `serviceId`

### 5.4 Optional addon

`POST /addons`

Bearer:

- `groomerAccessToken`

```json
{
  "serviceId": "SERVICE_ID",
  "title": "Teeth Brushing",
  "description": "Dental care add-on",
  "price": 10,
  "durationMinutes": 10,
  "active": true
}
```

Save:

- `addonId`

### 5.5 Create groomer availability

`POST /availability`

Bearer:

- `groomerAccessToken`

```json
{
  "date": "2026-07-20",
  "isAvailable": true,
  "slots": [
    {
      "startTime": "09:00",
      "endTime": "10:30"
    }
  ]
}
```

Then get the groomer detail to save a free `slotId`.

## 6. Buyer Browse Groomer And Create Pet

### 6.1 Search groomers

`GET /buyer/groomers`

Optional Bearer:

- `buyerAccessToken`

Find your groomer and save:

- `groomerProfileId`

Important:

- booking create needs `groomerId = groomerProfileId`
- it does not take the groomer user id

### 6.2 Get groomer profile detail

`GET /buyer/groomers/{groomerProfileId}`

Optional Bearer:

- `buyerAccessToken`

Save from response:

- `serviceId`
- `slotId`
- optional `addonId`

### 6.3 Create buyer pet

`POST /pets`

Bearer:

- `buyerAccessToken`

Use `multipart/form-data`.

Example:

```text
name = Milo
breed = Golden Retriever
age = 3
temperament = Friendly
petType = DOG
petSize = LARGE
```

Save:

- `petId`

## 7. Booking Create And Payment

### 7.1 Create booking

`POST /bookings`

Bearer:

- `buyerAccessToken`

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

Save:

- `bookingId`

Expected:

- booking is created
- payment record is created with pending status

### 7.2 Create payment intent

`POST /payments/bookings/{bookingId}/payment-intent`

Bearer:

- `buyerAccessToken`

Save:

- `paymentIntentId`
- `clientSecret`

### 7.3 Confirm Stripe test payment

Backend alone does not collect card details.

For manual API testing, confirm the Stripe PaymentIntent directly in Stripe test mode.

Example:

```bash
curl https://api.stripe.com/v1/payment_intents/PI_ID/confirm \
  -u "$STRIPE_SECRET_KEY:" \
  -d payment_method=pm_card_visa
```

Replace:

- `PI_ID` with the returned `paymentIntentId`

### 7.4 Sync payment status in backend

`POST /payments/bookings/{bookingId}/confirm`

Bearer:

- `buyerAccessToken`

Expected:

- payment becomes `SUCCEEDED`
- booking stays/returns in payable booking flow
- groomer gets a new booking request notification

## 8. Groomer Booking Fulfillment Flow

### 8.1 Groomer sees booking

`GET /bookings`

Bearer:

- `groomerAccessToken`

Find your `bookingId`.

### 8.2 Accept booking

`PATCH /bookings/{bookingId}/accept`

Bearer:

- `groomerAccessToken`

Expected:

- booking status becomes `ACCEPTED`

### 8.3 Mark in progress

`PATCH /bookings/{bookingId}/in-progress`

Bearer:

- `groomerAccessToken`

Use `multipart/form-data`.

Optional file:

- `beforeImage`

Expected:

- booking status becomes `IN_PROGRESS`

### 8.4 Request completion

`PATCH /bookings/{bookingId}/request-completion`

Bearer:

- `groomerAccessToken`

Use `multipart/form-data`.

Optional fields:

- `note`
- `afterImage`

Expected:

- booking status becomes `COMPLETION_REQUESTED`

## 9. Buyer Or Admin Completion Approval

### 9.1 Buyer approves completion

`PATCH /bookings/{bookingId}/approve-completion`

Bearer:

- `buyerAccessToken`

This route also works for admin.

Expected:

- booking status becomes `COMPLETED`
- latest successful payment becomes `COMPLETED`
- payout release is triggered automatically

## 10. Check Payout Result

### 10.1 Groomer payout summary

`GET /payouts/summary`

Bearer:

- `groomerAccessToken`

Check:

- `totalEarned`
- `paidOutTotal`
- `pendingTransferTotal`
- `failedTransferTotal`
- `recentEarnings`
- `connectStatus`

Save from recent earnings if available:

- `payoutId`

### 10.2 Single payout detail

`GET /payouts/transactions/{payoutId}`

Bearer:

- `groomerAccessToken`

or

- `adminAccessToken`

## 11. Optional Review Flow

After booking completion, buyer can review groomer.

`POST /reviews`

Bearer:

- `buyerAccessToken`

```json
{
  "bookingId": "BOOKING_ID",
  "targetType": "GROOMER",
  "rating": 5,
  "feedback": "Great service"
}
```

## 12. Useful Validation Routes

These help verify the flow state at each step:

- `GET /users/me`
- `GET /bookings`
- `GET /bookings/{bookingId}`
- `GET /buyer/groomers/{groomerProfileId}`
- `GET /groomer/dashboard`
- `GET /groomer/earnings`
- `GET /notifications`

## 13. Common Failure Reasons

### Buyer login says email verification required

- buyer OTP was not verified yet

### Groomer login says approval required

- admin has not approved the groomer yet

### Booking create says groomer is not available

Check all of these:

- groomer approved
- groomer `availableForBookings = true`
- Stripe Connect `payoutSetupComplete = true`
- selected slot is not booked

### Payment confirm says payment is not completed yet

- Stripe PaymentIntent was not actually confirmed in Stripe yet

### Payout setup stays incomplete after Stripe onboarding

- `account.updated` webhook is not reaching backend

### Multipart routes fail

- use `form-data`, not raw JSON
- image fields must be attached as files

## 14. Recommended Local Test Order

Use this exact order:

1. Register buyer
2. Verify buyer OTP
3. Login buyer
4. Register groomer
5. Login admin
6. Approve groomer
7. Login groomer
8. Run Stripe Connect onboarding
9. Confirm payout setup is complete
10. Enable groomer booking availability
11. Ensure category exists
12. Create service
13. Create addon if needed
14. Create availability slot
15. Create pet
16. Create booking
17. Create Stripe payment intent
18. Confirm payment in Stripe test mode
19. Confirm payment in backend
20. Groomer accepts booking
21. Groomer marks in progress
22. Groomer requests completion
23. Buyer or admin approves completion
24. Check payout summary and transaction detail
