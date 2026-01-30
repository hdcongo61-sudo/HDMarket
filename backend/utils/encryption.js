import crypto from 'crypto';

/**
 * E2E Encryption Utility for Chat Messages
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Generate a random encryption key
 * @returns {Buffer} 32-byte key
 */
export const generateKey = () => {
  return crypto.randomBytes(KEY_LENGTH);
};

/**
 * Derive key from password using PBKDF2
 * @param {string} password - User password or shared secret
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived key
 */
export const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
};

/**
 * Encrypt text using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @param {Buffer} key - Encryption key (32 bytes)
 * @returns {Object} { encrypted, iv, salt, tag } - All base64 encoded
 */
export const encrypt = (text, key) => {
  if (!text) return null;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Use provided key or derive from password
  const encryptionKey = key || generateKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    tag: tag.toString('base64'),
    key: encryptionKey.toString('base64') // Store key for decryption
  };
};

/**
 * Decrypt text using AES-256-GCM
 * @param {Object} encryptedData - { encrypted, iv, salt, tag, key }
 * @returns {string} Decrypted plain text
 */
export const decrypt = (encryptedData) => {
  if (!encryptedData || !encryptedData.encrypted) return null;
  
  try {
    const { encrypted, iv, tag, key } = encryptedData;
    
    if (!iv || !tag || !key) {
      throw new Error('Missing encryption parameters');
    }
    
    const ivBuffer = Buffer.from(iv, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');
    const keyBuffer = Buffer.from(key, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);
    decipher.setAuthTag(tagBuffer);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Generate a shared secret for chat encryption
 * This would typically be exchanged via a secure key exchange protocol
 * For now, we'll use a user-specific secret derived from their session
 * @param {string} userId - User ID
 * @param {string} sessionToken - Session token
 * @returns {Buffer} Shared secret key
 */
export const generateSharedSecret = (userId, sessionToken) => {
  const combined = `${userId}:${sessionToken}`;
  const salt = crypto.createHash('sha256').update(combined).digest();
  return crypto.pbkdf2Sync(combined, salt, ITERATIONS, KEY_LENGTH, 'sha256');
};
