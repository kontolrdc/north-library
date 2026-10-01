import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getPaystackWebhookSecret } from '@/lib/paystack';
import { settlePaystackPayment } from '@/lib/payments';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature') ?? '';
    const secret = getPaystackWebhookSecret();

    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    const expected = Buffer.from(hash);
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const reference = event?.data?.reference;
    const amount = Number(event?.data?.amount ?? 0) / 100;

    if ((event?.event === 'charge.success' || event?.event === 'charge.failed') && reference) {
      const settlement = await settlePaystackPayment({
        reference: String(reference),
        status: event.event === 'charge.success' ? 'success' : 'failed',
        amount,
        gatewayResponse: event.data,
      });

      return NextResponse.json({ ok: true, received: true, ...settlement });
    }

    return NextResponse.json({ ok: true, received: false });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
