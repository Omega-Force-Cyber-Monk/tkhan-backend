const omitKeys = <T extends Record<string, any>>(
  object: T | null | undefined,
  keys: string[],
) => {
  if (!object) return object;
  const copy = { ...object };
  keys.forEach((key) => delete copy[key]);
  return copy;
};

export const sanitizePublicUser = (user: any) =>
  omitKeys(user, [
    'email',
    'phone',
    'password',
    'refreshTokenHash',
    'emailVerificationToken',
    'emailVerificationExpiresAt',
    'resetPasswordToken',
    'resetPasswordExpiresAt',
    'streetAddress',
    'unitSuite',
    'postalCode',
    'sharePhoneWithBookingPartners',
  ]);

export const sanitizePublicGroomer = (groomer: any) => {
  const safe = omitKeys(groomer, [
    'idNumber',
    'idFrontImage',
    'idBackImage',
    'selfieWithId',
    'stripeConnectedAccountId',
    'stripeOnboardingStartedAt',
    'stripeOnboardingCompletedAt',
    'stripeOnboardingCompleted',
    'stripeTransfersEnabled',
    'stripePayoutsEnabled',
    'stripeConnectCountry',
    'stripeConnectEmail',
    'approvedById',
    'rejectionReason',
  ]);
  if (!safe) return safe;
  return {
    ...safe,
    user: sanitizePublicUser(safe.user),
  };
};
