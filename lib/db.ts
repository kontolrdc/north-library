import { loadEnvConfig } from '@next/env';
import { Pool, type PoolClient } from 'pg';

import { getRequiredEnv } from './config';

loadEnvConfig(process.cwd());

const databaseUrl = getRequiredEnv('DATABASE_URL', {
  defaultMessage: 'DATABASE_URL is missing. Add it to .env or the deployment environment before using the database.',
});

export type UserEntitlement = {
  userId: string;
  storyId?: string | null;
  bookId: string;
  pageIndex: number;
  scope: 'page' | 'story';
  grantedAt: Date;
};

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = {
  query: async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => {
    const result = await pool.query<T>(text, params);
    return result.rows as T[];
  },

  queryOne: async <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => {
    const result = await pool.query<T>(text, params);
    return (result.rows[0] ?? null) as T | null;
  },

  end: () => pool.end(),

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getEntitlement(userId: string, bookId: string, pageIndex: number): Promise<boolean> {
    const row = await db.queryOne<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM user_entitlements
          WHERE user_id = $1
            AND book_id = $2
            AND (
              scope = 'story'
              OR page_index = $3
            )
        ) as exists;
      `,
      [userId, bookId, pageIndex]
    );

    return Boolean(row?.exists);
  },

  async grantEntitlement(data: UserEntitlement): Promise<void> {
    await db.query(
      `
        INSERT INTO user_entitlements (user_id, story_id, book_id, page_index, scope, granted_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, story_id, page_index, scope) DO NOTHING;
      `,
      [data.userId, data.storyId ?? null, data.bookId, data.pageIndex, data.scope]
    );
  },
};