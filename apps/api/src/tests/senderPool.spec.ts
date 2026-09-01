import { prisma } from "../lib/prisma";
import { senderPoolService } from "../modules/senderPool/senderPool.service";

/**
 * Garante que o pool de números nunca entrega o mesmo sender para duas
 * aquisições concorrentes (seção 7 - mecanismo de lock via Redis).
 */
describe("Sender Pool locking", () => {
  let tenantId: string;
  let instanceId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: `SenderPoolTest_${Date.now()}` } });
    tenantId = tenant.id;

    const instance = await prisma.instance.create({
      data: { tenantId, name: "Instância Teste", status: "CONNECTED" },
    });
    instanceId = instance.id;

    await prisma.sender.create({
      data: { instanceId, name: "Número Único", phoneNumber: "+5511999990000", status: "AVAILABLE" },
    });
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("apenas uma de duas aquisições concorrentes deve obter o sender único", async () => {
    const [first, second] = await Promise.all([
      senderPoolService.acquireSender(tenantId, instanceId),
      senderPoolService.acquireSender(tenantId, instanceId),
    ]);

    const successCount = [first, second].filter((r) => r !== null).length;
    expect(successCount).toBe(1);
  });
});
