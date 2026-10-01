import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { verifyPaystack } from '@/lib/paystack';
import { getPaymentOwner, settlePaystackPayment } from '@/lib/payments';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const reference = String(body.reference ?? '').trim();

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required.' }, { status: 400 });
    }

    const payment = await getPaymentOwner(reference, session.userId);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    const result = await verifyPaystack(reference);
    const settlement = await settlePaystackPayment({
      reference,
      status: result.status === 'success' ? 'success' : String(result.status ?? 'failed'),
      amount: Number(result.amount ?? 0) / 100,
      gatewayResponse: result,
    });

    return NextResponse.json({ ok: true, payment: result, continuePage: payment.page_index, ...settlement });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: 'Unable to verify payment.' }, { status: 500 });
  }
}
