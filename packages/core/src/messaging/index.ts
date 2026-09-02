import { MessagingProvider } from "./MessagingProvider";
import { MockProvider } from "./MockProvider";
import { WhatsAppCloudProvider } from "./WhatsAppCloudProvider";
import { BaileysProvider } from "./BaileysProvider";
import { env } from "@whatsapp-saas/config";

type ProviderType = "MOCK" | "WHATSAPP_CLOUD_API" | "WHATSAPP_QR";

// Cache de singletons por tipo - cada provedor mantém seu próprio estado
// (ex: BaileysProvider guarda sockets vivos em memória), então instâncias de
// tipos diferentes nunca podem compartilhar o mesmo singleton.
const instances = new Map<ProviderType, MessagingProvider>();

function buildProvider(type: ProviderType): MessagingProvider {
  switch (type) {
    case "WHATSAPP_CLOUD_API":
      return new WhatsAppCloudProvider();
    case "WHATSAPP_QR":
      return new BaileysProvider();
    case "MOCK":
    default:
      return new MockProvider();
  }
}

/**
 * Factory - retorna o provedor correto para o tipo pedido.
 *
 * `providerType` deve vir de `Instance.provider` sempre que a operação for
 * relativa a uma instância específica (connect/disconnect/enviar mensagem),
 * já que cada instância pode usar um provedor diferente (ex: uma instância
 * MOCK e outra WHATSAPP_QR ao mesmo tempo no mesmo tenant).
 *
 * Quando omitido, cai para env.MESSAGING_PROVIDER (comportamento antigo,
 * usado só em pontos que ainda não têm uma instância no contexto).
 */
export function getMessagingProvider(providerType?: ProviderType): MessagingProvider {
  const type = providerType ?? (env.MESSAGING_PROVIDER as ProviderType);

  const cached = instances.get(type);
  if (cached) return cached;

  const created = buildProvider(type);
  instances.set(type, created);
  return created;
}

/** Acesso direto ao singleton do BaileysProvider - usado pelo worker para
 * retomar sessões WHATSAPP_QR persistidas ao subir o processo. */
export function getBaileysProvider(): BaileysProvider {
  return getMessagingProvider("WHATSAPP_QR") as BaileysProvider;
}

export * from "./MessagingProvider";
