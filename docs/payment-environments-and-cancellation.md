# Payment environments, $0 bookings and cancellation/refund policy

## 1. Test build vs live app (Stripe sandbox vs production)

Run **two backend deployments**, each with its own database and Stripe keys:

| | Staging backend (TEST app build) | Production backend (LIVE app) |
|---|---|---|
| `STRIPE_MODE` | `test` | `live` |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | from the **test-mode** webhook endpoint | from the **live** webhook endpoint |
| `DATABASE_URL` | staging DB | production DB |

* The server refuses to boot if `STRIPE_MODE` and the key prefixes disagree.
* `GET /api/v1/payments/config` shows which mode a backend is in.
* The payment-intent response now includes `publishableKey` and `livemode`;
  the app uses that key, so the app can never use a key from a different mode
  than its backend.

Flutter builds:

```bash
# Test / TestFlight / internal testing  (fill API_BASE_URL in env/staging.json first)
flutter build ipa       --dart-define-from-file=env/staging.json
flutter build appbundle --dart-define-from-file=env/staging.json
# Store release
flutter build ipa       --dart-define-from-file=env/production.json
```

A staging build crashes on start if it points at the production URL, and it
refuses to open the payment sheet if the backend reports `livemode: true`.
Test cards: `4242 4242 4242 4242`, any future date, any CVC.

## 2. $0 bookings

* Total = $0 -> `POST /payments/bookings/:id/payment-intent` confirms the booking
  without Stripe and returns `requiresPayment: false`.
* 0 < total < $0.50 -> rejected with a clear message (Stripe minimum for CAD).
* Payout for a $0 booking is marked transferred without calling Stripe.

## 3. Cancellation & refund policy

Endpoints:

* `GET  /bookings/cancellation-policy` (public) - current numbers
* `GET  /bookings/:id/cancellation-preview` - popup content (title, message,
  refund %, late fee, no-show) for the current user
* `PATCH /bookings/:id/cancel` - buyer or groomer cancels (`{ reason? }`)
* `POST /admin/bookings/:id/cancel` - `{ refundType: POLICY|FULL|PARTIAL|NONE, refundAmount?, reason, recordGroomerNoShow? }`
* `POST /admin/bookings/:id/refund` - `{ refundType: FULL|PARTIAL, refundAmount?, reason }`
* `GET  /admin/groomer-no-shows`, `PATCH /admin/groomers/:groomerProfileId/lift-suspension`

Rules (all overridable in env, see `.env.example`):

* Buyer: 24h+ -> 100%; 3-24h -> 100% (client confirmed); < 3h -> 70% (30% late fee, kept by the platform owner);
  not yet accepted by groomer -> 100%; after start -> must contact support.
* Groomer (accepted bookings): customer always 100%; < 24h -> Groomer No-Show.
* No-shows in a 90-day window: 1 -> warning, 2 -> 14-day suspension, 3 -> account blocked.
* Hours are measured in `BUSINESS_TIME_ZONE` because slots are stored as wall-clock times.

Booking creation accepts `acceptedTerms` + `termsVersion`; set
`REQUIRE_BOOKING_TERMS_ACCEPTANCE=true` once all store builds send it.

Run `npm run prisma:deploy` to apply migration
`20261124090000_booking_cancellation_refund_policy`.
