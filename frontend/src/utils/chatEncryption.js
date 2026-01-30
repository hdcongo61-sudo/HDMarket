/**
 * Client-side E2E Encryption for Chat Messages
 * Uses Web Crypto API for browser-based encryption
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Generate a random encryption key
 * @returns {Promise<CryptoKey>} Encryption key
 */
export const generateKey = async () => {
  return await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
};

/**
 * Export key to base64 string for storage/transmission
 * @param {CryptoKey} key - Encryption key
 * @returns {Promise<string>} Base64 encoded key
 */
export const exportKey = async (key) => {
  const exported = await crypto.subtle.exportKey('raw', key);
  const buffer = new Uint8Array(exported);
  return btoa(String.fromCharCode(...buffer));
};

/**
 * Import key from base64 string
 * @param {string} base64Key - Base64 encoded key
 * @returns {Promise<CryptoKey>} Encryption key
 */
export const importKey = async (base64Key) => {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return await crypto.subtle.importKey(
    'raw',
    bytes,
    {
      name: ALGORITHM,
      length: KEY_LENGTH
    },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt text using AES-GCM
 * @param {string} text - Plain text to encrypt
 * @param {CryptoKey} key - Encryption key
 * @returns {Promise<Object>} { encrypted, iv, tag } - All base64 encoded
 */
export const encrypt = async (text, key) => {
  if (!text) return null;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv
    },
    key,
    data
  );
  
  // Extract tag (last 16 bytes in GCM)
  const encryptedArray = new Uint8Array(encrypted);
  const tag = encryptedArray.slice(-16);
  const ciphertext = encryptedArray.slice(0, -16);
  
  return {
    encrypted: btoa(String.fromCharCode(...ciphertext)),
    iv: btoa(String.fromCharCode(...iv)),
    tag: btoa(String.fromCharCode(...tag))
  };
};

/**
 * Decrypt text using AES-GCM
 * @param {Object} encryptedData - { encrypted, iv, tag }
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<string>} Decrypted plain text
 */
export const decrypt = async (encryptedData, key) => {
  if (!encryptedData || !encryptedData.encrypted) return null;
  
  try {
    // Decode base64 strings
    const ciphertext = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    const tag = Uint8Array.from(atob(encryptedData.tag), c => c.charCodeAt(0));
    
    // Combine ciphertext and tag
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      key,
      combined
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Generate or retrieve shared secret for chat
 * This creates a key that can be shared between user and support
 * In production, this should use a proper key exchange protocol
 * @param {string} userId - User ID
 * @returns {Promise<{key: CryptoKey, keyString: string}>} Shared key
 */
export const getSharedSecret = async (userId) => {
  const storageKey = `hdmarket_chat_key_${userId}`;
  
  try {
    // Try to retrieve existing key from localStorage
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const key = await importKey(stored);
      return { key, keyString: stored };
    }
  } catch (error) {
    console.error('Error loading stored key:', error);
  }
  
  // Generate new key
  const key = await generateKey();
  const keyString = await exportKey(key);
  
  // Store for future use
  try {
    localStorage.setItem(storageKey, keyString);
  } catch (error) {
    console.error('Error storing key:', error);
  }
  
  return { key, keyString };
};
