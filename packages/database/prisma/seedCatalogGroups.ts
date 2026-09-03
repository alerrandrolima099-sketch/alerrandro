/**
 * Seed idempotente do catálogo global de grupos (seção 40/42) - roda a cada
 * deploy do serviço `api` (ver Dockerfile), logo depois do "prisma db push"
 * e antes do servidor subir. NUNCA duplica: antes de criar cada grupo,
 * verifica se já existe um grupo do catálogo (tenantId nulo) com o mesmo
 * link de convite - se existir (mesmo que tenha sido desativado depois por
 * um admin em /admin/grupos), pula e não recria.
 *
 * Erros em um grupo específico não derrubam os demais nem o processo - o
 * pior caso é o grupo não ser criado agora e a próxima execução tentar de
 * novo. O Dockerfile também isola essa etapa com "|| true" por segurança
 * extra, então uma falha aqui nunca impede a API de subir.
 *
 * Rodar manualmente (fora do container), se precisar:
 *   npx ts-node packages/database/prisma/seedCatalogGroups.ts
 * (a partir da raiz do monorepo, com DATABASE_URL configurada)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GROUPS: { name: string; inviteLink: string }[] = [
  { name: "Grupo Aquecimento 01", inviteLink: "https://chat.whatsapp.com/CT640RE2H5AGnS0hzJHdSA" },
  { name: "Grupo Aquecimento 02", inviteLink: "https://chat.whatsapp.com/GjhjTIH7cPaLuOxHEou9m8" },
  { name: "Grupo Aquecimento 03", inviteLink: "https://chat.whatsapp.com/HC84sN6lZVe2yIzBH0EvqE" },
  { name: "Grupo Aquecimento 04", inviteLink: "https://chat.whatsapp.com/IUYqn4oGcjv15KFSaAsDDj" },
  { name: "Grupo Aquecimento 05", inviteLink: "https://chat.whatsapp.com/Iwugdc3IBIRHv4m9xpz5cA" },
  { name: "Grupo Aquecimento 06", inviteLink: "https://chat.whatsapp.com/KJPLkan7Lzx7PGEpqtTfHP" },
  { name: "Grupo Aquecimento 07", inviteLink: "https://chat.whatsapp.com/EHo8lzhN7F8JgwqCA8XnVV" },
  { name: "Grupo Aquecimento 08", inviteLink: "https://chat.whatsapp.com/DMKz8QBO4BY0xEVwZydIIw" },
  { name: "Grupo Aquecimento 09", inviteLink: "https://chat.whatsapp.com/FWZrFX6U3h9IB4kr2jiu4N" },
  { name: "Grupo Aquecimento 10", inviteLink: "https://chat.whatsapp.com/JnPvqegHBvWCfFAcE5mhQ6" },
  { name: "Grupo Aquecimento 11", inviteLink: "https://chat.whatsapp.com/JW4141bmVWID9cqY2rgfst" },
  { name: "Grupo Aquecimento 12", inviteLink: "https://chat.whatsapp.com/IBqEl55pOHs4Pflbt8WXKe" },
  { name: "Grupo Aquecimento 13", inviteLink: "https://chat.whatsapp.com/DxJAn2RJ7xv2rX1UKGWfh1" },
  { name: "Grupo Aquecimento 14", inviteLink: "https://chat.whatsapp.com/GIYZXvdczJ37SPmtFyq8M6" },
  { name: "Grupo Aquecimento 15", inviteLink: "https://chat.whatsapp.com/FTTN9qRVTeL1DjT1Xv7UVS" },
  { name: "Grupo Aquecimento 16", inviteLink: "https://chat.whatsapp.com/IMUyT41nqR893KP8iAiICd" },
  { name: "Grupo Aquecimento 17", inviteLink: "https://chat.whatsapp.com/JSAwXDSYUsx2TZp3DDTPGi" },
  { name: "Grupo Aquecimento 18", inviteLink: "https://chat.whatsapp.com/BXrBVl8YOsaJLYASDLrC9T" },
  { name: "Grupo Aquecimento 19", inviteLink: "https://chat.whatsapp.com/DMoMdYlJzu3J20QZ4K3N49" },
  { name: "Grupo Aquecimento 20", inviteLink: "https://chat.whatsapp.com/LmWsQgdE96cLo3dp4HUtam" },
  { name: "Grupo Aquecimento 21", inviteLink: "https://chat.whatsapp.com/HpZntPwnPuGLhUCbi1VyM1" },
  { name: "Grupo Aquecimento 22", inviteLink: "https://chat.whatsapp.com/EAQDC8u3IMG1TKooUV48rA" },
  { name: "Grupo Aquecimento 23", inviteLink: "https://chat.whatsapp.com/F1iLVla1GBH3KciPxyKmzz" },
  { name: "Grupo Aquecimento 24", inviteLink: "https://chat.whatsapp.com/IPPDohYYCHc30uAA3ongpf" },
  { name: "Grupo Aquecimento 25", inviteLink: "https://chat.whatsapp.com/GKn1d3UueOm2MTut6WCpmL" },
  { name: "Grupo Aquecimento 26", inviteLink: "https://chat.whatsapp.com/DjIaysD6sAOC5w0a0EI2tI" },
  // Observação: a lista original enviada tinha 28 links, mas
  // "FTTN9qRVTeL1DjT1Xv7UVS" e "DMoMdYlJzu3J20QZ4K3N49" vieram repetidos 2x
  // cada - aqui só aparecem uma vez, então o catálogo não fica duplicado.
];

async function main() {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const g of GROUPS) {
    try {
      const existing = await prisma.group.findFirst({ where: { tenantId: null, inviteLink: g.inviteLink } });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.group.create({ data: { tenantId: null, name: g.name, inviteLink: g.inviteLink } });
      created++;
    } catch (err) {
      failed++;
      console.error(`[seedCatalogGroups] falha ao criar "${g.name}" (${g.inviteLink}):`, err);
    }
  }

  console.log(`[seedCatalogGroups] ${created} criado(s), ${skipped} já existia(m), ${failed} falharam.`);
}

main()
  .catch((err) => {
    console.error("[seedCatalogGroups] erro inesperado:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
