import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";
import { writeLog } from "../../lib/logger";

/**
 * Contatos + consentimento (seções 9 e 25 - LGPD).
 * Toda automação deve checar `status === ACTIVE` antes de enviar mensagens -
 * essa checagem é feita no AutomationEngine, mas a garantia de dados começa aqui.
 */
export class ContactsService {
  async list(tenantId: string, filters?: { status?: string; tag?: string }) {
    return prisma.contact.findMany({
      where: {
        tenantId,
        status: filters?.status as any,
        tags: filters?.tag ? { has: filters.tag } : undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(tenantId: string, params: { name: string; phone: string; email?: string; origin?: string; consentSource: "FORM" | "IMPORT" | "MANUAL" | "WEBHOOK" | "API" }) {
    const existing = await prisma.contact.findUnique({ where: { tenantId_phone: { tenantId, phone: params.phone } } });
    if (existing) throw new AppError(409, "Contato já cadastrado com este telefone");

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: params.name,
        phone: params.phone,
        email: params.email,
        origin: params.origin,
        status: "ACTIVE",
        consents: {
          create: { status: "GRANTED", source: params.consentSource },
        },
      },
    });

    await writeLog({ tenantId, action: "CONTACT_CREATED", resource: "contact", resourceId: contact.id });
    return contact;
  }

  async tag(tenantId: string, contactId: string, tag: string) {
    const contact = await this.getById(tenantId, contactId);
    const tags = Array.from(new Set([...contact.tags, tag]));
    return prisma.contact.update({ where: { id: contactId }, data: { tags } });
  }

  async untag(tenantId: string, contactId: string, tag: string) {
    const contact = await this.getById(tenantId, contactId);
    return prisma.contact.update({ where: { id: contactId }, data: { tags: contact.tags.filter((t) => t !== tag) } });
  }

  async getById(tenantId: string, id: string) {
    const contact = await prisma.contact.findFirst({ where: { id, tenantId } });
    if (!contact) throw new AppError(404, "Contato não encontrado");
    return contact;
  }

  /** Opt-out: interrompe automações, impede novas mensagens e registra o evento (seção 9). */
  async optOut(tenantId: string, contactId: string, note?: string) {
    const contact = await this.getById(tenantId, contactId);

    await prisma.$transaction([
      prisma.contact.update({ where: { id: contact.id }, data: { status: "OPTED_OUT" } }),
      prisma.consent.create({ data: { contactId: contact.id, status: "REVOKED", source: "MANUAL", note } }),
      prisma.conversation.updateMany({ where: { contactId: contact.id }, data: { automationPaused: true } }),
    ]);

    await writeLog({ tenantId, action: "CONTACT_OPT_OUT", resource: "contact", resourceId: contact.id, metadata: { note } });
  }

  /** LGPD: exclusão definitiva a pedido do titular. */
  async deleteContactData(tenantId: string, contactId: string) {
    await this.getById(tenantId, contactId);
    await prisma.contact.delete({ where: { id: contactId } }); // cascade cuida do resto
    await writeLog({ tenantId, action: "CONTACT_DATA_DELETED", resource: "contact", resourceId: contactId });
  }

  /** LGPD: exportação dos dados do contato. */
  async exportContactData(tenantId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: { consents: true, invites: true, messages: true },
    });
    if (!contact) throw new AppError(404, "Contato não encontrado");
    return contact;
  }
}

export const contactsService = new ContactsService();
