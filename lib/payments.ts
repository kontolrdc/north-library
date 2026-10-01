import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import { sendAdminPaymentAlertEmail, sendPaymentFailureEmail, sendPaymentSuccessEmail } from '@/lib/email';

type SettlementInput = {
  reference: string;
  status: string;
  amount: number;
  gatewayResponse?: unknown;
};

type PaymentRow = {
  id: string;
  user_id: string;
  story_id: string | null;
  book_id: string;
  page_index: number | null;
  scope: 'page' | 'story';
  amount: string;
  status: string;
  user_email: string;
  user_name: string | null;
  story_title: string | null;
};

export async function settlePaystackPayment({
  reference,
  status,
  amount,
  gatewayResponse,
}: SettlementInput): Promise<{ settled: boolean; alreadySettled: boolean }> {
  const outcome = await db.withTransaction(async (client: PoolClient) => {
    const paymentResult = await client.query<PaymentRow>(
      `
        SELECT p.id, p.user_id, p.story_id, p.book_id, p.page_index, p.scope, p.amount, p.status,
               u.email AS user_email, u.name AS user_name, s.title AS story_title
        FROM payments p
        LEFT JOIN users u ON u.id = p.user_id
        LEFT JOIN stories s ON s.id = p.story_id
        WHERE p.reference = $1
        FOR UPDATE;
      `,
      [reference]
    );
    const payment = paymentResult.rows[0];

    if (!payment) {
      throw new Error('Payment reference not found.');
    }

    if (payment.status === 'paid') {
      return {
        settled: true,
        alreadySettled: true,
        userEmail: payment.user_email,
        userName: payment.user_name,
        storyTitle: payment.story_title ?? 'the selected story',
        amount: Number(payment.amount),
        reference,
      };
    }

    const expectedAmount = Number(payment.amount);
    if (status !== 'success' || !Number.isFinite(amount) || Math.abs(amount - expectedAmount) > 0.001) {
      const eventType = status === 'success' ? 'payment.amount_mismatch' : 'payment.failed';
      await client.query(
        `UPDATE payments SET status = $1 WHERE id = $2 AND status = 'pending';`,
        [status === 'success' ? 'amount_mismatch' : status, payment.id]
      );
      await client.query(
        `INSERT INTO system_events (actor_user_id, event_type, entity_type, entity_id, details)
         VALUES ($1, $2, 'payment', $3, $4::jsonb);`,
        [payment.user_id, eventType, reference, JSON.stringify({ expectedAmount, receivedAmount: amount, status })]
      );
      return {
        settled: false,
        alreadySettled: false,
        userEmail: payment.user_email,
        userName: payment.user_name,
        storyTitle: payment.story_title ?? 'the selected story',
        amount: expectedAmount,
        reference,
      };
    }

    await client.query(
      `
        UPDATE payments
        SET status = 'paid', paid_at = NOW()
        WHERE id = $1;
      `,
      [payment.id]
    );

    await client.query(
      `
        INSERT INTO user_entitlements (user_id, story_id, book_id, page_index, scope, granted_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, story_id, page_index, scope) DO NOTHING;
      `,
      [payment.user_id, payment.story_id, payment.book_id, payment.page_index, payment.scope]
    );

    await client.query(
      `INSERT INTO system_events (actor_user_id, event_type, entity_type, entity_id, details)
       VALUES ($1, 'payment.settled', 'payment', $2, $3::jsonb);`,
      [payment.user_id, reference, JSON.stringify({ storyId: payment.story_id, pageIndex: payment.page_index, scope: payment.scope, amount, currency: 'GHS' })]
    );

    if (gatewayResponse !== undefined) {
      console.info('Paystack payment settled:', { reference, paymentId: payment.id });
    }

    return {
      settled: true,
      alreadySettled: false,
      userEmail: payment.user_email,
      userName: payment.user_name,
      storyTitle: payment.story_title ?? 'the selected story',
      amount: expectedAmount,
      reference,
    };
  });

  if (outcome.settled && !outcome.alreadySettled) {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SUPERADMIN_EMAIL;

    if (outcome.userEmail) {
      await sendPaymentSuccessEmail({
        to: outcome.userEmail,
        name: outcome.userName ?? 'reader',
        storyTitle: outcome.storyTitle,
        amount: Number(outcome.amount),
        reference: outcome.reference,
      });
    }

    if (adminEmail && outcome.userEmail) {
      await sendAdminPaymentAlertEmail({
        to: adminEmail,
        userEmail: outcome.userEmail,
        storyTitle: outcome.storyTitle,
        amount: Number(outcome.amount),
        reference: outcome.reference,
      });
    }
  }

  if (!outcome.settled && outcome.userEmail) {
    await sendPaymentFailureEmail({
      to: outcome.userEmail,
      name: outcome.userName ?? 'reader',
      storyTitle: outcome.storyTitle,
      amount: Number(outcome.amount),
      reference: outcome.reference,
    });
  }

  return { settled: outcome.settled, alreadySettled: outcome.alreadySettled };
}

export async function getPaymentOwner(reference: string, userId: string) {
  return db.queryOne<{ id: string; status: string; page_index: number | null }>(
    'SELECT id, status, page_index FROM payments WHERE reference = $1 AND user_id = $2 LIMIT 1;',
    [reference, userId]
  );
}
