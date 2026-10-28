import crypto from "node:crypto";

// Encrypts the shared-login passwords before they reach the database (AES-256-GCM).
// The key is VAULT_KEY: 32 random bytes, base64. It lives ONLY in the server's environment
// (Railway Variables + backend/.env), so a copy of the database alone reveals nothing.
// GCM also detects tampering: a changed ciphertext fails to decrypt instead of giving garbage.
//
// Make a key once:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Use the SAME key everywhere: anything encrypted with one key can't be read with another.

function key(): Buffer | null {
  const raw = process.env.VAULT_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  return buf.length === 32 ? buf : null;
}

export const vaultReady = () => key() !== null;

// "secret" → "v1:<iv>:<tag>:<data>" (all base64). A fresh random iv every time,
// so the same password stored twice never looks the same.
export function encrypt(plain: string): string {
  const k = key();
  if (!k) throw new Error("VAULT_KEY is not set");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(stored: string): string {
  const k = key();
  if (!k) throw new Error("VAULT_KEY is not set");
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1") throw new Error("Unknown vault format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
