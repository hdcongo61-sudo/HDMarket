import crypto from 'crypto';
import { encrypt, decrypt } from '../../utils/encryption.js';

// utils/encryption.js's encrypt() returns the AES key alongside the
// ciphertext (by design — it's built for ephemeral E2E chat keys, where the
// key isn't meant to be secret from the DB). That's wrong for "encrypt
// provider credentials at rest": the whole point is that reading the DB
// alone must NOT be enough to decrypt. So here we derive a fixed, DB-external
// key from SOCIAL_CREDENTIAL_ENCRYPTION_KEY (never persisted) and always
// re-supply it ourselves — only {encrypted, iv, salt, tag} ever get stored.
const deriveServerKey = () => {
  const secret = process.env.SOCIAL_CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * @param {object} credentials - plain object (e.g. { accessToken, appSecret })
 * @returns {object|null} { encrypted, iv, salt, tag } — safe to store in
 *   SocialConnection.credentialsEncrypted. null if the server key isn't
 *   configured (caller should refuse to persist credentials in that case).
 */
export const encryptCredentials = (credentials) => {
  const key = deriveServerKey();
  if (!key) return null;
  const { key: _discardedKey, ...rest } = encrypt(JSON.stringify(credentials || {}), key) || {};
  return rest;
};

/**
 * @param {object} stored - { encrypted, iv, salt, tag } from Mongo
 * @returns {object|null} the original plain credentials object, or null on
 *   any failure (missing server key, corrupt data, tampering).
 */
export const decryptCredentials = (stored) => {
  const key = deriveServerKey();
  if (!key || !stored?.encrypted) return null;
  const plain = decrypt({ ...stored, key: key.toString('base64') });
  if (!plain) return null;
  try {
    return JSON.parse(plain);
  } catch {
    return null;
  }
};
