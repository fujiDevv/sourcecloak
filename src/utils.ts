export function isDomainMatch(hostname: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return hostname === suffix || hostname.endsWith('.' + suffix);
    }
    return hostname === pattern;
  });
}
