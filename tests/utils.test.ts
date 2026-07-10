import { describe, it, expect } from 'vitest';
import { isDomainMatch, isHostnameInScope } from '../src/utils';

describe('isDomainMatch', () => {
  it('matches exact domains', () => {
    expect(isDomainMatch('github.com', ['github.com'])).toBe(true);
    expect(isDomainMatch('github.com', ['gitlab.com', 'github.com'])).toBe(true);
    expect(isDomainMatch('github.com', ['github.io'])).toBe(false);
  });

  it('matches wildcard subdomains', () => {
    expect(isDomainMatch('chat.openai.com', ['*.openai.com'])).toBe(true);
    expect(isDomainMatch('openai.com', ['*.openai.com'])).toBe(true);
    expect(isDomainMatch('platform.openai.com', ['*.openai.com'])).toBe(true);
    expect(isDomainMatch('fakeopenai.com', ['*.openai.com'])).toBe(false);
    expect(isDomainMatch('openai.company.com', ['*.openai.com'])).toBe(false);
  });

  it('handles empty pattern lists', () => {
    expect(isDomainMatch('github.com', [])).toBe(false);
  });
});

describe('isHostnameInScope', () => {
  it('skips trusted domains', () => {
    expect(
      isHostnameInScope('intranet.corp', {
        trustedDomains: ['intranet.corp'],
        monitoredDomains: ['chatgpt.com'],
      })
    ).toBe(false);
  });

  it('requires monitor allowlist when non-empty', () => {
    expect(
      isHostnameInScope('example.com', {
        trustedDomains: [],
        monitoredDomains: ['chatgpt.com'],
      })
    ).toBe(false);
    expect(
      isHostnameInScope('chatgpt.com', {
        trustedDomains: [],
        monitoredDomains: ['chatgpt.com'],
      })
    ).toBe(true);
  });

  it('scans all hosts when monitor list is empty', () => {
    expect(
      isHostnameInScope('anything.example', {
        trustedDomains: [],
        monitoredDomains: [],
      })
    ).toBe(true);
  });
});
