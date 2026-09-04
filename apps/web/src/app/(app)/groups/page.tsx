"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus, Users, UserPlus, MoreVertical, ShieldCheck, X, Loader2, Check, Clock, Lock,
  Eye, Link2, Pencil, Trash2, CheckCircle2, AlertTriangle, Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";

// Reformulação da página Grupos (seção 41): o objetivo passou a ser
// "Grupo → selecionar instâncias → entrar no grupo", com a tela principal
// mostrando só o essencial (card compacto com estatísticas reais) e tudo o
// mais (link de convite, histórico, edição) morando em modais separados -
// nada foi removido de verdade, só deixou de ficar exposto direto no card.

type GroupStats = { eligibleCount: number; joinedCount: number; pendingCount: number };

// Grupo pode ser privado deste tenant (criado em "Novo grupo") ou pertencer
// ao catálogo global mantido pelo admin em /admin/grupos (seção 40) - nesse
// caso isGlobal vem true e só o admin pode editar/excluir.
type Group = {
  id: string;
  name: string;
  description: string | null;
  inviteLink: string;
  category: string | null;
  isGlobal: boolean;
  createdAt: string;
  stats: GroupStats;
};

// inUseLeona (seção 48): marcador manual "Número em uso no Leona" (ver
// instances/page.tsx) - quando true, o número não pode ser selecionado pra
// entrar em grupos (ver eligibility() abaixo), pedido explícito do usuário
// pra não "dar bobeira" e usar um número que já está sendo usado em outra
// ferramenta pra entrar em grupos por aqui ao mesmo tempo.
type InstanceLite = { id: string; name: string; phoneNumber: string | null; status: string; provider: string; inUseLeona: boolean };

type GroupJoinStatus = "QUEUED" | "JOINING" | "JOINED" | "FAILED";

type GroupJoin = {
  id: string;
  status: GroupJoinStatus;
  error: string | null;
  createdAt: string;
  instanceId: string;
  instance: { id: string; name: string; phoneNumber: string | null };
};

type FilterValue = "all" | "with" | "without" | "complete" | "pending";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "with", label: "Com instâncias" },
  { value: "without", label: "Sem instâncias" },
  { value: "complete", label: "Completo" },
  { value: "pending", label: "Pendentes" },
];

// "Entrar no grupo" (seção 15/38/41): faz as PRÓPRIAS instâncias do tenant
// entrarem no grupo de verdade - só funciona com números conectados via QR
// Code (a API oficial não permite isso). O backend sempre revalida essa
// elegibilidade antes de executar, então o que está aqui é só espelho da
// mesma regra pro usuário nunca conseguir selecionar algo que vai falhar.
function eligibility(inst: InstanceLite): { eligible: boolean; emoji: string; reason: string } {
  // inUseLeona (seção 48): checado antes de qualquer outra coisa - número
  // marcado como "em uso no Leona" nunca fica disponível pra entrar em
  // grupos, mesmo que esteja conectado e elegível por todo o resto. O
  // backend reaplica essa mesma regra em joinAll(), então isso aqui é só
  // espelho pra já vir bloqueado na seleção.
  if (inst.inUseLeona) {
    return { eligible: false, emoji: "📌", reason: "Em uso no Leona - não entra em grupos enquanto marcado" };
  }
  if (inst.provider !== "WHATSAPP_QR") {
    return { eligible: false, emoji: "🔒", reason: "Só números conectados via QR Code entram em grupos" };
  }
  switch (inst.status) {
    case "CONNECTED":
      return { eligible: true, emoji: "🟢", reason: "Ativo" };
    case "PAUSED":
      return { eligible: false, emoji: "⏸️", reason: "Pausado" };
    case "CONNECTING":
      return { eligible: false, emoji: "🟡", reason: "Conectando..." };
    case "ERROR":
      return { eligible: false, emoji: "🔴", reason: "Erro de conexão" };
    default:
      return { eligible: false, emoji: "🔴", reason: "Desconectado" };
  }
}

