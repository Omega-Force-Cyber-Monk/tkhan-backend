# Flutter Notification Integration Flow

This document explains how the Flutter app should integrate backend notifications.

Base URL examples:

- Local: `http://localhost:3000/api/v1`
- Production: `https://tkhan-backend-x3ct.onrender.com/api/v1`

Socket namespace:

- Local: `http://localhost:3000/notifications`
- Production: `https://tkhan-backend-x3ct.onrender.com/notifications`

## 1. Login First

All notification APIs and socket connection require the normal auth access token.

`POST /auth/login`

Save:

- `accessToken`
- `user.id`
- `user.role`

Use this token in:

- API header: `Authorization: Bearer ACCESS_TOKEN`
- Socket auth: `auth: { token: ACCESS_TOKEN }`

## 2. Register FCM Token

After login, get the device FCM token from Firebase Messaging and send it to backend.

`POST /notifications/push-tokens`

Headers:

```http
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Body:

```json
{
  "token": "FCM_DEVICE_TOKEN",
  "platform": "android"
}
```

Allowed platform values:

- `android`
- `ios`
- `web`

When token refreshes, call the same API again. Backend uses upsert, so duplicate token is safe.

## 3. Remove FCM Token On Logout

Before logout, unregister the current device token.

`DELETE /notifications/push-tokens`

Headers:

```http
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Body:

```json
{
  "token": "FCM_DEVICE_TOKEN",
  "platform": "android"
}
```

## 4. Connect Socket For Realtime Notification

Use Socket.IO client and connect to namespace `/notifications`.

Example concept:

```dart
final socket = io(
  'https://tkhan-backend-x3ct.onrender.com/notifications',
  OptionBuilder()
    .setTransports(['websocket'])
    .setAuth({'token': accessToken})
    .enableAutoConnect()
    .build(),
);
```

Listen events:

```dart
socket.on('notifications.ready', (data) {
  // connected successfully
});

socket.on('notification.created', (notification) {
  // add notification to local list
  // show in-app banner if needed
  // navigate using notification.data.targetScreen on tap
});

socket.on('notifications.error', (data) {
  // token missing/invalid
});
```

Backend also emits booking realtime status update:

```dart
socket.on('booking.updated', (data) {
  // update booking status in UI
});
```

## 5. Notification List

Use this for notification screen.

`GET /notifications?page=1&limit=20`

Headers:

```http
Authorization: Bearer ACCESS_TOKEN
```

Response item shape:

```json
{
  "id": "notification-id",
  "userId": "user-id",
  "type": "BOOKING_REMINDER",
  "title": "Tomorrow's Grooming Appointment",
  "body": "Just a reminder...",
  "data": {
    "targetScreen": "booking_details",
    "bookingId": "booking-id"
  },
  "readAt": null,
  "createdAt": "2026-07-21T10:00:00.000Z"
}
```

## 6. Mark Read

Single notification read:

`PATCH /notifications/{notificationId}/read`

All read:

`PATCH /notifications/read-all`

Headers:

```http
Authorization: Bearer ACCESS_TOKEN
```

## 7. Navigation From Notification

Always read `notification.data.targetScreen`.

Supported `targetScreen` values:

- `booking_details`
- `earnings`
- `reviews`
- `chat`
- `ticket_details`
- `groomer_approval`
- `availability`
- `buyer_groomers`
- `groomer_details`

Suggested routing:

```text
booking_details -> open booking detail using data.bookingId
earnings -> open groomer earnings/payout page
reviews -> open reviews screen, optionally use data.bookingId
chat -> open conversation using data.conversationId
ticket_details -> open support ticket using data.ticketId
groomer_approval -> admin groomer approval/details page
availability -> groomer availability page
buyer_groomers -> buyer groomer listing/search page
groomer_details -> buyer groomer profile using data.groomerProfileId
```

## 8. Important Payload Keys

Common data keys:

- `targetScreen`
- `bookingId`
- `paymentId`
- `payoutId`
- `reviewId`
- `conversationId`
- `ticketId`
- `groomerId`
- `groomerProfileId`
- `availabilitySlotId`
- `reminderKind`
- `alertKind`
- `appointmentStartTime`
- `reason`

Do not hardcode title/body logic in Flutter. Backend sends final `title` and `body`.

## 9. Notification Types

Main backend notification types:

- `BOOKING_CREATED`
- `BOOKING_ACCEPTED`
- `BOOKING_REJECTED`
- `COMPLETION_REQUESTED`
- `BOOKING_COMPLETED`
- `PAYMENT_SUCCESS`
- `PAYMENT_FAILED`
- `PAYMENT_REFUND`
- `PAYOUT_FAILED`
- `REVIEW_CREATED`
- `REVIEW_REQUEST`
- `BOOKING_REMINDER`
- `AVAILABILITY_ALERT`
- `GROWTH_ALERT`
- `NEW_MESSAGE`
- `TICKET_REPLY`
- `ADMIN_ACTION`

Flutter should not depend only on `type` for navigation. Use `data.targetScreen`.

## 10. Events That Create Notifications

Booking/payment:

- payment success
- payment failed
- refund issued
- new paid booking request
- booking accepted
- booking rejected
- booking in progress
- completion requested
- booking completed
- 24-hour booking reminder
- 1-hour booking reminder

Payout/Stripe:

- payout sent
- payout failed
- Stripe payout setup complete

Review:

- review request after booking completion
- review reminder if buyer has not reviewed
- review created

Chat/support:

- new chat message
- new support ticket
- support ticket reply

Groomer/admin:

- new groomer registration
- no availability
- availability running low
- calendar expiring

Buyer growth:

- inactive buyer reminder
- repeat customer reminder
- favorite groomer opened availability
- last-minute availability

## 11. Manual App Test Checklist

1. Login user and save `accessToken`.
2. Register FCM token with `POST /notifications/push-tokens`.
3. Connect socket to `/notifications` using same token.
4. Trigger an event, for example booking accepted or chat message.
5. Confirm socket receives `notification.created`.
6. Confirm `GET /notifications` shows the same notification.
7. Tap notification and navigate using `data.targetScreen`.
8. Put app in background and trigger another event.
9. Confirm mobile push is received.
10. Logout and call `DELETE /notifications/push-tokens`.

## 12. Notes For Flutter

- Socket auth token must be refreshed after login/token refresh.
- If socket disconnects, reconnect with latest access token.
- FCM token can change, so register again when Firebase gives a new token.
- Backend push data values are string-normalized for Firebase, so parse JSON values if needed.
- Scheduled notifications may not appear instantly; backend checks them by configured intervals.
