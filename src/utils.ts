export function isDomainMatch(hostname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return hostname === suffix || hostname.endsWith('.' + suffix);
    }
    return hostname === pattern;
  });
}

/**
 * Whether this hostname should be scanned under current policy.
 * Trusted domains are always skipped; monitored list is allowlist when non-empty.
 */
export function isHostnameInScope(
  hostname: string,
  settings: { trustedDomains: string[]; monitoredDomains: string[] }
): boolean {
  if (isDomainMatch(hostname, settings.trustedDomains)) return false;
  if (
    settings.monitoredDomains.length > 0 &&
    !isDomainMatch(hostname, settings.monitoredDomains)
  ) {
    return false;
  }
  return true;
}
