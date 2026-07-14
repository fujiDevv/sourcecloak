import { extensionApi } from '../src/platform';
import type { Edition } from '../src/types';
import { el } from './dom';

export interface LicenseUi {
  openHalo: () => void;
  closeHalo: () => void;
  applyEdition: (edition: Edition, customerEmail?: string) => void;
  bind: (hooks: {
    onActivated: (edition: Edition, customerEmail?: string) => Promise<void>;
    onDeactivated: () => Promise<void>;
  }) => void;
}

export function createLicenseUi(): LicenseUi {
  const haloOverlay = el<HTMLDivElement>('halo-overlay');
  const haloClose = el<HTMLButtonElement>('halo-close');
  const haloBuy = el<HTMLButtonElement>('halo-buy');
  const haloStatus = el<HTMLParagraphElement>('halo-status');
  const haloPrice = el<HTMLSpanElement>('halo-price');
  const haloRefundNotice = el<HTMLParagraphElement>('halo-refund-notice');
  const haloLicenseSection = el<HTMLDivElement>('halo-license-section');
  const haloLicenseKey = el<HTMLInputElement>('halo-license-key');
  const haloActivate = el<HTMLButtonElement>('halo-activate');
  const haloProSection = el<HTMLDivElement>('halo-pro-section');
  const haloProEmail = el<HTMLParagraphElement>('halo-pro-email');
  const haloDeactivate = el<HTMLButtonElement>('halo-deactivate');

  haloPrice.textContent = '$0';
  haloRefundNotice.textContent = '';

  function setHaloStatus(message: string, isError = false): void {
    haloStatus.textContent = message;
    haloStatus.classList.toggle('error', isError);
  }

  function openHalo(): void {
    haloOverlay.classList.remove('hidden');
    haloOverlay.setAttribute('aria-hidden', 'false');
    haloOverlay.removeAttribute('inert');
    setHaloStatus('');
  }

  function closeHalo(): void {
    if (document.activeElement && haloOverlay.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
    haloOverlay.classList.add('hidden');
    haloOverlay.setAttribute('aria-hidden', 'true');
    haloOverlay.setAttribute('inert', '');
  }

  function applyEdition(edition: Edition, customerEmail?: string): void {
    const isPro = edition === 'pro';
    haloBuy.style.display = isPro ? 'none' : 'inline-flex';
    haloLicenseSection.classList.toggle('hidden', isPro);
    haloProSection.classList.toggle('hidden', !isPro);

    if (isPro) {
      haloProEmail.textContent = customerEmail
        ? `Pro active for ${customerEmail}`
        : 'Pro license active on this device.';
    } else {
      haloProEmail.textContent = '';
    }
  }

  function bind(hooks: {
    onActivated: (edition: Edition, customerEmail?: string) => Promise<void>;
    onDeactivated: () => Promise<void>;
  }): void {
    document.querySelectorAll<HTMLElement>('[data-open-halo]').forEach((node) => {
      node.addEventListener('click', (event) => {
        event.preventDefault();
        openHalo();
      });
    });

    haloClose.addEventListener('click', closeHalo);
    haloOverlay.addEventListener('click', (event) => {
      if (event.target === haloOverlay) closeHalo();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !haloOverlay.classList.contains('hidden')) {
        closeHalo();
      }
    });

    haloBuy.addEventListener('click', async () => {
      const response = await extensionApi.runtime.sendMessage<{ success: boolean; error?: string }>({
        type: 'open-checkout-page',
      });

      if (!response?.success) {
        setHaloStatus(response?.error ?? 'Could not open checkout page.', true);
        return;
      }

      setHaloStatus('Checkout opened. Paste your license key here after purchase.');
    });

    haloActivate.addEventListener('click', async () => {
      const licenseKey = haloLicenseKey.value.trim();
      if (!licenseKey) {
        setHaloStatus('Enter the license key from your purchase email.', true);
        return;
      }

      haloActivate.disabled = true;
      setHaloStatus('Activating license…');

      const response = await extensionApi.runtime.sendMessage<{
        success: boolean;
        edition?: Edition;
        customerEmail?: string;
        error?: string;
      }>({
        type: 'activate-license',
        licenseKey,
      });

      haloActivate.disabled = false;

      if (!response?.success) {
        setHaloStatus(response?.error ?? 'Activation failed.', true);
        return;
      }

      haloLicenseKey.value = '';
      const edition = response.edition ?? 'pro';
      applyEdition(edition, response.customerEmail);
      await hooks.onActivated(edition, response.customerEmail);
      setHaloStatus('Pro unlocked. All features are now active.');
    });

    haloDeactivate.addEventListener('click', async () => {
      if (
        !confirm(
          'Deactivate Pro on this device? You can re-activate with the same license key later.'
        )
      ) {
        return;
      }

      const response = await extensionApi.runtime.sendMessage<{
        success: boolean;
        edition?: Edition;
        error?: string;
      }>({
        type: 'deactivate-license',
      });

      if (!response?.success) {
        setHaloStatus(response?.error ?? 'Could not deactivate license.', true);
        return;
      }

      applyEdition('community');
      await hooks.onDeactivated();
      setHaloStatus('License deactivated on this device.');
    });

    haloLicenseKey.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        haloActivate.click();
      }
    });
  }

  return { openHalo, closeHalo, applyEdition, bind };
}
