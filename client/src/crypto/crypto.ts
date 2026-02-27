import type { EncryptedPayload } from '@fortress/types';

// AES-256-GCM constants
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 12 bytes — GCM standard
const SALT_LENGTH = 32; // 32 bytes
const AUTH_TAG_LENGTH = 16; // 128-bit GCM auth tag
const DEFAULT_ITERATIONS = 600_000; // OWASP 2023 recommendation for PBKDF2-SHA256
const CURRENT_SCHEMA_VERSION = 1;

export class DecryptionError extends Error {
  constructor(message = 'Decryption failed — wrong passphrase or corrupted data') {
    super(message);
    this.name = 'DecryptionError';
  }
}

// --- Base64 helpers ---

function toBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Key derivation ---

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // non-extractable — key never leaves SubtleCrypto
    ['encrypt', 'decrypt'],
  );
}

// --- Encrypt ---

export async function encrypt(
  plaintext: string,
  passphrase: string,
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt, DEFAULT_ITERATIONS);

  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  // Web Crypto appends the 16-byte auth tag to the ciphertext
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - AUTH_TAG_LENGTH);
  const authTag = encryptedBytes.slice(encryptedBytes.length - AUTH_TAG_LENGTH);

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    authTag: toBase64(authTag),
    salt: toBase64(salt),
    iterations: DEFAULT_ITERATIONS,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

// --- Decrypt ---

export async function decrypt(
  payload: EncryptedPayload,
  passphrase: string,
): Promise<string> {
  if (payload.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new DecryptionError(
      `Unsupported schema version: ${payload.schemaVersion}`,
    );
  }

  let ciphertextBytes: Uint8Array;
  let iv: Uint8Array;
  let authTag: Uint8Array;
  let salt: Uint8Array;

  try {
    ciphertextBytes = fromBase64(payload.ciphertext);
    iv = fromBase64(payload.iv);
    authTag = fromBase64(payload.authTag);
    salt = fromBase64(payload.salt);
  } catch {
    throw new DecryptionError('Malformed payload — invalid Base64 encoding');
  }

  // Validate expected sizes
  if (iv.length !== IV_LENGTH) {
    throw new DecryptionError(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new DecryptionError(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
  }
  if (salt.length !== SALT_LENGTH) {
    throw new DecryptionError(`Invalid salt length: expected ${SALT_LENGTH}, got ${salt.length}`);
  }

  // Recombine ciphertext + authTag (Web Crypto expects them concatenated)
  const combined = new Uint8Array(ciphertextBytes.length + authTag.length);
  combined.set(ciphertextBytes);
  combined.set(authTag, ciphertextBytes.length);

  const key = await deriveKey(passphrase, salt, payload.iterations);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv as BufferSource },
      key,
      combined,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new DecryptionError();
  }
}
