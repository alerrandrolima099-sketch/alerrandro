import { MessagingProvider } from "./MessagingProvider";
import { MockProvider } from "./MockProvider";
import { WhatsAppCloudProvider } from "./WhatsAppCloudProvider";
import { env } from "@whatsapp-saas/config";

let instance: MessagingProvider | null = null;

/** Factory - decide qual provedor usar com base em MESSAGING_PROVIDER (.env). */
export function getMessagingProvider(): MessagingProvider {
  if (instance) return instance;

  switch (env.MESSAGING_PROVIDER) {
    case "WHATSAPP_CLOUD_API":
      instance = new WhatsAppCloudProvider();
      break;
    case "MOCK":
    default:
      instance = new MockProvider();
      break;
  }
  return instance;
}

export * from "./MessagingProvider";
