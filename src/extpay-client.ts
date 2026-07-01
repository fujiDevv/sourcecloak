import ExtPay from 'extpay';
import { EXTENSION_PAY_ID, PRO_PLAN_NICKNAME } from './constants';

export function createExtPay() {
  return ExtPay(EXTENSION_PAY_ID);
}

let backgroundStarted = false;

export function startExtPayBackground(): void {
  if (backgroundStarted) return;
  createExtPay().startBackground();
  backgroundStarted = true;
}

export async function getExtPayUser() {
  return createExtPay().getUser();
}

export async function isProUser(): Promise<boolean> {
  try {
    const user = await getExtPayUser();
    return user.paid === true;
  } catch {
    return false;
  }
}

export async function openProPaymentPage(): Promise<void> {
  const extpay = createExtPay();
  if (PRO_PLAN_NICKNAME) {
    await extpay.openPaymentPage(PRO_PLAN_NICKNAME);
    return;
  }
  await extpay.openPaymentPage();
}

export async function openProLoginPage(): Promise<void> {
  await createExtPay().openLoginPage();
}