const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length
const AUTH_TAG_LENGTH = 16;

/**
 * Encryption service — AES-256-GCM for API key vault.
 * Per SECURITY.md §3: encrypted at rest, decrypted only in-memory at call time.
 * ENCRYPTION_KEY must be 32 bytes (64 hex chars).
 */
const encryptionService = {
  /**
   * Encrypt plaintext. Returns a single string: iv:authTag:ciphertext (all hex-encoded).
   * This format is stored in the `encrypted_key` column.
   */
  encrypt(plaintext) {
    const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Store as iv:authTag:ciphertext for easy parsing
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  },

  /**
   * Decrypt an encrypted string (iv:authTag:ciphertext format).
   * Used ONLY by workers at LLM-call time — never exposed via API.
   */
  decrypt(encryptedStr) {
    const [ivHex, authTagHex, ciphertext] = encryptedStr.split(':');
    const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  },
};

module.exports = encryptionService;
