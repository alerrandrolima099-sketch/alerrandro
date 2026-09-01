import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";

describe("Auth flow", () => {
  const app = createApp();
  const email = `auth_test_${Date.now()}@test.local`;
  const password = "SenhaForte123";

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registra um novo usuário/tenant", async () => {
    const res = await request(app).post("/auth/register").send({ tenantName: "Empresa Teste", name: "Fulano", email, password });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBeDefined();
    expect(res.body.tenantId).toBeDefined();
  });

  it("rejeita login com senha errada", async () => {
    const res = await request(app).post("/auth/login").send({ email, password: "senhaErrada" });
    expect(res.status).toBe(401);
  });

  it("realiza login com sucesso e retorna tokens", async () => {
    const res = await request(app).post("/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it("bloqueia acesso a rota protegida sem token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("permite acesso à rota protegida com access token válido", async () => {
    const login = await request(app).post("/auth/login").send({ email, password });
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.sub).toBeDefined();
  });

  it("rotaciona o refresh token e invalida o antigo", async () => {
    const login = await request(app).post("/auth/login").send({ email, password });
    const refreshRes = await request(app).post("/auth/refresh").send({ refreshToken: login.body.refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    // O refresh token antigo, já usado, não deve mais funcionar (rotação).
    const reuseRes = await request(app).post("/auth/refresh").send({ refreshToken: login.body.refreshToken });
    expect(reuseRes.status).toBe(401);
  });
});
