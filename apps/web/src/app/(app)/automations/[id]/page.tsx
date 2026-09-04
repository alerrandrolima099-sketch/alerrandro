"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Play, MessageSquare, Clock, MessageCircleReply, GitBranch, Tag, TagIcon, UserCog,
  LogOut, Flag,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

// Editor visual de Automações (seção 38). O backend (AutomationNode +
// AutomationEngine) já suporta grafos completos - isso aqui é só a
// interface que faltava: até agora só dava pra criar/renomear/ativar uma
// automação pela tela, e configurar os nodes só chamando a API direto.
// Nenhum endpoint novo: usa POST /automations/:id/nodes (criar/atualizar,
// dependendo de vir ou não um id) e DELETE /automations/:id/nodes/:nodeId,
// que já existiam.

type NodeType =
  | "START"
  | "SEND_MESSAGE"
  | "WAIT"
  | "WAIT_FOR_REPLY"
  | "CONDITION"
  | "TAG_CONTACT"
  | "REMOVE_TAG"
  | "TRANSFER"
  | "END"
  | "SEND_INVITE";

type Position = { x: number; y: number };

type AutomationNode = {
  id: string;
  type: NodeType;
  position: Position | null;
  config: Record<string, unknown> | null;
  nextNodeIds: string[];
};

type Automation = { id: string; name: string; status: string; nodes: AutomationNode[] };

// Só os tipos que avançam por nextNodeIds[0] de forma simples (ver
// AutomationEngine.processStep - depois do switch, quem não retornou cedo
// cai no avanço genérico por nextNodeIds[0]).
const SIMPLE_NEXT_TYPES: NodeType[] = [
  "START",
  "SEND_MESSAGE",
  "WAIT",
  "WAIT_FOR_REPLY",
  "TAG_CONTACT",
  "REMOVE_TAG",
  "SEND_INVITE",
];
// TRANSFER e END encerram a execução - o engine ignora nextNodeIds nesses.
const TERMINAL_TYPES: NodeType[] = ["TRANSFER", "END"];
// CONDITION não usa nextNodeIds - usa config.trueNodeId/falseNodeId.

const NODE_META: Record<NodeType, { label: string; description: string; icon: typeof Plus; color: string }> = {
  START: { label: "Início", description: "Ponto de partida do fluxo. Só pode haver um.", icon: Play, color: "primary" },
  SEND_MESSAGE: { label: "Enviar mensagem", description: "Envia um texto ao contato na conversa.", icon: MessageSquare, color: "blue" },
  WAIT: { label: "Aguardar", description: "Pausa o fluxo por um tempo antes de continuar.", icon: Clock, color: "yellow" },
  WAIT_FOR_REPLY: { label: "Aguardar resposta", description: "Pausa até o contato responder.", icon: MessageCircleReply, color: "yellow" },
  CONDITION: { label: "Condição", description: "Ramifica o fluxo conforme uma tag do contato.", icon: GitBranch, color: "accent" },
  TAG_CONTACT: { label: "Adicionar tag", description: "Marca o contato com uma tag.", icon: Tag, color: "green" },
  REMOVE_TAG: { label: "Remover tag", description: "Remove uma tag do contato.", icon: TagIcon, color: "gray" },
  SEND_INVITE: { label: "Convite de grupo", description: "Segue o fluxo - a oferta do convite em si acontece em Conversas/Grupos.", icon: UserCog, color: "accent" },
  TRANSFER: { label: "Transferir", description: "Encerra a automação e pausa a conversa pra um atendente assumir. Nó final.", icon: LogOut, color: "red" },
  END: { label: "Fim", description: "Encerra a automação. Nó final.", icon: Flag, color: "red" },
};

const COLOR_CLASSES: Record<string, string> = {
  primary: "border-primary/50 bg-primary/10 text-primary",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  yellow: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  accent: "border-accent/40 bg-accent/10 text-accent",
  green: "border-green-500/40 bg-green-500/10 text-green-400",
  gray: "border-gray-500/40 bg-gray-500/10 text-gray-300",
  red: "border-red-500/40 bg-red-500/10 text-red-400",
};

