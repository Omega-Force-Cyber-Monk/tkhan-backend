export type NotificationTemplateKey =
  | 'BUYER_BOOKING_REQUEST_SENT'
  | 'BUYER_BOOKING_CONFIRMED'
  | 'BUYER_BOOKING_DECLINED'
  | 'BUYER_BOOKING_CANCELLED'
  | 'BUYER_BOOKING_RESCHEDULED'
  | 'BUYER_REMINDER_24_HOURS'
  | 'BUYER_REMINDER_1_HOUR'
  | 'BUYER_GROOMER_EN_ROUTE'
  | 'BUYER_APPOINTMENT_STARTED'
  | 'BUYER_COMPLETION_REQUESTED'
  | 'BUYER_APPOINTMENT_COMPLETED'
  | 'BUYER_REVIEW_REQUEST'
  | 'BUYER_REVIEW_REMINDER'
  | 'BUYER_NEW_REVIEW'
  | 'BUYER_REBOOKING_REMINDER'
  | 'BUYER_FAVORITE_GROOMER_AVAILABLE'
  | 'BUYER_SEASONAL_REMINDER'
  | 'BUYER_PAYMENT_SUCCESS'
  | 'BUYER_PAYMENT_FAILED'
  | 'BUYER_REFUND_ISSUED'
  | 'BUYER_NEW_MESSAGE'
  | 'GROOMER_NEW_BOOKING_REQUEST'
  | 'GROOMER_BOOKING_CONFIRMED'
  | 'GROOMER_BOOKING_CANCELLED'
  | 'GROOMER_BOOKING_RESCHEDULED'
  | 'GROOMER_BOOKING_COMPLETED'
  | 'GROOMER_REMINDER_24_HOURS'
  | 'GROOMER_REMINDER_1_HOUR'
  | 'GROOMER_START_APPOINTMENT'
  | 'GROOMER_COMPLETE_APPOINTMENT'
  | 'GROOMER_NEW_REVIEW'
  | 'GROOMER_WEEKLY_EARNINGS'
  | 'GROOMER_PAYOUT_INITIATED'
  | 'GROOMER_PAYOUT_SENT'
  | 'GROOMER_PAYOUT_FAILED'
  | 'GROOMER_NO_AVAILABILITY'
  | 'GROOMER_AVAILABILITY_RUNNING_LOW'
  | 'GROOMER_CALENDAR_EXPIRING'
  | 'GROOMER_HIGH_DEMAND'
  | 'GROOMER_NEW_MESSAGE'
  | 'ADMIN_NEW_GROOMER'
  | 'ADMIN_VERIFICATION_REQUIRED'
  | 'ADMIN_NEW_SUPPORT_TICKET'
  | 'ADMIN_BOOKING_REPORTED'
  | 'ADMIN_NEW_PAID_BOOKING'
  | 'ADMIN_BOOKING_REJECTED'
  | 'ADMIN_COMPLETION_REQUESTED'
  | 'ADMIN_BOOKING_COMPLETED'
  | 'ADMIN_REFUND_ISSUED'
  | 'ADMIN_PAYOUT_SENT'
  | 'ADMIN_PAYOUT_FAILED'
  | 'ADMIN_PAYMENT_ISSUE'
  | 'SUPPORT_TICKET_REPLY'
  | 'GROOMER_STRIPE_SETUP_COMPLETE'
  | 'GROWTH_INACTIVE_USER'
  | 'GROWTH_FAVORITE_GROOMER_OPENED_AVAILABILITY'
  | 'GROWTH_NEARBY_GROOMER_JOINED'
  | 'GROWTH_LAST_MINUTE_AVAILABILITY'
  | 'GROWTH_REPEAT_CUSTOMER_REMINDER';

export type NotificationTemplateVariables = Record<
  string,
  string | number | boolean | Date | null | undefined
>;

export type RenderedNotificationTemplate = {
  title: string;
  body: string;
};

type NotificationTemplate = RenderedNotificationTemplate;

export const NOTIFICATION_TEMPLATES: Record<
  NotificationTemplateKey,
  NotificationTemplate
