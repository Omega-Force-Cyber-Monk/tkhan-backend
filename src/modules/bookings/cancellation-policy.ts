import type { ConfigService } from '@nestjs/config';

/**
 * Karoot Cancellation & Refund Policy.
 *
 * Buyer:
 *   - 24+ hours before the appointment  -> 100% refund
 *   - less than 3 hours before          -> 70% refund (30% late cancellation fee,
 *                                          retained by the platform - no groomer payout)
 *   - between 3 and 24 hours            -> 100% (confirmed by client, env-overridable)
 *   - booking not yet accepted by the groomer -> 100% refund
 * Groomer:
 *   - 24+ hours before  -> customer gets 100%, NOT counted as a no-show
 *   - under 24 hours    -> customer gets 100%, counted as a Groomer No-Show
 *
 * Every number is overridable through env so the client can tune the policy
 * without a code change.
 */
export interface CancellationPolicyConfig {
  buyerFullRefundHours: number;
  buyerLateCancelHours: number;
  buyerLateRefundPercent: number;
  buyerMidWindowRefundPercent: number;
  groomerNoShowHours: number;
  noShowWindowDays: number;
  noShowSuspendAt: number;
  noShowBlockAt: number;
  noShowSuspensionDays: number;
  businessTimeZone: string;
}

const num = (
  config: ConfigService | undefined,
  key: string,
  fallback: number,
) => {
  const raw = config?.get<string | number>(key);
  const value = Number(raw);
  return raw === undefined ||
    raw === null ||
    raw === '' ||
    !Number.isFinite(value)
    ? fallback
    : value;
};

export function loadCancellationPolicy(
  config?: ConfigService,
): CancellationPolicyConfig {
  return {
    buyerFullRefundHours: num(config, 'CANCEL_BUYER_FULL_REFUND_HOURS', 24),
    buyerLateCancelHours: num(config, 'CANCEL_BUYER_LATE_HOURS', 3),
    buyerLateRefundPercent: num(config, 'CANCEL_BUYER_LATE_REFUND_PERCENT', 70),
    buyerMidWindowRefundPercent: num(
      config,
      'CANCEL_BUYER_MID_WINDOW_REFUND_PERCENT',
      100,
    ),
    groomerNoShowHours: num(config, 'CANCEL_GROOMER_NO_SHOW_HOURS', 24),
    noShowWindowDays: num(config, 'GROOMER_NO_SHOW_WINDOW_DAYS', 90),
    noShowSuspendAt: num(config, 'GROOMER_NO_SHOW_SUSPEND_AT', 2),
    noShowBlockAt: num(config, 'GROOMER_NO_SHOW_BLOCK_AT', 3),
    noShowSuspensionDays: num(config, 'GROOMER_NO_SHOW_SUSPENSION_DAYS', 14),
    businessTimeZone:
      config?.get<string>('BUSINESS_TIME_ZONE')?.trim() || 'America/Toronto',
  };
}

/**
 * Availability slots are stored as wall-clock times (e.g. a 10:00 slot is
 * saved as 10:00Z). To measure "hours before the appointment" we therefore
 * compare against the current wall-clock time in the business time zone,
 * expressed the same way.
 */
export function wallClockNow(timeZone: string, now = new Date()): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(now);
    const get = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    return new Date(
      Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second'),
      ),
    );
  } catch {
    return now;
  }
}

export function hoursUntil(
  startTime: Date | null | undefined,
  timeZone: string,
) {
  if (!startTime) return null;
  const diffMs = startTime.getTime() - wallClockNow(timeZone).getTime();
  return Math.round((diffMs / (60 * 60 * 1000)) * 100) / 100;
}

export const roundMoney = (value: number) => Math.round(value * 100) / 100;
