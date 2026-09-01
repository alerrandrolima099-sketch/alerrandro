import crypto from "crypto";
import { env } from "@whatsapp-saas/config";

// Criptografia simétrica (AES-256-GCM) para credenciais sensíveis de provedores
// (tokens de instância) armazenadas em Instance.providerConfig.
// Nunca logar o valor em texto puro (ver regra de segurança da seção 24).

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  return crypto.createHash("sha256").update(key).digest(); // normaliza para 32 bytes
}

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
