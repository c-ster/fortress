import {
  pgSchema,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  customType,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// Tier 4: Identity data — separate from financial data
export const identitySchema = pgSchema('identity');

export const users = identitySchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  milEmail: text('mil_email'),
  milVerified: boolean('mil_verified').notNull().default(false),
  payGrade: text('pay_grade'),
  mfaSecretEncrypted: bytea('mfa_secret_encrypted'),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Tier 2: Encrypted financial data — server cannot decrypt
export const financialSchema = pgSchema('financial');

export const encryptedSnapshots = financialSchema.table('encrypted_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  ciphertext: bytea('ciphertext').notNull(),
  iv: bytea('iv').notNull(),
  authTag: bytea('auth_tag').notNull(),
  salt: bytea('salt').notNull(),
  iterations: integer('iterations').notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Refresh tokens for JWT rotation
export const refreshTokens = identitySchema.table('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  deviceFingerprint: text('device_fingerprint'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Homefront grants — spouse access to encrypted financial snapshot
export const homefrontGrants = identitySchema.table('homefront_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  spouseEmail: text('spouse_email').notNull(),
  inviteToken: text('invite_token').notNull().unique(),
  permission: text('permission').notNull().default('read'),
  spouseUserId: uuid('spouse_user_id').references(() => users.id),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Tier 5: Black Box — encrypted emergency sheet for next-of-kin
export const blackBoxSnapshots = financialSchema.table('black_box_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  ciphertext: bytea('ciphertext').notNull(),
  iv: bytea('iv').notNull(),
  authTag: bytea('auth_tag').notNull(),
  salt: bytea('salt').notNull(),
  iterations: integer('iterations').notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  accessTokenHash: text('access_token_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Device fingerprints for zero-trust device tracking
export const devices = identitySchema.table('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  fingerprintHash: text('fingerprint_hash').notNull(),
  label: text('label'),
  lastIp: text('last_ip'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  trusted: boolean('trusted').notNull().default(false),
});

// Email verification codes
export const verificationCodes = identitySchema.table('verification_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  email: text('email').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
