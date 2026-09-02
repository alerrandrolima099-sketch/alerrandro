import { Worker, Job } from "bullmq";
import { redisConnection, getMessagingProvider, writeLog } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { GroupJoinJobData } from "@whatsapp-saas/types";

/**
 * Consome groupJoinQueue: faz UMA instância entrar em UM grupo via link de
 * convite (seção 15/38 - "Entrar com todos os números"). Cada job já chega
 * aqui com um delay escalonado (ver groups.service.ts joinAll) - este
 * processor só executa a tentativa individual quando o job "acorda", não
 * precisa se preocupar com o espaçamento entre as instâncias do lote.
 *
 * Roda concurrency: 1 de propósito, igual ao instanceConnect.processor -
 * evita que duas tentativas rodem no mesmo instante mesmo que os delays
 * calculados coincidam.
 */
export function registerGroupJoinProcessor() {
  const worker = new Worker<GroupJoinJobData>(
    QUEUE_NAMES.GROUP_JOIN,
    async (job: Job<GroupJoinJobData>) => {
      const { groupJoinId } = job.data;

      const groupJoin = await prisma.groupJoin.findUnique({
        where: { id: groupJoinId },
        include: { group: true, instance: true },
      });
      if (!groupJoin) return { skipped: true, reason: "group_join_not_found" };

      try {
        await prisma.groupJoin.update({ where: { id: groupJoinId }, data: { status: "JOINING" } });

        const inviteCode = groupJoin.group.inviteLink.split("/").filter(Boolean).pop() ?? "";
        const provider = getMessagingProvider(groupJoin.instance.provider);
        const result = await provider.joinGroup({ instanceId: groupJoin.instanceId, inviteCode });

        await prisma.groupJoin.update({
          where: { id: groupJoinId },
          data: {
            status: result.status === "JOINED" ? "JOINED" : "FAILED",
            error: result.error ?? null,
            joinedAt: result.status === "JOINED" ? new Date() : null,
          },
        });

        await writeLog({
          tenantId: groupJoin.tenantId,
          action: "GROUP_JOIN_ATTEMPT",
          resource: "group",
          resourceId: groupJoin.groupId,
          metadata: { instanceId: groupJoin.instanceId, status: result.status, error: result.error },
        });

        return { groupJoinId, status: result.status };
      } catch (err: any) {
        // Não deixa a linha presa em JOINING pra sempre se algo inesperado
        // (ex: falha transitória do banco) acontecer no meio do processo.
        await prisma.groupJoin
          .update({
            where: { id: groupJoinId },
            data: { status: "FAILED", error: err?.message ?? "Erro inesperado ao tentar entrar no grupo." },
          })
          .catch(() => {
            /* melhor esforço - não deixa isso derrubar o processo */
          });
        return { groupJoinId, status: "FAILED", error: err?.message };
      }
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[groupJoin.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
