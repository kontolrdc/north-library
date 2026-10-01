import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../lib/db';

async function main() {
  const schema = readFileSync(join(process.cwd(), 'scripts', 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Database schema applied');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
