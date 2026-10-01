import test from 'node:test';
import assert from 'node:assert/strict';

import { getPaystackWebhookSecret } from '../lib/paystack';

test('getPaystackWebhookSecret prefers the webhook secret and falls back only in development', () => {
  const env = process.env as Record<string, string | undefined>;
  const previousWebhook = env.PAYSTACK_WEBHOOK_SECRET;
  const previousSecret = env.PAYSTACK_SECRET_KEY;
  const previousNodeEnv = env.NODE_ENV;

  try {
    env.PAYSTACK_WEBHOOK_SECRET = 'webhook-secret';
    env.PAYSTACK_SECRET_KEY = 'secret-key';
    env.NODE_ENV = 'production';
    assert.equal(getPaystackWebhookSecret(), 'webhook-secret');

    env.PAYSTACK_WEBHOOK_SECRET = '';
    env.PAYSTACK_SECRET_KEY = 'secret-key';
    env.NODE_ENV = 'development';
    assert.equal(getPaystackWebhookSecret(), 'secret-key');
  } finally {
    if (previousWebhook === undefined) Reflect.deleteProperty(env, 'PAYSTACK_WEBHOOK_SECRET');
    else env.PAYSTACK_WEBHOOK_SECRET = previousWebhook;

    if (previousSecret === undefined) Reflect.deleteProperty(env, 'PAYSTACK_SECRET_KEY');
    else env.PAYSTACK_SECRET_KEY = previousSecret;

    if (previousNodeEnv === undefined) Reflect.deleteProperty(env, 'NODE_ENV');
    else env.NODE_ENV = previousNodeEnv;
  }
});
