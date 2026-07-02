const LS_LICENSE_API = 'https://api.lemonsqueezy.com/v1/licenses';

export interface LemonSqueezyLicenseMeta {
  customer_email?: string;
  product_name?: string;
  variant_name?: string;
}

export interface LemonSqueezyLicenseResponse {
  activated: boolean;
  error: string | null;
  license_key?: {
    status?: string;
    activation_limit?: number;
    activation_usage?: number;
    expires_at?: string | null;
  };
  meta?: LemonSqueezyLicenseMeta;
}

export interface LicenseOperationResult {
  success: boolean;
  error?: string;
  customerEmail?: string;
}

async function postLicenseEndpoint(
  endpoint: 'activate' | 'validate' | 'deactivate',
  licenseKey: string,
  instanceName: string
): Promise<LemonSqueezyLicenseResponse> {
  const response = await fetch(`${LS_LICENSE_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      license_key: licenseKey.trim(),
      instance_name: instanceName,
    }),
  });

  if (!response.ok) {
    throw new Error(`License service unavailable (${response.status})`);
  }

  return response.json() as Promise<LemonSqueezyLicenseResponse>;
}

function parseLicenseResponse(data: LemonSqueezyLicenseResponse): LicenseOperationResult {
  if (!data.activated) {
    return {
      success: false,
      error: data.error ?? 'License could not be activated on this device.',
    };
  }

  const status = data.license_key?.status?.toLowerCase();
  if (status && status !== 'active') {
    return {
      success: false,
      error: `License status is ${status}.`,
    };
  }

  if (data.license_key?.expires_at) {
    const expiresAt = new Date(data.license_key.expires_at);
    if (expiresAt.getTime() < Date.now()) {
      return { success: false, error: 'License has expired.' };
    }
  }

  return {
    success: true,
    customerEmail: data.meta?.customer_email,
  };
}

export async function activateLicenseKey(
  licenseKey: string,
  instanceName: string
): Promise<LicenseOperationResult> {
  if (!licenseKey.trim()) {
    return { success: false, error: 'Enter your license key from the purchase email.' };
  }

  try {
    const data = await postLicenseEndpoint('activate', licenseKey, instanceName);
    return parseLicenseResponse(data);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not reach Lemon Squeezy.',
    };
  }
}

export async function validateLicenseKey(
  licenseKey: string,
  instanceName: string
): Promise<LicenseOperationResult> {
  if (!licenseKey.trim()) {
    return { success: false, error: 'No license key stored.' };
  }

  try {
    const data = await postLicenseEndpoint('validate', licenseKey, instanceName);
    return parseLicenseResponse(data);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not validate license.',
    };
  }
}

export async function deactivateLicenseKey(
  licenseKey: string,
  instanceName: string
): Promise<LicenseOperationResult> {
  if (!licenseKey.trim()) {
    return { success: false, error: 'No license key to deactivate.' };
  }

  try {
    const data = await postLicenseEndpoint('deactivate', licenseKey, instanceName);
    if (!data.activated && data.error) {
      return { success: false, error: data.error };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not deactivate license.',
    };
  }
}