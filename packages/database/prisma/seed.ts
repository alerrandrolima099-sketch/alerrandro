/**
 * Seed inicial do banco.
 * Cria: 1 tenant admin (interno), 1 tenant cliente de teste,
 * usuário admin + usuário cliente, 1 instância mock,
 * 3 senders (pool de números) e 1 automação de demonstração.
 *
 * Rodar: npm run seed --workspace=@whatsapp-saas/database
 */
import { PrismaClient, UserRole, InstanceStatus, MessagingProviderType, SenderStatus, AutomationStatus, AutomationNodeType } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // --- Tenant administrativo interno (dono da plataforma) ---
  const adminTenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Plataforma (Admin)",
      status: "ACTIVE",
    },
  });

  const adminPasswordHash = await argon2.hash("Admin@12345");
  await prisma.user.upsert({
    where: { email: "admin@platform.local" },
    update: {},
    create: {
      tenantId: adminTenant.id,
      name: "Administrador",
      email: "admin@platform.local",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  // --- Tenant de cliente de teste ---
  const clientTenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Cliente Demo Ltda",
      status: "ACTIVE",
    },
  });

  const clientPasswordHash = await argon2.hash("Cliente@12345");
  await prisma.user.upsert({
    where: { email: "cliente@demo.local" },
    update: {},
    create: {
      tenantId: clientTenant.id,
      name: "Usuário Demo",
      email: "cliente@demo.local",
      passwordHash: clientPasswordHash,
      role: UserRole.CLIENT,
    },
  });

  // --- Instância mock do cliente de teste ---
  const instance = await prisma.instance.create({
    data: {
      tenantId: clientTenant.id,
      name: "Instância Principal",
      phoneNumber: "+5511900000000",
      status: InstanceStatus.DISCONNECTED,
      provider: MessagingProviderType.MOCK,
    },
  });

  // --- 3 números do pool de atendimento (Message Sender Pool) ---
  const senderNumbers = ["+5511900000001", "+5511900000002", "+5511900000003"];
  for (let i = 0; i < senderNumbers.length; i++) {
    await prisma.sender.create({
      data: {
        instanceId: instance.id,
        name: `Número 0${i + 1}`,
        phoneNumber: senderNumbers[i],
        status: SenderStatus.AVAILABLE,
        capacity: 1,
        isActive: true,
      },
    });
  }

  // --- Automação de demonstração (fluxo simples de atendimento) ---
  const automation = await prisma.automation.create({
    data: {
      tenantId: clientTenant.id,
      name: "Fluxo de Boas-vindas (Demo)",
      status: AutomationStatus.DRAFT,
    },
  });

  const startNode = await prisma.automationNode.create({
    data: {
      automationId: automation.id,
      type: AutomationNodeType.START,
      position: { x: 0, y: 0 },
      config: {},
    },
  });

  const sendMsgNode = await prisma.automationNode.create({
    data: {
      automationId: automation.id,
      type: AutomationNodeType.SEND_MESSAGE,
      position: { x: 0, y: 150 },
      config: { text: "Olá! Obrigado por autorizar nosso contato. Como podemos ajudar?" },
    },
  });

  const waitReplyNode = await prisma.automationNode.create({
    data: {
      automationId: automation.id,
      type: AutomationNodeType.WAIT_FOR_REPLY,
      position: { x: 0, y: 300 },
      config: { timeoutSec: 300 },
    },
  });

  const endNode = await prisma.automationNode.create({
    data: {
      automationId: automation.id,
      type: AutomationNodeType.END,
      position: { x: 0, y: 450 },
      config: {},
    },
  });

  await prisma.automationNode.update({ where: { id: startNode.id }, data: { nextNodeIds: [sendMsgNode.id] } });
  await prisma.automationNode.update({ where: { id: sendMsgNode.id }, data: { nextNodeIds: [waitReplyNode.id] } });
  await prisma.automationNode.update({ where: { id: waitReplyNode.id }, data: { nextNodeIds: [endNode.id] } });

  console.log("Seed concluído.");
  console.log("Login admin:   admin@platform.local / Admin@12345");
  console.log("Login cliente: cliente@demo.local / Cliente@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
