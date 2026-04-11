import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY_HEX = process.env.VAULT_SECRET ?? "";

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error("VAULT_SECRET must be a 32-byte hex string (64 chars)");
  }
  return Buffer.from(KEY_HEX, "hex");
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns "iv:authTag:ciphertext" (all hex).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a string produced by encrypt().
 * Returns empty string on any error (invalid key, tampered data, etc.)
 */
export function decrypt(encoded: string): string {
  if (!encoded) return "";
  try {
    const parts = encoded.split(":");
    if (parts.length !== 3) return "";
    const [ivHex, authTagHex, encHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encData = Buffer.from(encHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encData).toString("utf8") + decipher.final("utf8");
  } catch {
    return "";
  }
}
