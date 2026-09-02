"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Users, Loader2, Check, X, Clock, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

// Grupo pode ser privado deste tenant (criado em "Novo grupo" abaixo) ou
// pertencer ao catálogo global mantido pelo admin em /admin/grupos (seção
// 40) - nesse caso isGlobal vem true e o grupo é o mesmo para todos os
// clientes da plataforma, só não pode ser editado/excluído por aqui.
type Group = {
  id: string;
  name: string;
  description: string | null;
  inviteLink: string;
  category: string | null;
  isGlobal: boolean;
};

type InstanceLite = { id: string; name: string; phoneNumber: string | null; status: string; provider: string };

type GroupJoinStatus = "QUEUED" | "JOINING" | "JOINED" | "FAILED";

type GroupJoin = {
  id: string;
  status: GroupJoinStatus;
  error: string | null;
  createdAt: string;
  instance: { id: string; name: string; phoneNumber: string | null };
};

// Entrar com todos os números (seção 15/38): diferente do convite por link
// enviado a contatos (que já existia), isto faz as PRÓPRIAS instâncias do
// tenant entrarem no grupo de verdade. Só funciona com números conectados
// via QR Code - a API oficial (Cloud API) não permite isso. Funciona igual
// tanto em grupos privados quanto no catálogo global do admin.
const STATUS_META: Record<GroupJoinStatus, { label: string; className: string; icon: typeof Clock }> = {
  QUEUED: { label: "Na fila", className: "bg-gray-500/15 text-gray-300", icon: Clock },
  JOINING: { label: "Entrando...", className: "bg-blue-500/15 text-blue-400", icon: Loader2 },
  JOINED: { label: "Entrou", className: "bg-green-500/15 text-green-400", icon: Check },
  FAILED: { label: "Falhou", className: "bg-red-500/15 text-red-400", icon: X },
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [instances, setInstances] = useState<InstanceLite[]>([]);
  const [form, setForm] = useState({ name: "", description: "", inviteLink: "", category: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [joins, setJoins] = useState<GroupJoin[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const [groupsData, instancesData] = await Promise.all([
      api<Group[]>("/groups"),
      api<InstanceLite[]>("/instances").catch(() => [] as InstanceLite[]),
    ]);
    setGroups(groupsData);
    setInstances(instancesData);
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

  function eligibleCount() {
    return instances.filter((i) => i.provider === "WHATSAPP_QR" && i.status === "CONNECTED").length;
  }

  async function loadJoins(groupId: string) {
    setJoins(await api<GroupJoin[]>(`/groups/${groupId}/joins`));
  }

  async function startJoinAll(groupId: string) {
    setStarting(groupId);
    try {
      await api(`/groups/${groupId}/join-all`, { method: "POST" });
      setOpenGroupId(groupId);
      await loadJoins(groupId);
    } finally {
      setStarting(null);
    }
  }

  function toggleStatus(groupId: string) {
    if (openGroupId === groupId) {
      setOpenGroupId(null);
      return;
    }
    setOpenGroupId(groupId);
    loadJoins(groupId);
  }

  // Enquanto o painel de status estiver aberto e ainda houver alguma
  // tentativa "Na fila" ou "Entrando...", faz polling pra acompanhar o
  // progresso - mesmo padrão já usado na tela de Meus Números pro QR Code.
  useEffect(() => {
    const hasPending = joins.some((j) => j.status === "QUEUED" || j.status === "JOINING");

    if (openGroupId && hasPending && !pollRef.current) {
      pollRef.current = setInterval(() => loadJoins(openGroupId), 3000);
    }
    if ((!openGroupId || !hasPending) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [openGroupId, joins]);

  // Catálogo compartilhado pelo admin primeiro (seção 40), depois os grupos
  // privados que este próprio tenant cadastrou - a separação visual deixa
  // claro que um é mantido pela plataforma (igual pra todo mundo) e o outro
  // é de uso exclusivo desta conta.
  const globalGroups = groups.filter((g) => g.isGlobal);
  const ownGroups = groups.filter((g) => !g.isGlobal);

  function renderGroupCard(g: Group) {
    const isOpen = openGroupId === g.id;
    const count = eligibleCount();
    return (
      <div key={g.id} className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium">{g.name}</h3>
          {g.isGlobal && (
            <span className="flex items-center gap-1 text-[11px] text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5 shrink-0">
              <ShieldCheck size={11} /> Catálogo
            </span>
          )}
        </div>
        {g.category && <p className="text-xs text-muted mb-2">{g.category}</p>}
        <p className="text-sm text-muted mb-2">{g.description}</p>
        <a href={g.inviteLink} target="_blank" className="text-xs text-primary hover:underline break-all">
          {g.inviteLink}
        </a>

        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-muted mb-2">
            {count > 0
              ? `${count} número${count > 1 ? "s" : ""} conectado${count > 1 ? "s" : ""} via QR Code disponível${count > 1 ? "is" : ""}`
              : "Nenhum número conectado via QR Code no momento"}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled={count === 0 || starting === g.id}
              onClick={() => startJoinAll(g.id)}
              className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-primary/25 transition-colors"
            >
              <Users size={12} /> {starting === g.id ? "Iniciando..." : "Entrar com todos os números"}
            </button>
            <button onClick={() => toggleStatus(g.id)} className="text-xs text-muted hover:text-white px-3 py-1.5">
              {isOpen ? "Ocultar status" : "Ver status"}
            </button>
          </div>

          {isOpen && (
            <div className="mt-3 space-y-1.5">
              {joins.length === 0 ? (
                <p className="text-xs text-muted">Nenhuma tentativa de entrada registrada ainda.</p>
              ) : (
                joins.map((j: GroupJoin) => {
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
                })
              )}
              {joins.some((j) => j.status === "FAILED" && j.error) && (
                <div className="mt-1.5 space-y-1">
                  {joins
                    .filter((j: GroupJoin) => j.status === "FAILED" && j.error)
                    .map((j: GroupJoin) => (
                      <p key={j.id} className="text-[11px] text-red-400">
                        {j.instance.name}: {j.error}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Grupos / Comunidades</h1>
          <p className="text-muted max-w-2xl">
            Convites para contatos são enviados apenas para quem aceitou recebê-los, através do link oficial.
            Já "Entrar com todos os números" faz seus próprios números conectados via QR Code entrarem no
            grupo de verdade - funciona só para números QR (a API oficial não permite isso), e as entradas
            são escalonadas com um intervalo aleatório entre cada número para reduzir o risco de bloqueio.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap"
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
            <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">Salvar</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">Cancelar</button>
          </div>
        </form>
      )}

      {groups.length === 0 && <p className="text-muted text-sm">Nenhum grupo disponível ainda.</p>}

      {globalGroups.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted mb-3">Grupos compartilhados pela plataforma</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{globalGroups.map((g) => renderGroupCard(g))}</div>
        </div>
      )}

      {ownGroups.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted mb-3">Meus grupos</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{ownGroups.map((g) => renderGroupCard(g))}</div>
        </div>
      )}
    </div>
  );
}
