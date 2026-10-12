# Final Requirements

This document lists the client final requirements and handover items collected on 2026-10-11.

## 1. Test Data Cleanup

- Delete all test data before final handover.
- Test groomer accounts must be removed.
- Confirm production data only contains real users/signups.
- Verify that demo/test bookings, payments, services, pets, and notifications are not visible in the live environment.

Status: Pending final cleanup and confirmation.

## 2. Stripe Production Dashboard

- Confirm whether the Stripe production dashboard has been connected.
- Confirm that the backend is using the correct production Stripe account credentials.
- Share where new Stripe Connect groomer signups can be tracked.
- Stripe Connect signups should be tracked from the platform Stripe dashboard under connected accounts.
- Confirm webhook configuration is active for production.

Required Stripe webhook destination:

```text
https://api.karoot.ca/api/v1/payments/stripe/webhook
```

Required webhook events:

```text
payment_intent.succeeded
payment_intent.payment_failed
account.updated
```

Status: Needs production Stripe confirmation.

## 3. Email / SMTP Configuration

- Confirm what SMTP credentials are needed.
- Confirm where the client can access or generate those SMTP credentials.
- SMTP is required for signup OTP, forgot password, and email notifications.

Required SMTP values:

```text
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=
```

Notes:

- `SMTP_HOST` and `SMTP_PORT` come from the email provider's SMTP/outgoing mail settings.
- `SMTP_USER` is usually the email address or SMTP username.
- `SMTP_PASS` should be an SMTP password or app password, not usually the normal mailbox password.
- `SMTP_FROM_EMAIL` should be a verified sender email, for example `support@karoot.ca`.

Status: Waiting for client SMTP details.

## 4. Admin Dashboard Signup Visibility

- The app is already live on Google Play Store.
- Users have signed up from the live app.
- These live signups must be visible in the admin dashboard.
- Admin dashboard should show relevant buyer/groomer signup data from the production database.
- Share admin dashboard access/details after confirming the live data is visible.

Status: Needs admin dashboard verification.

## 5. Codebase Access

- Provide codebase access as the project is nearing final handover.
- Confirm which repository should be treated as the source of truth.
- Share repository access details with the client/team.
- Confirm active branch and deployment branch.

Status: Needs access/handover confirmation.

## 6. Seller Profile Approval Email

- Add an email notification when admin approves a seller/groomer profile.
- The email should tell the seller that their profile has been approved.
- The email should tell the seller they can continue profile setup.
- This should be sent after admin approval succeeds.

Status: Needs implementation if not already present.

## 7. Apple Submission And Email Branding

- Apple submission has been approved.
- Submit the latest app build now.
- Latest build must include the updated email templates.
- Emails should be sent by `Karoot`, not `Tkhan`.
- Confirm `SMTP_FROM_NAME` is set to `Karoot` in the production environment.

Status: Needs latest build submission and production env confirmation.

## 8. Final Validation Checklist

- Confirm live signup flow works.
- Confirm OTP email delivery works.
- Confirm forgot password email delivery works.
- Confirm email sender name shows as `Karoot`.
- Confirm updated email templates are included.
- Confirm admin approval flow works.
- Confirm seller approval email is sent.
- Confirm Stripe Connect onboarding works in production.
- Confirm payment flow works from buyer payment to groomer payout.
- Confirm admin dashboard shows live signups.
- Confirm test data cleanup is complete.
- Confirm codebase access is shared.
- Confirm latest Apple-approved build is submitted.

Status: Pending final QA.
