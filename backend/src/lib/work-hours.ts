import { WorkSessionAnomaly } from 'shared/src/schemas/api';

export interface DaySessionLike {
  type: 'check_in' | 'check_out';
  timestamp: Date | string;
}

export interface DayHoursResult {
  totalHours: number;
  anomalies: WorkSessionAnomaly[];
}

/**
 * Pairs check-in/check-out timestamps of a single day into worked hours and
 * flags structural anomalies:
 *  - forgot_check_out: a trailing check-in with no matching check-out
 *  - forgot_check_in:  a check-out with no preceding check-in
 * Sessions must be sorted by timestamp before calling.
 */
export function computeDayHours(sessions: DaySessionLike[]): DayHoursResult {
  let totalMs = 0;
  const anomalies: WorkSessionAnomaly[] = [];
  let pendingCheckIn: Date | null = null;

  for (const session of sessions) {
    const timestamp = new Date(session.timestamp);
    if (session.type === 'check_in') {
      if (pendingCheckIn) {
        // A new check-in while already checked in: previous one was never closed.
        anomalies.push('forgot_check_out');
      }
      pendingCheckIn = timestamp;
    } else if (session.type === 'check_out') {
      if (pendingCheckIn) {
        totalMs += timestamp.getTime() - pendingCheckIn.getTime();
        pendingCheckIn = null;
      } else {
        anomalies.push('forgot_check_in');
      }
    }
  }

  if (pendingCheckIn) {
    anomalies.push('forgot_check_out');
  }

  const totalHours = Math.max(0, Math.round((totalMs / 3_600_000) * 100) / 100);
  return { totalHours, anomalies };
}

/** Returns true when workedHours is within expectedHours ± benevolenceHours. */
export function isWithinBenevolence(
  workedHours: number,
  expectedHours: number,
  benevolenceHours: number
): boolean {
  const min = expectedHours - benevolenceHours;
  const max = expectedHours + benevolenceHours;
  return workedHours >= min && workedHours <= max;
}

/**
 * The type a new session must have to keep the day coherent, i.e. the sequence
 * alternates check_in → check_out → check_in → ... starting with check_in.
 */
export function nextExpectedType(sessions: DaySessionLike[]): 'check_in' | 'check_out' {
  if (sessions.length === 0) return 'check_in';
  return sessions[sessions.length - 1].type === 'check_in' ? 'check_out' : 'check_in';
}

/** True when sessions alternate starting with a check_in (empty is coherent). */
export function isCoherentSequence(sessions: DaySessionLike[]): boolean {
  let expected: 'check_in' | 'check_out' = 'check_in';
  for (const session of sessions) {
    if (session.type !== expected) return false;
    expected = session.type === 'check_in' ? 'check_out' : 'check_in';
  }
  return true;
}