function pluralize(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

const STATUS_META: Record<GroupJoinStatus, { label: string; className: string; icon: typeof Clock }> = {
  QUEUED: { label: "Na fila", className: "bg-gray-500/15 text-gray-300", icon: Clock },
  JOINING: { label: "Entrando...", className: "bg-blue-500/15 text-blue-400", icon: Loader2 },
  JOINED: { label: "Entrou", className: "bg-green-500/15 text-green-400", icon: Check },
  FAILED: { label: "Falhou", className: "bg-red-500/15 text-red-400", icon: X },
};

// Casca genérica de modal (seção 41) - usada pelo modal de seleção de
// instâncias, detalhes e edição, pra manter o mesmo visual/comportamento
// (fecha ao clicar fora, se adapta à tela no celular, rodapé fixo opcional)
// em vez de reimplementar isso três vezes.
function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-lg",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface border border-border rounded-2xl shadow-card w-full ${maxWidth} max-h-[90vh] flex flex-col animate-fade-in-up`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition-colors shrink-0" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg bg-surfaceHover shrink-0" />
        <div className="h-3.5 bg-surfaceHover rounded w-2/3" />
      </div>
      <div className="h-2.5 bg-surfaceHover rounded w-1/2 mb-3" />
      <div className="h-2.5 bg-surfaceHover rounded w-3/4 mb-5" />
      <div className="h-8 bg-surfaceHover rounded-lg" />
    </div>
  );
}

