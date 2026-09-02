import { MessagingProvider } from "./MessagingProvider";
/** Factory - decide qual provedor usar com base em MESSAGING_PROVIDER (.env). */
export declare function getMessagingProvider(): MessagingProvider;
export * from "./MessagingProvider";
