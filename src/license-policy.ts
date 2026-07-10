/**
 * Pure license grace-period policy (unit-testable).
 * Transient failures (network / 5xx) keep Pro within grace after last successful validation.
 * Definitive rejections (invalid key, expired, wrong product) never retain Pro.
 */
export function shouldRetainProOnValidationFailure(options: {
  lastValidatedAt: number;
  transient: boolean;
  now?: number;
  graceMs: number;
}): boolean {
  const now = options.now ?? Date.now();
  if (!options.transient) return false;
  if (!options.lastValidatedAt || options.lastValidatedAt <= 0) return false;
  return now - options.lastValidatedAt < options.graceMs;
}
