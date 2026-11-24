import type { ConfigService } from '@nestjs/config';

export type StripeMode = 'test' | 'live';

export interface StripeRuntimeConfig {
  secretKey: string;
  publishableKey: string | null;
  mode: StripeMode;
}

/** Smallest card charge Stripe accepts for CAD (in cents). */
export const MIN_CARD_CHARGE_CENTS = 50;

const keyMode = (key: string): StripeMode =>
  /^(sk|rk|pk)_live_/.test(key) ? 'live' : 'test';

/**
 * Resolves the Stripe keys for this deployment and refuses to boot when the
 * keys do not match the declared environment. This is what keeps the test
 * build (staging backend + sandbox keys) and the live app (production backend
 * + live keys) from ever being wired to the wrong gateway.
 *
 * Env:
 *  - STRIPE_SECRET_KEY        sk_test_... (staging) or sk_live_... (production)
 *  - STRIPE_PUBLISHABLE_KEY   pk_test_... / pk_live_... returned to the app
 *  - STRIPE_MODE              optional, "test" or "live"; must match the keys
 */
export function resolveStripeConfig(
  config: ConfigService,
): StripeRuntimeConfig {
  const secretKey = config.getOrThrow<string>('STRIPE_SECRET_KEY').trim();
  const publishableKey =
    config.get<string>('STRIPE_PUBLISHABLE_KEY')?.trim() || null;
  const mode = keyMode(secretKey);

  const declaredMode = config.get<string>('STRIPE_MODE')?.trim().toLowerCase();
  if (declaredMode && declaredMode !== mode) {
    throw new Error(
      `STRIPE_MODE is "${declaredMode}" but STRIPE_SECRET_KEY is a ${mode} key. Use sandbox keys for the test/staging backend and live keys only for production.`,
    );
  }
  if (publishableKey && keyMode(publishableKey) !== mode) {
    throw new Error(
      `STRIPE_PUBLISHABLE_KEY (${keyMode(publishableKey)}) does not match STRIPE_SECRET_KEY (${mode}).`,
    );
  }

  return { secretKey, publishableKey, mode };
}
