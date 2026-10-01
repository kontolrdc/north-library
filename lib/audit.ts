import { db } from '@/lib/db';

type AuditEvent = {
  actorUserId?: string | null;
  eventType: string;
  entityType?: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await db.query(
      `INSERT INTO system_events (actor_user_id, event_type, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5::jsonb);`,
      [
        event.actorUserId ?? null,
        event.eventType,
        event.entityType ?? null,
        event.entityId ?? null,
        JSON.stringify(event.details ?? {}),
      ]
    );
  } catch (error) {
    console.error('Audit event write failed:', error);
  }
}