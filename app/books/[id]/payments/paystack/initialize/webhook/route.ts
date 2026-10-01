import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPaystackWebhookSecret } from '@/lib/paystack';
import { settlePaystackPayment } from '@/lib/payments';

export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  const signature = request.headers.get('x-paystack-signature');
  const secret = getPaystackWebhookSecret();

  if (!signature) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify HMAC SHA512 signature from Paystack
  const expectedSignature = crypto
    .createHmac('sha512', secret)
    .update(bodyText)
    .digest('hex');

  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
  }

  const event = JSON.parse(bodyText);

  if ((event.event === 'charge.success' || event.event === 'charge.failed') && event.data?.reference) {
    await settlePaystackPayment({
      reference: String(event.data.reference),
      status: event.event === 'charge.success' ? 'success' : 'failed',
      amount: Number(event.data.amount ?? 0) / 100,
      gatewayResponse: event.data,
    });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}