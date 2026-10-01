import { getRequiredEnv } from './config';

export function getPaystackWebhookSecret(): string {
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    return webhookSecret;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (process.env.NODE_ENV !== 'production' && secretKey) {
    return secretKey;
  }

  return getRequiredEnv('PAYSTACK_WEBHOOK_SECRET', {
    defaultMessage:
      'PAYSTACK_WEBHOOK_SECRET is missing. Set it in .env or the deployment environment before using Paystack webhooks in production.',
  });
}

export async function initializePaystack({
  email,
  amount,
  reference,
  callbackUrl,
}: {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
}) {
  const secretKey = getRequiredEnv('PAYSTACK_SECRET_KEY', {
    defaultMessage: 'PAYSTACK_SECRET_KEY is not configured.',
  });

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amount * 100,
      reference,
      callback_url: callbackUrl,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Paystack initialization failed.');
  }

  return {
    authorizationUrl: data.data.authorization_url,
    access_code: data.data.access_code,
    reference: data.data.reference,
  };
}

export async function verifyPaystack(reference: string) {
  const secretKey = getRequiredEnv('PAYSTACK_SECRET_KEY', {
    defaultMessage: 'PAYSTACK_SECRET_KEY is not configured.',
  });

  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Paystack verification failed.');
  }

  return data.data;
}
