/**
 * src/lib/crypto/file-encryption.ts
 *
 * Zero-knowledge file encryption using Web Crypto API (AES-GCM).
 *
 * Design:
 *  - Each file gets a fresh random 256-bit Data Encryption Key (DEK).
 *  - The DEK is wrapped (encrypted) with a Key Encryption Key (KEK)
 *    derived from the user's secretKey via SHA-256 — the same mechanism
 *    used in crypto-helper.ts for notes (v2 path).
 *  - Only ciphertext is uploaded to Supabase Storage.
 *  - { encrypted_dek, dek_iv, file_iv, original_name, original_mime } are
 *    stored in the file_metadata Postgres table.
 *  - The server never sees raw file bytes or raw DEKs.
 */

const ALG = "AES-GCM";
const KEY_LEN = 256;
const IV_LEN = 12; // 96-bit IV — standard for AES-GCM

// ─── base64 helpers ───────────────────────────────────────────────────────────

export const toBase64 = (bytes: Uint8Array | ArrayBuffer): string => {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const fromBase64 = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const randomIV = (): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(IV_LEN));

// ─── Key Encryption Key (KEK) derivation ────────────────────────────────────
//
// Mirrors the v2 path in crypto-helper.ts: SHA-256(secretKey) → AES-GCM key.
// No extra password prompt is needed.

async function deriveKEK(secretKey: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secretKey)
  );
  return crypto.subtle.importKey("raw", raw, { name: ALG }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// ─── DEK wrapping / unwrapping ───────────────────────────────────────────────

export interface WrappedDEK {
  /** base64 — AES-GCM ciphertext of the raw 256-bit DEK */
  encryptedDek: string;
  /** base64 — IV used when wrapping the DEK */
  dekIv: string;
}

/** Encrypt the raw DEK with the KEK. Safe to store in Postgres. */
export async function wrapDEK(
  dek: CryptoKey,
  secretKey: string
): Promise<WrappedDEK> {
  const kek = await deriveKEK(secretKey);
  const rawDek = await crypto.subtle.exportKey("raw", dek);
  const iv = randomIV();
  const encryptedDek = await crypto.subtle.encrypt(
    { name: ALG, iv },
    kek,
    rawDek
  );
  return {
    encryptedDek: toBase64(new Uint8Array(encryptedDek)),
    dekIv: toBase64(iv),
  };
}

/** Recover the raw DEK from its wrapped form using the KEK. */
export async function unwrapDEK(
  wrapped: WrappedDEK,
  secretKey: string
): Promise<CryptoKey> {
  const kek = await deriveKEK(secretKey);
  const rawDek = await crypto.subtle.decrypt(
    { name: ALG, iv: fromBase64(wrapped.dekIv) },
    kek,
    fromBase64(wrapped.encryptedDek)
  );
  return crypto.subtle.importKey("raw", rawDek, { name: ALG }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// ─── File encryption ─────────────────────────────────────────────────────────

export interface EncryptedFileResult {
  /** Upload this blob to Supabase Storage. */
  cipherBlob: Blob;
  /** base64 IV — store as file_iv in file_metadata. */
  fileIv: string;
  /** Wrapped DEK — store encrypted_dek + dek_iv in file_metadata. */
  wrappedDEK: WrappedDEK;
}

/**
 * Encrypt a browser File in-memory.
 * Suitable for files up to ~50 MB. For larger files, use chunked streaming.
 */
export async function encryptFile(
  file: File,
  secretKey: string
): Promise<EncryptedFileResult> {
  const dek = await crypto.subtle.generateKey(
    { name: ALG, length: KEY_LEN },
    true /* exportable so we can wrap it */,
    ["encrypt", "decrypt"]
  );

  const iv = randomIV();
  const plaintext = await file.arrayBuffer();

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALG, iv, tagLength: 128 },
    dek,
    plaintext
  );

  const wrappedDEK = await wrapDEK(dek, secretKey);

  return {
    cipherBlob: new Blob([ciphertext], { type: "application/octet-stream" }),
    fileIv: toBase64(iv),
    wrappedDEK,
  };
}

// ─── File decryption helpers ─────────────────────────────────────────────────

/**
 * Decrypt an encrypted file blob and trigger a browser download of the
 * original plaintext file.
 */
export async function decryptAndDownload(
  cipherBlob: Blob,
  wrapped: WrappedDEK,
  fileIv: string,
  originalName: string,
  originalMime: string,
  secretKey: string
): Promise<void> {
  const dek = await unwrapDEK(wrapped, secretKey);
  const ciphertext = await cipherBlob.arrayBuffer();
  const plaintext = await crypto.subtle.decrypt(
    { name: ALG, iv: fromBase64(fileIv), tagLength: 128 },
    dek,
    ciphertext
  );

  const plainBlob = new Blob([plaintext], {
    type: originalMime || "application/octet-stream",
  });
  const url = URL.createObjectURL(plainBlob);

  const a = document.createElement("a");
  a.href = url;
  a.download = originalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Give the browser time to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Decrypt an encrypted file blob and return an object URL for in-browser
 * preview (e.g. <img src={url} />).
 *
 * The caller is responsible for calling URL.revokeObjectURL() when done.
 */
export async function decryptToObjectURL(
  cipherBlob: Blob,
  wrapped: WrappedDEK,
  fileIv: string,
  originalMime: string,
  secretKey: string
): Promise<string> {
  const dek = await unwrapDEK(wrapped, secretKey);
  const ciphertext = await cipherBlob.arrayBuffer();
  const plaintext = await crypto.subtle.decrypt(
    { name: ALG, iv: fromBase64(fileIv), tagLength: 128 },
    dek,
    ciphertext
  );

  const plainBlob = new Blob([plaintext], {
    type: originalMime || "application/octet-stream",
  });
  return URL.createObjectURL(plainBlob);
}

