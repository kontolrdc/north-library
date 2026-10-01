import { hash } from 'bcryptjs';
import { db } from '../lib/db';

async function main() {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME?.trim() || 'Superadmin';

  if (!email || !password) {
    throw new Error('Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env before running db:superadmin.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('SUPERADMIN_EMAIL must be a valid email address.');
  }

  if (password.length < 12) {
    throw new Error('SUPERADMIN_PASSWORD must be at least 12 characters long.');
  }

  const passwordHash = await hash(password, 12);
  const user = await db.queryOne<{ id: string; email: string }>(
    `
      INSERT INTO users (email, password_hash, role, name)
      VALUES ($1, $2, 'superadmin', $3)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = 'superadmin',
        name = EXCLUDED.name
      RETURNING id, email;
    `,
    [email, passwordHash, name]
  );

  console.log(`Superadmin provisioned: ${user?.email}`);
  await db.end();
}

main().catch(async (error: unknown) => {
  console.error('Superadmin provisioning failed:', error instanceof Error ? error.message : 'Unknown error');
  await db.end();
  process.exitCode = 1;
});