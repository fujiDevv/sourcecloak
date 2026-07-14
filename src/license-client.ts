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

export async function getStoredLicense(): Promise<StoredLicense | null> {
  return null;
}

export async function openProCheckoutPage(): Promise<void> {
  await extensionApi.tabs.create({ url: 'https://github.com/fujiDevv/sourcecloak' });
}

export async function activateProLicense(_licenseKey: string): Promise<LicenseStatus> {
  return { isPro: true, customerEmail: 'opensource@free' };
}

export async function deactivateProLicense(): Promise<void> {
  // No-op
}

export async function isProUser(_forceValidate = false): Promise<boolean> {
  return true;
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  return {
    isPro: true,
    customerEmail: 'opensource@free',
    activatedAt: Date.now(),
    lastValidatedAt: Date.now(),
  };
}
