import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";

/**
 * Teste crítico de isolamento multi-tenant (seção 21 e 29):
 * Cliente A NUNCA pode acessar instâncias/contatos de Cliente B, mesmo
 * conhecendo o ID do recurso.
 *
 * Requer um banco de teste real (DATABASE_URL apontando para Postgres) e
 * Redis disponíveis - ver README > "Rodando os testes".
 */
describe("Multi-tenancy isolation", () => {
  const app = createApp();
  let tokenA: string;
  let tokenB: string;
  let instanceIdB: string;

  beforeAll(async () => {
    const emailA = `tenantA_${Date.now()}@test.local`;
    const emailB = `tenantB_${Date.now()}@test.local`;

    await request(app).post("/auth/register").send({ tenantName: "Tenant A", name: "User A", email: emailA, password: "Password123" });
    await request(app).post("/auth/register").send({ tenantName: "Tenant B", name: "User B", email: emailB, password: "Password123" });

    const loginA = await request(app).post("/auth/login").send({ email: emailA, password: "Password123" });
    const loginB = await request(app).post("/auth/login").send({ email: emailB, password: "Password123" });

    tokenA = loginA.body.accessToken;
    tokenB = loginB.body.accessToken;

    const createInstanceB = await request(app)
      .post("/instances")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Instância do Tenant B" });

    instanceIdB = createInstanceB.body.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("tenant A não consegue ver a instância do tenant B por GET direto", async () => {
    const res = await request(app).get(`/instances/${instanceIdB}`).set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it("tenant A não consegue listar instâncias e ver dados do tenant B", async () => {
    const res = await request(app).get("/instances").set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(instanceIdB);
  });

  it("tenant A não consegue desconectar a instância do tenant B", async () => {
    const res = await request(app).post(`/instances/${instanceIdB}/disconnect`).set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });
});
