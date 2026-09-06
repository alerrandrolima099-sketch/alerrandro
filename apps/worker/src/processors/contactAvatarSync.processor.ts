import { Worker, Job } from "bullmq";
import { redisConnection, getMessagingProvider } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { ContactAvatarSyncJobData } from "@whatsapp-saas/types";

/**
 * Consome contactAvatarSyncQueue (seção 44): busca a foto de perfil do
 * WhatsApp de um lead recém-criado (ver handleInboundMessage.ts) e salva em
 * Contact.profilePicUrl, pra aparecer na barra lateral de Conversas em vez
 * do círculo com iniciais.
 *
 * Best-effort de propósito: nem todo contato tem foto, e a privacidade do
 * WhatsApp ("Quem pode ver minha foto de perfil") pode bloquear a busca -
 * nesses casos o campo simplesmente continua nulo e o front-end já sabe
 * cair pro círculo com iniciais (mesmo padrão adotado para a foto de perfil
 * da própria instância, ver BaileysProvider/instances/page.tsx).
 *
 * Só suportado de fato para instâncias WHATSAPP_QR (a Cloud API oficial não
 * tem endpoint equivalente) - para os demais provedores getContactProfilePicture
 * sempre retorna null, então o job só termina como "skipped".
 */
export function registerContactAvatarSyncProcessor() {
  const worker = new Worker<ContactAvatarSyncJobData>(
    QUEUE_NAMES.CONTACT_AVATAR_SYNC,
    async (job: Job<ContactAvatarSyncJobData>) => {
      const { instanceId, contactId } = job.data;

      const [instance, contact] = await Promise.all([
        prisma.instance.findUnique({ where: { id: instanceId } }),
        prisma.contact.findUnique({ where: { id: contactId } }),
      ]);
      if (!instance || !contact) return { skipped: true, reason: "not_found" };

      // Se o contato já tem uma foto salva (ex: job duplicado, ou reprocessado
      // depois de já ter tido sucesso numa tentativa anterior), não há nada a
      // fazer - evita uma chamada de rede desnecessária ao WhatsApp.
      if (contact.profilePicUrl) return { skipped: true, reason: "already_has_picture" };

      const provider = getMessagingProvider(instance.provider);
      const profilePicUrl = await provider.getContactProfilePicture({ instanceId, phone: contact.phone });
      if (!profilePicUrl) return { skipped: true, reason: "no_picture" };

      await prisma.contact.update({ where: { id: contactId }, data: { profilePicUrl } });
      return { contactId, updated: true };
    },
    { connection: redisConnection, concurrency: 3 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[contactAvatarSync.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