const CARD_W = 176;
const CARD_H = 60;

function defaultPosition(index: number): Position {
  return { x: 40 + (index % 3) * 240, y: 40 + Math.floor(index / 3) * 150 };
}

export default function AutomationEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    const data = await api<Automation>(`/automations/${id}`);
    setAutomation(data);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const nodes: AutomationNode[] = automation?.nodes ?? [];
  const selected: AutomationNode | null = nodes.find((n) => n.id === selectedId) ?? null;

  async function addNode(type: NodeType) {
    if (!automation) return;
    const created = await api<AutomationNode>(`/automations/${automation.id}/nodes`, {
      method: "POST",
      body: { type, position: defaultPosition(nodes.length), config: {}, nextNodeIds: [] },
    });
    await load();
    setSelectedId(created.id);
  }

  async function persistNode(node: AutomationNode) {
    if (!automation) return;
    setSaving(true);
    try {
      await api(`/automations/${automation.id}/nodes`, {
        method: "POST",
        body: {
          id: node.id,
          type: node.type,
          position: node.position,
          config: node.config,
          nextNodeIds: node.nextNodeIds,
        },
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteNode(nodeId: string) {
    if (!automation) return;
    if (!confirm("Excluir este nó do fluxo?")) return;
    await api(`/automations/${automation.id}/nodes/${nodeId}`, { method: "DELETE" });
    if (selectedId === nodeId) setSelectedId(null);
    await load();
  }

  function updateLocalPosition(nodeId: string, pos: Position) {
    setAutomation((prev) => {
      if (!prev) return prev;
      return { ...prev, nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, position: pos } : n)) };
    });
  }

  function startDrag(e: React.MouseEvent, node: AutomationNode) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(node.id);
    setDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = node.position ?? { x: 0, y: 0 };

    function onMove(ev: MouseEvent) {
      const next = { x: Math.max(0, origin.x + (ev.clientX - startX)), y: Math.max(0, origin.y + (ev.clientY - startY)) };
      updateLocalPosition(node.id, next);
    }
    function onUp(ev: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setDragging(false);
      const next = { x: Math.max(0, origin.x + (ev.clientX - startX)), y: Math.max(0, origin.y + (ev.clientY - startY)) };
      const finalNode: AutomationNode = { ...node, position: next };
      persistNode(finalNode);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function updateSelectedConfig(patch: Record<string, unknown>) {
    if (!selected) return;
    const updated: AutomationNode = { ...selected, config: { ...(selected.config ?? {}), ...patch } };
    setAutomation((prev) => (prev ? { ...prev, nodes: prev.nodes.map((n) => (n.id === updated.id ? updated : n)) } : prev));
    persistNode(updated);
  }

  function updateSelectedNext(nextId: string) {
    if (!selected) return;
    const updated: AutomationNode = { ...selected, nextNodeIds: nextId ? [nextId] : [] };
    setAutomation((prev) => (prev ? { ...prev, nodes: prev.nodes.map((n) => (n.id === updated.id ? updated : n)) } : prev));
    persistNode(updated);
  }

  // Linhas do canvas: uma por nextNodeIds[0] (tipos simples), e duas
  // pontilhadas (sim/não) para nodes CONDITION, a partir de config.
  const lines = useMemo(() => {
    const byId = new Map<string, AutomationNode>(nodes.map((n): [string, AutomationNode] => [n.id, n]));
    const result: { from: Position; to: Position; color: string; label?: string; key: string }[] = [];

    for (const node of nodes) {
      const from = node.position ?? { x: 0, y: 0 };
      const fromCenter = { x: from.x + CARD_W / 2, y: from.y + CARD_H };

      if (node.type === "CONDITION") {
        const trueId = (node.config as { trueNodeId?: string })?.trueNodeId;
        const falseId = (node.config as { falseNodeId?: string })?.falseNodeId;
        const trueNode = trueId ? byId.get(trueId) : null;
        const falseNode = falseId ? byId.get(falseId) : null;
        if (trueNode) {
          const to = trueNode.position ?? { x: 0, y: 0 };
          result.push({ from: fromCenter, to: { x: to.x + CARD_W / 2, y: to.y }, color: "#22c55e", label: "sim", key: `${node.id}-true` });
        }
        if (falseNode) {
          const to = falseNode.position ?? { x: 0, y: 0 };
          result.push({ from: fromCenter, to: { x: to.x + CARD_W / 2, y: to.y }, color: "#f87171", label: "não", key: `${node.id}-false` });
        }
      } else if (!TERMINAL_TYPES.includes(node.type)) {
        const nextId = node.nextNodeIds[0];
        const nextNode = nextId ? byId.get(nextId) : null;
        if (nextNode) {
          const to = nextNode.position ?? { x: 0, y: 0 };
          result.push({ from: fromCenter, to: { x: to.x + CARD_W / 2, y: to.y }, color: "#a9a3c2", key: node.id });
        }
      }
    }
    return result;
  }, [nodes]);

  const worldWidth = Math.max(900, ...nodes.map((n) => (n.position?.x ?? 0) + CARD_W + 80));
  const worldHeight = Math.max(500, ...nodes.map((n) => (n.position?.y ?? 0) + CARD_H + 80));

  const hasStart = nodes.some((n) => n.type === "START");

  if (!automation) {
    return <div className="text-muted text-sm">Carregando fluxo...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/automations")} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold truncate">{automation.name}</h1>
          <p className="text-xs text-muted">
            {saving ? "Salvando..." : "Alterações são salvas automaticamente"} · arraste os nós pra reorganizar
          </p>
        </div>
        <Badge status={automation.status} />
      </div>

      {!hasStart && (
        <p className="text-xs text-yellow-400 mb-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2">
          Este fluxo ainda não tem um nó de Início - adicione um pela barra ao lado, senão a automação não roda.
        </p>
      )}

      <div className="flex gap-4 items-start">
        <div className="w-52 shrink-0 bg-surface border border-border rounded-xl p-3 space-y-1.5">
          <p className="text-xs text-muted px-1 mb-1">Adicionar nó</p>
          {(Object.keys(NODE_META) as NodeType[]).map((type) => {
            const meta = NODE_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                onClick={() => addNode(type)}
                title={meta.description}
                className="w-full flex items-center gap-2 text-left text-xs rounded-lg px-2.5 py-2 hover:bg-surfaceHover transition-colors"
              >
                <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${COLOR_CLASSES[meta.color]}`}>
                  <Icon size={12} />
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 bg-background border border-border rounded-xl overflow-auto" style={{ maxHeight: 560 }}>
          <div
            className="relative"
            style={{
              width: worldWidth,
              height: worldHeight,
              backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
            onClick={() => setSelectedId(null)}
          >
            <svg width={worldWidth} height={worldHeight} className="absolute inset-0 pointer-events-none">
              {lines.map((line) => {
                const midX = (line.from.x + line.to.x) / 2;
                const midY = (line.from.y + line.to.y) / 2;
                return (
                  <g key={line.key}>
                    <line
                      x1={line.from.x}
                      y1={line.from.y}
                      x2={line.to.x}
                      y2={line.to.y}
                      stroke={line.color}
                      strokeWidth={1.5}
                      strokeDasharray={line.label ? "4 3" : undefined}
                    />
                    {line.label && (
                      <text x={midX + 4} y={midY - 4} fontSize={10} fill={line.color}>
                        {line.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => {
              const meta = NODE_META[node.type];
              const Icon = meta.icon;
              const pos = node.position ?? { x: 0, y: 0 };
              const isSelected = node.id === selectedId;
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => startDrag(e, node)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(node.id);
                  }}
                  className={`absolute select-none rounded-lg border px-3 py-2 shadow-soft bg-surface ${COLOR_CLASSES[meta.color]} ${
                    isSelected ? "ring-2 ring-primary" : ""
                  } ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                  style={{ left: pos.x, top: pos.y, width: CARD_W, minHeight: CARD_H }}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Icon size={12} /> {meta.label}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 truncate">
                    {node.type === "SEND_MESSAGE" && typeof node.config?.text === "string" && node.config.text
                      ? node.config.text
                      : node.type === "WAIT" && typeof node.config?.seconds === "number"
                      ? `${node.config.seconds}s`
                      : (node.type === "TAG_CONTACT" || node.type === "REMOVE_TAG") && typeof node.config?.tag === "string"
                      ? node.config.tag
                      : "toque para configurar"}
                  </p>
                </div>
              );
            })}

            {nodes.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                Adicione o primeiro nó pela barra ao lado (comece pelo "Início")
              </p>
            )}
          </div>
        </div>

        <div className="w-72 shrink-0 bg-surface border border-border rounded-xl p-4">
          {!selected ? (
            <p className="text-xs text-muted">Selecione um nó no fluxo para configurar.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {(() => {
                    const Icon = NODE_META[selected.type].icon;
                    return <Icon size={14} />;
                  })()}
                  {NODE_META[selected.type].label}
                </div>
                <button onClick={() => deleteNode(selected.id)} className="text-red-400 hover:text-red-300">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-xs text-muted">{NODE_META[selected.type].description}</p>

              {selected.type === "SEND_MESSAGE" && (
                <div>
                  <label className="text-xs text-muted block mb-1">Texto da mensagem</label>
                  <textarea
                    defaultValue={(selected.config?.text as string) ?? ""}
                    onBlur={(e) => updateSelectedConfig({ text: e.target.value })}
                    rows={3}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-y"
                  />
                </div>
              )}

              {selected.type === "WAIT" && (
                <div>
                  <label className="text-xs text-muted block mb-1">Segundos de espera</label>
                  <input
                    type="number"
                    min={1}
                    defaultValue={(selected.config?.seconds as number) ?? 30}
                    onBlur={(e) => updateSelectedConfig({ seconds: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              )}

              {(selected.type === "TAG_CONTACT" || selected.type === "REMOVE_TAG") && (
                <div>
                  <label className="text-xs text-muted block mb-1">Tag</label>
                  <input
                    type="text"
                    defaultValue={(selected.config?.tag as string) ?? ""}
                    onBlur={(e) => updateSelectedConfig({ tag: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              )}

              {selected.type === "CONDITION" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted block mb-1">Se o contato tiver a tag</label>
                    <input
                      type="text"
                      defaultValue={(selected.config?.hasTag as string) ?? ""}
                      onBlur={(e) => updateSelectedConfig({ hasTag: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Se sim, vai para</label>
                    <select
                      value={(selected.config?.trueNodeId as string) ?? ""}
                      onChange={(e) => updateSelectedConfig({ trueNodeId: e.target.value || undefined })}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                    >
                      <option value="">Selecione...</option>
                      {nodes.filter((n) => n.id !== selected.id).map((n) => (
                        <option key={n.id} value={n.id}>
                          {NODE_META[n.type].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Se não, vai para</label>
                    <select
                      value={(selected.config?.falseNodeId as string) ?? ""}
                      onChange={(e) => updateSelectedConfig({ falseNodeId: e.target.value || undefined })}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                    >
                      <option value="">Selecione...</option>
                      {nodes.filter((n) => n.id !== selected.id).map((n) => (
                        <option key={n.id} value={n.id}>
                          {NODE_META[n.type].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {SIMPLE_NEXT_TYPES.includes(selected.type) && (
                <div>
                  <label className="text-xs text-muted block mb-1">Próximo nó</label>
                  <select
                    value={selected.nextNodeIds[0] ?? ""}
                    onChange={(e) => updateSelectedNext(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                  >
                    <option value="">Nenhum (encerra aqui)</option>
                    {nodes.filter((n) => n.id !== selected.id).map((n) => (
                      <option key={n.id} value={n.id}>
                        {NODE_META[n.type].label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {TERMINAL_TYPES.includes(selected.type) && (
                <p className="text-xs text-muted italic">Nó final - o fluxo sempre termina aqui, não há próximo nó.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
