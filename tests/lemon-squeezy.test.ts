import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activateLicenseKey, deactivateLicenseKey, validateLicenseKey } from '../src/lemon-squeezy';

function mockFetchResponse(payload: unknown, ok = true): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  }));
}

describe('lemon-squeezy license API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('activates a valid license key', async () => {
    mockFetchResponse({
      activated: true,
      error: null,
      license_key: { status: 'active', expires_at: null },
      meta: { customer_email: 'buyer@example.com' },
    });

    const result = await activateLicenseKey('KEY-1234', 'sc-device-1');
    expect(result.success).toBe(true);
    expect(result.customerEmail).toBe('buyer@example.com');
  });

  it('returns API error message on failed activation', async () => {
    mockFetchResponse({
      activated: false,
      error: 'license_key not found',
    });

    const result = await activateLicenseKey('BAD-KEY', 'sc-device-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('license_key not found');
  });

  it('rejects empty license keys', async () => {
    const result = await activateLicenseKey('   ', 'sc-device-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('license key');
  });

  it('validates an active license', async () => {
    mockFetchResponse({
      activated: true,
      error: null,
      license_key: { status: 'active' },
      meta: { customer_email: 'buyer@example.com' },
    });

    const result = await validateLicenseKey('KEY-1234', 'sc-device-1');
    expect(result.success).toBe(true);
  });

  it('deactivates a license instance', async () => {
    mockFetchResponse({
      activated: true,
      error: null,
    });

    const result = await deactivateLicenseKey('KEY-1234', 'sc-device-1');
    expect(result.success).toBe(true);
  });
});