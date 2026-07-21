// cryptoHelpers.ts

// Convert string to ArrayBuffer
const strToBuf = (str: string): Uint8Array => new TextEncoder().encode(str);

// Convert ArrayBuffer to string
const bufToStr = (buf: ArrayBuffer): string => new TextDecoder().decode(buf);

// Base64 helpers
export const base64ToBytes = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), c => c.charCodeAt(0));

export const bytesToBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

interface EncryptedData {
  ciphertext: string; // base64
  iv: string;         // base64
  salt: string;       // base64
}

/**
 * Encrypts a string using AES-GCM with a derived key.
 * @param text The plaintext string to encrypt.
 * @param keyString A passphrase used to derive the encryption key.
 * @returns EncryptedData {ciphertext, iv, salt}
 */
export async function encrypt(text: string, keyString: string): Promise<EncryptedData> {
  // v2 Fast Encryption
  const hashBuffer = await crypto.subtle.digest('SHA-256', strToBuf(keyString));
  const key = await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    strToBuf(text)
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64(iv),
    salt: "v2",
  };
}

/**
 * Decrypts AES-GCM encrypted data using a passphrase-derived key.
 * @param encrypted EncryptedData (ciphertext, iv, salt as base64)
 * @param keyString The passphrase to derive the key for decryption.
 * @returns The decrypted plaintext string.
 */
export async function decrypt(encrypted: EncryptedData, keyString: string): Promise<string> {
  const { ciphertext, iv, salt } = encrypted;

  if (salt === "v2") {
    // v2 Fast Decryption
    const hashBuffer = await crypto.subtle.digest('SHA-256', strToBuf(keyString));
    const derivedKey = await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(iv) },
      derivedKey,
      base64ToBytes(ciphertext)
    );
    return bufToStr(decryptedBuffer);
  }

  // Legacy v1 PBKDF2 decryption
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    strToBuf(keyString),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(salt),
      iterations: 150000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(iv),
    },
    derivedKey,
    base64ToBytes(ciphertext)
  );

  return bufToStr(decryptedBuffer);
}
