import crypto from "node:crypto";

function key(): Buffer | null {
  const raw = process.env.VAULT_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  return buf.length === 32 ? buf : null;
}

export const vaultReady = () => key() !== null;

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