// Modal "Entrar no grupo" (seção 41): mesmo componente é usado tanto pelo
// botão principal do card quanto por "Gerenciar instâncias" no menu "⋯" -
// os dois levam à mesma experiência de selecionar/adicionar instâncias.
// Três fases: selecionar -> progresso -> resultado.
function JoinModal({
  group,
  instances,
  onClose,
  onCompleted,
}: {
  group: Group;
  instances: InstanceLite[];
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [phase, setPhase] = useState<"select" | "progress" | "result">("select");
  const [alreadyJoined, setAlreadyJoined] = useState<Set<string>>(new Set());
  const [loadingJoined, setLoadingJoined] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batchJoins, setBatchJoins] = useState<GroupJoin[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api<GroupJoin[]>(`/groups/${group.id}/joins`)
      .then((joins) => {
        if (cancelled) return;
        setAlreadyJoined(new Set(joins.filter((j) => j.status === "JOINED").map((j) => j.instanceId)));
      })
      .finally(() => {
        if (!cancelled) setLoadingJoined(false);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  // Não deixa selecionar de novo quem já entrou NESTE grupo (seção 49) -
  // pedido explícito do usuário: se o número 1 já entrou no grupo 6, ele não
  // pode ficar disponível pra "entrar" de novo nesse mesmo grupo (continua
  // podendo entrar em outros grupos normalmente). O backend reaplica a
  // mesma regra em joinAll(), então isso aqui é só espelho pra já vir
  // bloqueado na seleção.
  const eligibleInstances = instances.filter((i) => eligibility(i).eligible && !alreadyJoined.has(i.id));
  const allActiveSelected = eligibleInstances.length > 0 && eligibleInstances.every((i) => selected.has(i.id));

  // Se `alreadyJoined` chegar depois de o usuário já ter marcado algo (ou o
  // fetch demorar), tira da seleção qualquer instância que na verdade já
  // participa deste grupo - evita mandar reentrar com quem já está lá.
  useEffect(() => {
    if (alreadyJoined.size === 0) return;
    setSelected((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of alreadyJoined) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [alreadyJoined]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && !allActiveSelected;
    }
  }, [selected, allActiveSelected]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllActive() {
    setSelected(allActiveSelected ? new Set() : new Set(eligibleInstances.map((i) => i.id)));
  }

  async function confirmJoin() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const joins = await api<GroupJoin[]>(`/groups/${group.id}/join-all`, {
        method: "POST",
        body: { instanceIds: Array.from(selected) },
      });
      setBatchIds(joins.map((j) => j.id));
      setBatchJoins(joins as unknown as GroupJoin[]);
      setPhase("progress");
    } catch (err: any) {
      setSubmitError(err?.message ?? "Erro ao iniciar a entrada no grupo.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (phase !== "progress") return;

    async function refresh() {
      const all = await api<GroupJoin[]>(`/groups/${group.id}/joins`);
      const batch = all.filter((j) => batchIds.includes(j.id));
      setBatchJoins(batch);
      const stillPending = batch.some((j) => j.status === "QUEUED" || j.status === "JOINING");
      if (!stillPending) setPhase("result");
    }

    refresh();
    pollRef.current = setInterval(refresh, 3000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const doneCount = batchJoins.filter((j) => j.status !== "QUEUED" && j.status !== "JOINING").length;
  const successCount = batchJoins.filter((j) => j.status === "JOINED").length;
  const failCount = batchJoins.filter((j) => j.status === "FAILED").length;

  return (
    <ModalShell
      title="Entrar no grupo"
      subtitle={group.name}
      onClose={onClose}
      footer={
        phase === "select" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {selected.size} {pluralize(selected.size, "instância selecionada", "instâncias selecionadas")}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="text-muted text-sm px-3 py-2">
                Cancelar
              </button>
              <button
                disabled={selected.size === 0 || submitting}
                onClick={confirmJoin}
                className="flex items-center gap-1.5 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {submitting ? "Iniciando..." : `Entrar com ${selected.size} ${pluralize(selected.size, "instância", "instâncias")}`}
              </button>
            </div>
          </div>
        ) : phase === "result" ? (
          <button
            onClick={() => {
              onCompleted();
              onClose();
            }}
            className="w-full bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            Concluir
          </button>
        ) : undefined
      }
    >
      {phase === "select" && (
        <>
          <p className="text-sm text-muted mb-3">Selecione as instâncias que deseja adicionar a este grupo.</p>

          <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background/60 border border-border mb-2 cursor-pointer">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allActiveSelected}
              onChange={toggleAllActive}
              disabled={eligibleInstances.length === 0}
            />
            <span className="text-sm">Selecionar todos os números ativos</span>
            <span className="text-xs text-muted ml-auto">{eligibleInstances.length}</span>
          </label>

          {submitError && <p className="text-xs text-red-400 mb-2">{submitError}</p>}

          {loadingJoined ? (
            <div className="space-y-1.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-11 bg-surfaceHover rounded-lg animate-pulse" />
              ))}
            </div>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">Nenhuma instância cadastrada ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {instances.map((inst) => {
                const elig = eligibility(inst);
                const isSelected = selected.has(inst.id);
                const isJoined = alreadyJoined.has(inst.id);
                // Já participa deste grupo (seção 49): mesmo que a instância
                // esteja conectada e elegível por todo o resto, ela não pode
                // ser selecionada de novo pra este MESMO grupo - só pra
                // outros grupos onde ainda não entrou.
                const canSelect = elig.eligible && !isJoined;
                return (
                  <label
                    key={inst.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                      canSelect
                        ? `cursor-pointer ${isSelected ? "bg-primary/10 border-primary/30" : "bg-background/40 border-border hover:border-primary/40"}`
                        : "bg-background/20 border-border/50 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    {canSelect ? (
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(inst.id)} className="shrink-0" />
                    ) : isJoined ? (
                      <Check size={14} className="text-green-400 shrink-0" />
                    ) : (
                      <Lock size={14} className="text-muted shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate flex items-center gap-1.5">
                        {inst.name}
                        {isJoined && (
                          <span className="text-[10px] text-green-400 bg-green-500/10 rounded-full px-1.5 py-0.5 shrink-0">Já participa</span>
                        )}
                      </div>
                      <div className="text-xs text-muted truncate">{inst.phoneNumber ?? "—"}</div>
                    </div>
                    <span className="text-xs text-muted shrink-0" title={isJoined ? "Já participa deste grupo" : elig.reason}>
                      {isJoined ? "✅ Já participa" : `${elig.emoji} ${elig.reason}`}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </>
      )}

      {phase === "progress" && (
        <div className="py-6 flex flex-col items-center text-center">
          <Loader2 size={28} className="text-primary animate-spin mb-3" />
          <p className="font-medium mb-1">Adicionando instâncias...</p>
          <p className="text-sm text-muted">
            {doneCount} de {batchJoins.length} concluídas
          </p>
          <div className="w-full max-w-xs h-1.5 bg-background rounded-full overflow-hidden mt-4">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${batchJoins.length ? (doneCount / batchJoins.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {phase === "result" && (
        <div>
          <div className="flex flex-col items-center text-center py-2 mb-3">
            {failCount === 0 ? (
              <CheckCircle2 size={32} className="text-green-400 mb-2" />
            ) : (
              <AlertTriangle size={32} className="text-yellow-400 mb-2" />
            )}
            <p className="font-medium">
              {batchJoins.length} {pluralize(batchJoins.length, "instância processada", "instâncias processadas")}
            </p>
            <p className="text-sm text-muted mt-1">
              <span className="text-green-400">{successCount} entraram com sucesso</span>
              {failCount > 0 && (
                <>
                  {" "}
                  · <span className="text-red-400">{failCount} não conseguiram entrar</span>
                </>
              )}
            </p>
          </div>
          {failCount > 0 && (
            <div className="space-y-1.5">
              {batchJoins
                .filter((j) => j.status === "FAILED")
                .map((j) => (
                  <div key={j.id} className="text-xs bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                    <span className="font-medium">{j.instance.name}</span>
                    {j.instance.phoneNumber && <span className="text-muted"> · {j.instance.phoneNumber}</span>}
                    {j.error && <p className="text-red-400 mt-0.5">{j.error}</p>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}

// Modal "Ver detalhes" (seção 41): tudo que saiu do card principal mora
// aqui - link de convite, descrição completa, participantes/pendentes
// nominais e o histórico de tentativas (reaproveita GET /groups/:id/joins,
// que já existia).
function DetailsModal({ group, instances, onClose }: { group: Group; instances: InstanceLite[]; onClose: () => void }) {
  const [joins, setJoins] = useState<GroupJoin[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<GroupJoin[]>(`/groups/${group.id}/joins`).then((data) => {
      if (!cancelled) setJoins(data);
    });
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  const joinedIds = new Set((joins ?? []).filter((j) => j.status === "JOINED").map((j) => j.instanceId));
  const participants = instances.filter((i) => joinedIds.has(i.id));
  const pending = instances.filter((i) => eligibility(i).eligible && !joinedIds.has(i.id));

  return (
    <ModalShell title="Detalhes do grupo" subtitle={group.name} onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-5">
        <div>
          <h4 className="text-xs text-muted mb-1">Link de convite</h4>
          <a href={group.inviteLink} target="_blank" className="text-sm text-primary hover:underline break-all">
            {group.inviteLink}
          </a>
        </div>

        {group.description && (
          <div>
            <h4 className="text-xs text-muted mb-1">Descrição</h4>
            <p className="text-sm">{group.description}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-background/60 border border-border rounded-lg py-2.5">
            <div className="text-lg font-semibold">{group.stats.eligibleCount}</div>
            <div className="text-[11px] text-muted">Disponíveis</div>
          </div>
          <div className="bg-background/60 border border-border rounded-lg py-2.5">
            <div className="text-lg font-semibold text-green-400">{group.stats.joinedCount}</div>
            <div className="text-[11px] text-muted">Participantes</div>
          </div>
          <div className="bg-background/60 border border-border rounded-lg py-2.5">
            <div className="text-lg font-semibold text-yellow-400">{group.stats.pendingCount}</div>
            <div className="text-[11px] text-muted">Pendentes</div>
          </div>
        </div>

        <p className="text-xs text-muted">Criado em {new Date(group.createdAt).toLocaleDateString("pt-BR")}</p>

        <div>
          <h4 className="text-xs text-muted mb-2">Participantes</h4>
          {participants.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma instância entrou ainda.</p>
          ) : (
            <div className="space-y-1">
              {participants.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  {i.name}
                  {i.phoneNumber && <span className="text-muted text-xs">· {i.phoneNumber}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs text-muted mb-2">Pendentes</h4>
          {pending.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma instância pendente.</p>
          ) : (
            <div className="space-y-1">
              {pending.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                  {i.name}
                  {i.phoneNumber && <span className="text-muted text-xs">· {i.phoneNumber}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs text-muted mb-2">Histórico de entradas</h4>
          {joins === null ? (
            <p className="text-xs text-muted">Carregando...</p>
          ) : joins.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma tentativa registrada ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {joins.map((j: GroupJoin) => {
                const meta = STATUS_META[j.status];
                const Icon = meta.icon;
                return (
                  <div key={j.id} className="flex items-center justify-between gap-2 bg-background/60 border border-border rounded-lg px-2.5 py-1.5">
                    <span className="text-xs truncate">
                      {j.instance.name}
                      {j.instance.phoneNumber && <span className="text-muted"> · {j.instance.phoneNumber}</span>}
                    </span>
                    <span className={`flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 shrink-0 ${meta.className}`}>
                      <Icon size={10} className={j.status === "JOINING" ? "animate-spin" : ""} /> {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// Modal "Editar grupo" - só para grupos PRIVADOS deste tenant (o catálogo
// global só é editável pelo admin, ver menu condicional mais abaixo).
function EditModal({ group, onClose, onSaved }: { group: Group; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: group.name,
    description: group.description ?? "",
    inviteLink: group.inviteLink,
    category: group.category ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/groups/${group.id}`, { method: "PATCH", body: form });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Editar grupo" subtitle={group.name} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="text-xs text-muted block mb-1">Nome</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Categoria</label>
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Link de convite</label>
          <input
            required
            value={form.inviteLink}
            onChange={(e) => setForm({ ...form, inviteLink: e.target.value })}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors resize-y"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="text-muted text-sm px-3 py-2">
            Cancelar
          </button>
          <button disabled={saving} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// Card compacto do grupo (seção 41) - só o essencial: nome, quantas
// instâncias estão disponíveis agora, quantas já participam, quantas estão
// pendentes, e o botão principal. Link de convite e categoria saíram daqui
// e foram para o menu "⋯" / modal de detalhes.
function GroupCard({
  group,
  menuOpen,
  onToggleMenu,
  onJoinClick,
  onDetailsClick,
  onManageClick,
  onCopyInvite,
  onEditClick,
  onDeleteClick,
}: {
  group: Group;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onJoinClick: () => void;
  onDetailsClick: () => void;
  onManageClick: () => void;
  onCopyInvite: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
}) {
  const { stats } = group;
  const complete = stats.eligibleCount > 0 && stats.pendingCount === 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-card transition-all flex flex-col">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Users size={16} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium truncate">{group.name}</h3>
          {group.isGlobal && (
            <span className="inline-flex items-center gap-1 text-[10px] text-accent mt-0.5">
              <ShieldCheck size={10} /> Catálogo
            </span>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={onToggleMenu}
            className="text-muted hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition-colors"
            aria-label="Opções do grupo"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-52 bg-surface2 border border-border rounded-lg shadow-card py-1 text-xs">
              <button onClick={onDetailsClick} className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2">
                <Eye size={13} /> Ver detalhes
              </button>
              <button onClick={onManageClick} className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2 text-primary">
                <UserPlus size={13} /> Gerenciar instâncias
              </button>
              <button onClick={onCopyInvite} className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2">
                <Link2 size={13} /> Copiar convite
              </button>
              {!group.isGlobal && (
                <>
                  <button onClick={onEditClick} className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2">
                    <Pencil size={13} /> Editar grupo
                  </button>
                  <button
                    onClick={onDeleteClick}
                    className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2 text-red-400 border-t border-border mt-1"
                  >
                    <Trash2 size={13} /> Excluir grupo
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted mb-3">
        {stats.eligibleCount > 0
          ? `${stats.eligibleCount} ${pluralize(stats.eligibleCount, "instância disponível", "instâncias disponíveis")}`
          : "Nenhuma instância conectada via QR Code"}
      </p>

      <div className="flex items-center gap-3 text-xs mb-4">
        <span className="flex items-center gap-1 text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" /> {stats.joinedCount} {pluralize(stats.joinedCount, "participante", "participantes")}
        </span>
        {stats.eligibleCount > 0 &&
          (complete ? (
            <span className="flex items-center gap-1 text-primary">
              <Check size={12} /> Completo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" /> {stats.pendingCount} {pluralize(stats.pendingCount, "pendente", "pendentes")}
            </span>
          ))}
      </div>

      <button
        disabled={stats.eligibleCount === 0}
        onClick={onJoinClick}
        className="mt-auto w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-primary/15 text-primary rounded-lg px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/25 transition-colors"
      >
        <UserPlus size={13} /> Entrar no grupo
      </button>
    </div>
  );
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [instances, setInstances] = useState<InstanceLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", description: "", inviteLink: "", category: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [joinModalGroup, setJoinModalGroup] = useState<Group | null>(null);
  const [detailsModalGroup, setDetailsModalGroup] = useState<Group | null>(null);
  const [editModalGroup, setEditModalGroup] = useState<Group | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  async function load() {
    const [groupsData, instancesData] = await Promise.all([
      api<Group[]>("/groups"),
      api<InstanceLite[]>("/instances").catch(() => [] as InstanceLite[]),
    ]);
    setGroups(groupsData);
    setInstances(instancesData);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api("/groups", { method: "POST", body: form });
    setForm({ name: "", description: "", inviteLink: "", category: "" });
    setShowCreate(false);
    await load();
  }

  async function removeGroup(g: Group) {
    if (!confirm(`Excluir o grupo "${g.name}"? Ele deixará de aparecer na sua lista.`)) return;
    await api(`/groups/${g.id}`, { method: "DELETE" });
    await load();
  }

  async function copyInvite(g: Group) {
    try {
      await navigator.clipboard.writeText(g.inviteLink);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 1800);
    } catch {
      /* clipboard pode não estar disponível - falha silenciosa, sem quebrar a tela */
    }
  }

  function matchesFilter(g: Group) {
    switch (filter) {
      case "with":
        return g.stats.joinedCount > 0;
      case "without":
        return g.stats.joinedCount === 0;
      case "complete":
        return g.stats.eligibleCount > 0 && g.stats.pendingCount === 0;
      case "pending":
        return g.stats.pendingCount > 0;
      default:
        return true;
    }
  }

  const q = search.trim().toLowerCase();
  const visibleGroups = groups.filter((g) => {
    const matchesSearch = !q || g.name.toLowerCase().includes(q) || (g.description ?? "").toLowerCase().includes(q);
    return matchesSearch && matchesFilter(g);
  });

  // Catálogo compartilhado pelo admin primeiro (seção 40), depois os grupos
  // privados que este próprio tenant cadastrou.
  const globalGroups = visibleGroups.filter((g) => g.isGlobal);
  const ownGroups = visibleGroups.filter((g) => !g.isGlobal);

  function renderGrid(list: Group[]) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            menuOpen={openMenuId === g.id}
            onToggleMenu={() => setOpenMenuId(openMenuId === g.id ? null : g.id)}
            onJoinClick={() => {
              setOpenMenuId(null);
              setJoinModalGroup(g);
            }}
            onDetailsClick={() => {
              setOpenMenuId(null);
              setDetailsModalGroup(g);
            }}
            onManageClick={() => {
              setOpenMenuId(null);
              setJoinModalGroup(g);
            }}
            onCopyInvite={() => {
              setOpenMenuId(null);
              copyInvite(g);
            }}
            onEditClick={() => {
              setOpenMenuId(null);
              setEditModalGroup(g);
            }}
            onDeleteClick={() => {
              setOpenMenuId(null);
              removeGroup(g);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Grupos</h1>
          <p className="text-muted text-sm">Escolha um grupo e selecione quais números vão entrar.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          <Plus size={16} /> Novo grupo
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="bg-surface border border-border rounded-xl p-4 mb-6 grid md:grid-cols-2 gap-3">
          <input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          <input required placeholder="Link de convite oficial (https://chat.whatsapp.com/...)" value={form.inviteLink} onChange={(e) => setForm({ ...form, inviteLink: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <div className="flex gap-2 md:col-span-2">
            <button className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium">Salvar</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">Cancelar</button>
          </div>
        </form>
      )}

      {groups.length > 4 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar grupo..."
              className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`text-xs rounded-lg px-3 py-2 transition-colors whitespace-nowrap ${
                  filter === f.value ? "bg-primary/15 text-primary" : "text-muted hover:bg-surfaceHover hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum grupo ainda"
          description="Cadastre o link de convite oficial de um grupo para começar a organizar a entrada dos seus números."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium mx-auto"
            >
              <Plus size={16} /> Novo grupo
            </button>
          }
        />
      ) : visibleGroups.length === 0 ? (
        <p className="text-muted text-sm py-8 text-center">Nenhum grupo encontrado com esse filtro.</p>
      ) : (
        <>
          {globalGroups.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-muted mb-3">Grupos compartilhados pela plataforma</h2>
              {renderGrid(globalGroups)}
            </div>
          )}
          {ownGroups.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted mb-3">Meus grupos</h2>
              {renderGrid(ownGroups)}
            </div>
          )}
        </>
      )}

      {/* Fecha o menu "⋯" ao clicar fora dele. */}
      {openMenuId && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />}

      {joinModalGroup && (
        <JoinModal
          group={joinModalGroup}
          instances={instances}
          onClose={() => setJoinModalGroup(null)}
          onCompleted={load}
        />
      )}

      {detailsModalGroup && (
        <DetailsModal group={detailsModalGroup} instances={instances} onClose={() => setDetailsModalGroup(null)} />
      )}

      {editModalGroup && (
        <EditModal group={editModalGroup} onClose={() => setEditModalGroup(null)} onSaved={load} />
      )}

      {copiedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-surface2 border border-border rounded-lg px-4 py-2 text-sm shadow-card">
          Link de convite copiado!
        </div>
      )}
    </div>
  );
}
