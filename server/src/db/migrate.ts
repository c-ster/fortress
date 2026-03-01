import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://localhost:5432/fortress_dev';

const pool = new pg.Pool({ connectionString: databaseUrl });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create schemas
    await client.query('CREATE SCHEMA IF NOT EXISTS identity');
    await client.query('CREATE SCHEMA IF NOT EXISTS financial');

    // Enable uuid-ossp
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    // Tier 4: Identity — users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS identity.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        mil_email TEXT,
        mil_verified BOOLEAN NOT NULL DEFAULT FALSE,
        pay_grade TEXT,
        mfa_secret_encrypted BYTEA,
        mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Tier 4: Identity — refresh tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS identity.refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Tier 4: Identity — verification codes
    await client.query(`
      CREATE TABLE IF NOT EXISTS identity.verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        email TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Tier 4: Identity — device fingerprints for zero-trust tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS identity.devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
        fingerprint_hash TEXT NOT NULL,
        label TEXT,
        last_ip TEXT,
        last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        trusted BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE(user_id, fingerprint_hash)
      )
    `);

    // Tier 2: Encrypted financial data — server never decrypts
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial.encrypted_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
        ciphertext BYTEA NOT NULL,
        iv BYTEA NOT NULL,
        auth_tag BYTEA NOT NULL,
        salt BYTEA NOT NULL,
        iterations INTEGER NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    // Add session hardening columns to refresh_tokens (idempotent)
    await client.query(`
      ALTER TABLE identity.refresh_tokens
        ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
        ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON identity.refresh_tokens(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON identity.verification_codes(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_encrypted_snapshots_user_id ON financial.encrypted_snapshots(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_user_id ON identity.devices(user_id)
    `);

    await client.query('COMMIT');
    console.log('Migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
