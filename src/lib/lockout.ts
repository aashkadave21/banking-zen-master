/** Order.Login.Lock — 30-minute lock after five consecutive failures. Pure, testable. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 30;

export type LockState = { failed_count: number; locked_until: string | null };

export function isLocked(state: LockState | null, now = new Date()): boolean {
  return !!state?.locked_until && new Date(state.locked_until) > now;
}

export function afterFailure(state: LockState | null, now = new Date()): LockState {
  // An expired lock starts a fresh counting window.
  const base = state && !isLocked(state, now) && state.locked_until ? 0 : (state?.failed_count ?? 0);
  const failed = base + 1;
  return {
    failed_count: failed,
    locked_until:
      failed >= MAX_FAILED_LOGINS
        ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000).toISOString()
        : null,
  };
}

export const GENERIC_LOGIN_ERROR = "The email or password is incorrect, or the account is unavailable.";
export const LOCKED_ERROR =
  "Too many failed attempts. For your security, sign-in is paused for 30 minutes.";
