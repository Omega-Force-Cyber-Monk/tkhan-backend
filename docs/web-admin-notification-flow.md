# Web Admin Notification Integration

This document is for the web admin panel developer.

## Base URLs

Local API:

```text
http://localhost:3000/api/v1
```

Production API:

```text
https://tkhan-backend-x3ct.onrender.com/api/v1
```

Socket namespace:

```text
/notifications
```

Production socket URL:

```text
https://tkhan-backend-x3ct.onrender.com/notifications
```

## Auth

Login as admin first.

`POST /auth/login`

Use returned `accessToken` for APIs and socket.

API header:

```http
Authorization: Bearer ADMIN_ACCESS_TOKEN
```

## Socket Setup

Use Socket.IO client.

```js
import { io } from "socket.io-client";

const socket = io("https://tkhan-backend-x3ct.onrender.com/notifications", {
  transports: ["websocket"],
  auth: {
    token: adminAccessToken,
  },
});

socket.on("notifications.ready", (data) => {
  console.log("Notification socket ready", data);
});

socket.on("notification.created", (notification) => {
  console.log("New admin notification", notification);
  // Add to notification dropdown/list
  // Increase unread count
});

socket.on("booking.updated", (data) => {
  console.log("Booking status updated", data);
  // Update booking UI if currently open
});

socket.on("notifications.error", (error) => {
  console.log("Notification socket error", error);
});
```

Token can also be sent as:

```js
auth: { token: `Bearer ${adminAccessToken}` }
```

## Notification APIs

### Get Admin Notifications

`GET /notifications?page=1&limit=20`

Response item:

```json
{
  "id": "notification-id",
  "userId": "admin-user-id",
  "type": "ADMIN_ACTION",
  "title": "New Groomer Registration",
  "body": "A new groomer has registered and needs review.",
  "data": {
    "targetScreen": "groomer_approval",
    "groomerId": "groomer-user-id"
  },
  "readAt": null,
  "createdAt": "2026-07-23T10:00:00.000Z"
}
```

### Mark One Notification Read

`PATCH /notifications/{notificationId}/read`

### Mark All Read

`PATCH /notifications/read-all`

## Admin Notification Events

Admin can receive notifications for:

- New groomer registration
- New paid booking
- Booking rejected
- Completion requested
- Booking completed
- Payment failed / payment issue
- Refund issued
- Payout sent
- Payout failed
- New support ticket
- User reply on support ticket

## Navigation By targetScreen

Always use:

```js
notification.data.targetScreen
```

Do not route only by notification `type`.

Recommended admin routing:

```text
groomer_approval -> admin groomer approval/details page
booking_details -> admin booking detail page
ticket_details -> admin support ticket detail page
earnings -> payout/earnings page if admin supports it
```

## Important Payload Keys

Common admin payload keys:

```text
targetScreen
bookingId
buyerId
groomerId
groomerUserId
payoutId
paymentId
refundId
ticketId
requesterId
relatedBookingId
approvedByRole
approvedById
reason
stripeTransferId
```

Example routing:

```js
function handleNotificationClick(notification) {
  const data = notification.data || {};

  if (data.targetScreen === "groomer_approval") {
    navigate(`/admin/groomers/${data.groomerId}`);
    return;
  }

  if (data.targetScreen === "booking_details") {
    navigate(`/admin/bookings/${data.bookingId}`);
    return;
  }

  if (data.targetScreen === "ticket_details") {
    navigate(`/admin/tickets/${data.ticketId}`);
    return;
  }

  navigate("/admin/notifications");
}
```

## Support Ticket Admin Flow

List tickets:

`GET /tickets`

Get unread ticket count:

`GET /tickets/unread-count`

Ticket detail:

`GET /tickets/{ticketId}`

Reply to ticket:

`POST /tickets/{ticketId}/replies`

Body:

```json
{
  "message": "Thanks, we are checking this."
}
```

Resolve ticket:

`PATCH /tickets/{ticketId}/resolve`

Notification behavior:

- Buyer/groomer creates ticket -> admin receives notification.
- Buyer/groomer replies -> admin receives notification.
- Admin replies -> buyer/groomer receives notification.
- Sender does not receive self-notification.

## Booking Realtime Status

Admin can also listen to:

```js
socket.on("booking.updated", (data) => {});
```

Payload:

```json
{
  "bookingId": "booking-id",
  "status": "COMPLETED",
  "updatedAt": "2026-07-23T10:00:00.000Z",
  "buyerId": "buyer-user-id",
  "groomerId": "groomer-user-id"
}
```

Use this to update booking status in admin UI without refresh.

## Web Push Optional

If admin panel wants browser push notification, register web FCM token.

`POST /notifications/push-tokens`

Body:

```json
{
  "token": "WEB_FCM_TOKEN",
  "platform": "web"
}
```

On logout:

`DELETE /notifications/push-tokens`

Body:

```json
{
  "token": "WEB_FCM_TOKEN",
  "platform": "web"
}
```

If web push is not needed, socket + `GET /notifications` is enough for admin panel.

## Admin Test Checklist

1. Admin login and save token.
2. Connect socket to `/notifications`.
3. Confirm `notifications.ready` event.
4. Trigger a user ticket reply or new groomer registration.
5. Confirm `notification.created` event arrives.
6. Confirm `GET /notifications` shows same notification.
7. Click notification and route using `data.targetScreen`.
8. Mark notification read.
9. Confirm unread UI updates.
