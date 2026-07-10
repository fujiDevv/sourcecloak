import {
  DEV_PRO_UNLOCK,
  LICENSE_GRACE_MS,
  LICENSE_VALIDATION_TTL_MS,
  LEMON_SQUEEZY_CHECKOUT_URL,
  STORAGE_KEYS,
} from './constants';
import {
  activateLicenseKey,
  deactivateLicenseKey,
  validateLicenseKey,
} from './lemon-squeezy';
import { shouldRetainProOnValidationFailure } from './license-policy';
import { extensionApi } from './platform';

export interface StoredLicense {
  licenseKey: string;
  instanceId: string;
  customerEmail?: string;
  activatedAt: number;
  lastValidatedAt: number;
}

export interface LicenseStatus {
  isPro: boolean;
  customerEmail?: string;
  activatedAt?: number;
  lastValidatedAt?: number;
  error?: string;
  grace?: boolean;
}

function createInstanceId(): string {
  return `sc-${crypto.randomUUID()}`;
}

export async function getStoredLicense(): Promise<StoredLicense | null> {
  const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.LICENSE);
  const raw = data[STORAGE_KEYS.LICENSE] as StoredLicense | undefined;
  if (!raw?.licenseKey || !raw.instanceId) return null;
  return raw;
}

async function saveLicense(license: StoredLicense): Promise<void> {
  await extensionApi.storage.local.set({ [STORAGE_KEYS.LICENSE]: license });
}

async function clearLicense(): Promise<void> {
  await extensionApi.storage.local.remove(STORAGE_KEYS.LICENSE);
}

async function getOrCreateInstanceId(existing?: StoredLicense | null): Promise<string> {
  if (existing?.instanceId) return existing.instanceId;
  return createInstanceId();
}

export async function openProCheckoutPage(): Promise<void> {
  if (!LEMON_SQUEEZY_CHECKOUT_URL) {
    throw new Error('Checkout URL is not configured. Set LEMON_SQUEEZY_CHECKOUT_URL in src/constants.ts.');
  }
  await extensionApi.tabs.create({ url: LEMON_SQUEEZY_CHECKOUT_URL });
}

export async function activateProLicense(licenseKey: string): Promise<LicenseStatus> {
  if (DEV_PRO_UNLOCK) {
    return { isPro: true, customerEmail: 'developer@local' };
  }

  const existing = await getStoredLicense();
  const instanceId = await getOrCreateInstanceId(existing);
  const result = await activateLicenseKey(licenseKey, instanceId);

  if (!result.success) {
    return { isPro: false, error: result.error };
  }

  const now = Date.now();
  const license: StoredLicense = {
    licenseKey: licenseKey.trim(),
    instanceId,
    customerEmail: result.customerEmail,
    activatedAt: now,
    lastValidatedAt: now,
  };

  await saveLicense(license);

  return {
    isPro: true,
    customerEmail: license.customerEmail,
    activatedAt: license.activatedAt,
    lastValidatedAt: license.lastValidatedAt,
  };
}

export async function deactivateProLicense(): Promise<void> {
  const license = await getStoredLicense();
  if (!license) return;

  await deactivateLicenseKey(license.licenseKey, license.instanceId);
  await clearLicense();
}

export async function isProUser(forceValidate = false): Promise<boolean> {
  if (DEV_PRO_UNLOCK) return true;

  const license = await getStoredLicense();
  if (!license) return false;

  const isFresh = !forceValidate
    && Date.now() - license.lastValidatedAt < LICENSE_VALIDATION_TTL_MS;

  if (isFresh) return true;

  const result = await validateLicenseKey(license.licenseKey, license.instanceId);
  if (!result.success) {
    if (
      shouldRetainProOnValidationFailure({
        lastValidatedAt: license.lastValidatedAt,
        transient: Boolean(result.transient),
        graceMs: LICENSE_GRACE_MS,
      })
    ) {
      return true;
    }
    await clearLicense();
    return false;
  }

  await saveLicense({
    ...license,
    customerEmail: result.customerEmail ?? license.customerEmail,
    lastValidatedAt: Date.now(),
  });

  return true;
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (DEV_PRO_UNLOCK) {
    return { isPro: true, customerEmail: 'developer@local' };
  }

  const license = await getStoredLicense();
  if (!license) {
    return { isPro: false };
  }

  const isPro = await isProUser();
  if (!isPro) {
    return { isPro: false };
  }

  const age = Date.now() - license.lastValidatedAt;
  const grace = age >= LICENSE_VALIDATION_TTL_MS;

  return {
    isPro: true,
    customerEmail: license.customerEmail,
    activatedAt: license.activatedAt,
    lastValidatedAt: license.lastValidatedAt,
    grace: grace || undefined,
  };
}
