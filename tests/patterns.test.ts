import { describe, expect, it } from 'vitest';
import { runPatternScan } from '../src/patterns';

describe('runPatternScan', () => {
  it('detects SSH private keys', () => {
    const text = `-----BEGIN OPENSSH PRIVATE KEY-----\nabc123\n-----END OPENSSH PRIVATE KEY-----`;
    const matches = runPatternScan(text);
    expect(matches.some((m) => m.category === 'ssh_private_key')).toBe(true);
  });

  it('detects AWS access keys', () => {
    const matches = runPatternScan('token = AKIAIOSFODNN7EXAMPLE');
    expect(matches.some((m) => m.category === 'api_credential')).toBe(true);
  });

  it('detects custom corporate signatures', () => {
    const matches = runPatternScan('config uses ACME_INTERNAL_API gateway', [], ['ACME_INTERNAL_API']);
    expect(matches.some((m) => m.category === 'corporate_config')).toBe(true);
  });
});