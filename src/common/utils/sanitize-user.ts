export function sanitizeUser<T extends Record<string, any>>(
  user: T | null | undefined,
) {
  if (!user) return user;
  const { password, refreshTokenHash, passwordResetTokenHash, ...safe } = user;
  return safe;
}
