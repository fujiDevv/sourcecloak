import { describe, expect, it } from 'vitest';
import { shouldRetainProOnValidationFailure } from '../src/license-policy';

const DAY = 24 * 60 * 60 * 1000;
const GRACE = 14 * DAY;

describe('shouldRetainProOnValidationFailure', () => {
  const now = 1_700_000_000_000;

  it('retains Pro for transient failures inside grace window', () => {
    expect(
      shouldRetainProOnValidationFailure({
        lastValidatedAt: now - 3 * DAY,
        transient: true,
        now,
        graceMs: GRACE,
      })
    ).toBe(true);
  });

  it('does not retain Pro after grace expires', () => {
    expect(
      shouldRetainProOnValidationFailure({
        lastValidatedAt: now - 15 * DAY,
        transient: true,
        now,
        graceMs: GRACE,
      })
    ).toBe(false);
  });

  it('never retains Pro on definitive rejection', () => {
    expect(
      shouldRetainProOnValidationFailure({
        lastValidatedAt: now - 1 * DAY,
        transient: false,
        now,
        graceMs: GRACE,
      })
    ).toBe(false);
  });
});
