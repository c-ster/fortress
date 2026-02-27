import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://localhost:5432/fortress_dev';

const pool = new pg.Pool({ connectionString: databaseUrl });

async function reset() {
  const client = await pool.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS financial CASCADE');
    await client.query('DROP SCHEMA IF EXISTS identity CASCADE');
    console.log('Database reset complete. Run db:migrate to recreate.');
  } catch (err) {
    console.error('Reset failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
