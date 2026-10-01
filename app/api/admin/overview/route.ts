import { NextResponse } from 'next/server';
import { getServerSession, hasAdminAccess } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const paymentsPage = Math.max(0, Number.parseInt(searchParams.get('paymentsPage') ?? '0', 10) || 0);
    const eventsPage = Math.max(0, Number.parseInt(searchParams.get('eventsPage') ?? '0', 10) || 0);
    const accountsPage = Math.max(0, Number.parseInt(searchParams.get('accountsPage') ?? '0', 10) || 0);
    const pageSize = 50;
    const [totals, interactions, payments, events, users, recordCounts] = await Promise.all([
      db.queryOne<{
        users: number;
        stories: number;
        published_stories: number;
        pending_payments: number;
        paid_payments: number;
        failed_payments: number;
        revenue: string;
      }>(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS users,
          (SELECT COUNT(*)::int FROM stories) AS stories,
          (SELECT COUNT(*)::int FROM stories WHERE is_published) AS published_stories,
          (SELECT COUNT(*)::int FROM payments WHERE status = 'pending') AS pending_payments,
          (SELECT COUNT(*)::int FROM payments WHERE status = 'paid') AS paid_payments,
          (SELECT COUNT(*)::int FROM payments WHERE status <> 'paid' AND status <> 'pending') AS failed_payments,
          COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'paid'), 0)::text AS revenue;
      `),
      db.query(`
        SELECT event_type, COUNT(*)::int AS total
        FROM system_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY event_type
        ORDER BY total DESC, event_type ASC;
      `),
      db.query(`
        SELECT p.reference, p.amount, p.status, p.scope, p.page_index, p.provider, p.created_at, p.paid_at,
               u.email, s.title AS story_title, s.slug AS story_slug
        FROM payments p
        LEFT JOIN users u ON u.id = p.user_id
        LEFT JOIN stories s ON s.id = p.story_id
        ORDER BY p.created_at DESC
        LIMIT $1 OFFSET $2;
      `, [pageSize, paymentsPage * pageSize]),
      db.query(`
        SELECT e.id, e.event_type, e.entity_type, e.entity_id, e.details, e.created_at,
               u.email AS actor_email
        FROM system_events e
        LEFT JOIN users u ON u.id = e.actor_user_id
        ORDER BY e.created_at DESC
        LIMIT $1 OFFSET $2;
      `, [pageSize, eventsPage * pageSize]),
      db.query(`
        SELECT id, name, email, role, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2;
      `, [pageSize, accountsPage * pageSize]),
      db.queryOne<{ payments: number; events: number }>(`
        SELECT
          (SELECT COUNT(*)::int FROM payments) AS payments,
          (SELECT COUNT(*)::int FROM system_events) AS events;
      `),
    ]);

    return NextResponse.json({
      totals: {
        ...totals,
        revenue: Number(totals?.revenue ?? 0),
      },
      interactions,
      payments,
      events,
      users,
      accountsPage,
      recordCounts,
      pageSize,
      paymentsPage,
      eventsPage,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return NextResponse.json({ error: 'Unable to load system activity.' }, { status: 500 });
  }
}