> = {
  BUYER_BOOKING_REQUEST_SENT: {
    title: 'Booking Request Sent',
    body: "We've sent your request to {{GroomerName}}. We'll let you know as soon as they respond.",
  },
  BUYER_BOOKING_CONFIRMED: {
    title: "You're All Set!",
    body: '{{GroomerName}} has confirmed your appointment for {{Date}} at {{Time}}.',
  },
  BUYER_BOOKING_DECLINED: {
    title: 'Booking Update',
    body: "{{GroomerName}} couldn't accept your request this time. Let's help you find another great groomer nearby.",
  },
  BUYER_BOOKING_CANCELLED: {
    title: 'Appointment Cancelled',
    body: 'Your appointment has been cancelled. You can book another time whenever you are ready.',
  },
  BUYER_BOOKING_RESCHEDULED: {
    title: 'Appointment Updated',
    body: 'Your appointment has been moved to {{Date}} at {{Time}}.',
  },
  BUYER_REMINDER_24_HOURS: {
    title: "Tomorrow's Grooming Appointment",
    body: 'Just a reminder: {{PetName}} is booked with {{GroomerName}} tomorrow at {{Time}}.',
  },
  BUYER_REMINDER_1_HOUR: {
    title: 'Almost Time!',
    body: "Your appointment starts in one hour. We can't wait to see {{PetName}}.",
  },
  BUYER_GROOMER_EN_ROUTE: {
    title: 'On the Way',
    body: '{{GroomerName}} is on the way and will be with you soon.',
  },
  BUYER_APPOINTMENT_STARTED: {
    title: 'Grooming Has Begun',
    body: "{{PetName}}'s grooming appointment is now underway.",
  },
  BUYER_COMPLETION_REQUESTED: {
    title: 'Review Your Appointment',
    body: 'Please approve completion if the service is done.',
  },
  BUYER_APPOINTMENT_COMPLETED: {
    title: 'Looking Fresh!',
    body: "{{PetName}}'s grooming is complete. We hope they love their fresh new look.",
  },
  BUYER_REVIEW_REQUEST: {
    title: 'How Did We Do?',
    body: 'Share your experience with {{GroomerName}}. Your review helps other pet parents.',
  },
  BUYER_REVIEW_REMINDER: {
    title: "We'd Love Your Feedback",
    body: "Haven't left a review yet? It only takes a minute.",
  },
  BUYER_NEW_REVIEW: {
    title: 'New Review Received',
    body: 'You received a new review from {{GroomerName}}.',
  },
  BUYER_REBOOKING_REMINDER: {
    title: 'Time for Another Groom?',
    body: "It's been a little while since {{PetName}}'s last visit. Ready to book again?",
  },
  BUYER_FAVORITE_GROOMER_AVAILABLE: {
    title: 'Good News!',
    body: '{{GroomerName}} has opened new appointment times.',
  },
  BUYER_SEASONAL_REMINDER: {
    title: 'Shedding Season Is Here',
    body: 'Keep {{PetName}} looking and feeling their best with a fresh groom.',
  },
  BUYER_PAYMENT_SUCCESS: {
    title: 'Payment Received',
    body: "You're all set! Your appointment is confirmed.",
  },
  BUYER_PAYMENT_FAILED: {
    title: 'Payment Needs Review',
    body: "We couldn't process your payment. Please update your payment method to confirm your booking.",
  },
  BUYER_REFUND_ISSUED: {
    title: 'Refund Processed',
    body: 'Your refund is on its way and should appear shortly.',
  },
  BUYER_NEW_MESSAGE: {
    title: 'New Message',
    body: 'You have a new message from {{GroomerName}}.',
  },
  GROOMER_NEW_BOOKING_REQUEST: {
    title: 'New Booking Request',
    body: '{{CustomerName}} would like to book an appointment with you.',
  },
  GROOMER_BOOKING_CONFIRMED: {
    title: 'Appointment Confirmed',
    body: "You're booked for {{Date}} at {{Time}}.",
  },
  GROOMER_BOOKING_CANCELLED: {
    title: 'Appointment Cancelled',
    body: '{{CustomerName}} has cancelled their appointment.',
  },
  GROOMER_BOOKING_RESCHEDULED: {
    title: 'Schedule Updated',
    body: 'One of your appointments has been rescheduled.',
  },
  GROOMER_BOOKING_COMPLETED: {
    title: 'Booking Completed',
    body: 'This booking has been marked complete.',
  },
  GROOMER_REMINDER_24_HOURS: {
    title: "Tomorrow's Appointment",
    body: 'You have an appointment with {{PetName}} tomorrow at {{Time}}.',
  },
  GROOMER_REMINDER_1_HOUR: {
    title: "You're Up Next!",
    body: 'Your appointment starts in one hour.',
  },
  GROOMER_START_APPOINTMENT: {
    title: 'Ready to Begin?',
    body: 'Make sure to mark the appointment as started.',
  },
  GROOMER_COMPLETE_APPOINTMENT: {
    title: 'Almost Done!',
    body: "Don't forget to mark the appointment as complete when you are finished.",
  },
  GROOMER_NEW_REVIEW: {
    title: 'New Review Received',
    body: 'You received a new review from {{CustomerName}}.',
  },
  GROOMER_WEEKLY_EARNINGS: {
    title: "This Week's Earnings",
    body: 'Nice work! You earned ${{Amount}} this week.',
  },
  GROOMER_PAYOUT_INITIATED: {
    title: 'Payout on the Way',
    body: 'Your payout is being processed.',
  },
  GROOMER_PAYOUT_SENT: {
    title: "You're Paid!",
    body: 'Your payout has been sent to your bank account.',
  },
  GROOMER_PAYOUT_FAILED: {
    title: 'Action Needed',
    body: "We couldn't process your payout. Please check your banking details.",
  },
  GROOMER_NO_AVAILABILITY: {
    title: 'Open Your Calendar',
    body: 'Add your latest availability so pet owners can book with you.',
  },
  GROOMER_AVAILABILITY_RUNNING_LOW: {
    title: "You're Almost Fully Booked!",
    body: 'Add more availability to keep the bookings coming.',
  },
  GROOMER_CALENDAR_EXPIRING: {
    title: 'Update Your Schedule',
    body: 'Your calendar is running out of available dates. Add more to stay bookable.',
  },
  GROOMER_HIGH_DEMAND: {
    title: "You're in Demand!",
    body: 'Pet owners in your area are looking for groomers. Add more availability to accept new bookings.',
  },
  GROOMER_NEW_MESSAGE: {
    title: 'New Message',
    body: 'You have a new message from {{CustomerName}}.',
  },
  ADMIN_NEW_GROOMER: {
    title: 'New Groomer Waiting for Review',
    body: '{{GroomerName}} submitted a groomer registration for approval.',
  },
  ADMIN_VERIFICATION_REQUIRED: {
    title: 'Verification Required',
    body: 'A groomer account requires verification review.',
  },
  ADMIN_NEW_SUPPORT_TICKET: {
    title: 'New Support Request',
    body: '{{CustomerName}} submitted a new support request.',
  },
  ADMIN_BOOKING_REPORTED: {
    title: 'Booking Reported',
    body: 'A booking was reported and needs review.',
  },
  ADMIN_NEW_PAID_BOOKING: {
    title: 'New Paid Booking',
    body: '{{CustomerName}} completed payment for a new booking request.',
  },
  ADMIN_BOOKING_REJECTED: {
    title: 'Booking Rejected',
    body: 'A groomer rejected a booking.',
  },
  ADMIN_COMPLETION_REQUESTED: {
    title: 'Completion Requested',
    body: 'A groomer requested booking completion approval.',
  },
  ADMIN_BOOKING_COMPLETED: {
    title: 'Booking Completed',
    body: 'A booking completion was approved.',
  },
  ADMIN_REFUND_ISSUED: {
    title: 'Refund Processed',
    body: 'A refund was issued for a booking.',
  },
  ADMIN_PAYOUT_SENT: {
    title: 'Automatic Payout Sent',
    body: 'A completed booking earning was transferred to the groomer Stripe account.',
  },
  ADMIN_PAYOUT_FAILED: {
    title: 'Automatic Payout Failed',
    body: 'A booking payout could not be transferred to Stripe Connect.',
  },
  ADMIN_PAYMENT_ISSUE: {
    title: 'Payment Requires Attention',
    body: 'A payment issue needs admin review.',
  },
  SUPPORT_TICKET_REPLY: {
    title: 'Ticket Reply',
    body: '{{Message}}',
  },
  GROOMER_STRIPE_SETUP_COMPLETE: {
    title: 'Payout Setup Complete',
    body: 'Your Stripe payout setup is complete. You can now receive automated payouts.',
  },
  GROWTH_INACTIVE_USER: {
    title: 'We Miss You',
    body: 'Book your next grooming appointment today.',
  },
  GROWTH_FAVORITE_GROOMER_OPENED_AVAILABILITY: {
    title: 'Favorite Groomer Available',
    body: '{{GroomerName}} has new appointment slots available this week.',
  },
  GROWTH_NEARBY_GROOMER_JOINED: {
    title: 'New Groomer Nearby',
    body: 'A new groomer is now serving your area.',
  },
  GROWTH_LAST_MINUTE_AVAILABILITY: {
    title: 'Last-Minute Availability',
    body: 'An appointment just opened up tomorrow near you.',
  },
  GROWTH_REPEAT_CUSTOMER_REMINDER: {
    title: 'Time for a Fresh Groom',
    body: "It's been {{Duration}} since {{PetName}}'s last groom.",
  },
};

export function renderNotificationTemplate(
  key: NotificationTemplateKey,
  variables: NotificationTemplateVariables = {},
): RenderedNotificationTemplate {
  const template = NOTIFICATION_TEMPLATES[key];
  return {
    title: replaceTemplateVariables(template.title, variables),
    body: replaceTemplateVariables(template.body, variables),
  };
}

function replaceTemplateVariables(
  value: string,
  variables: NotificationTemplateVariables,
) {
  return value.replace(/\{\{(\w+)\}\}/g, (match, variableName: string) => {
    const variableValue = variables[variableName];
    if (variableValue === null || variableValue === undefined) return match;
    if (variableValue instanceof Date) return variableValue.toISOString();
    return String(variableValue);
  });
}
