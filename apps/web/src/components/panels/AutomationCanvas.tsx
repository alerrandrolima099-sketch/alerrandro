"use client";

import { useMemo } from "react";
import {
  Play, Send, Clock, MessageCircleQuestion, GitBranch, Tag, TagIcon,
  ArrowRightLeft, UserPlus, Square, LucideIcon,
} from "lucide-react";

export type AutomationNode = {
  id: string;
  type: string;
  position?: unknown;
  config?: unknown;
  nextNodeIds: string[];
};

const NODE_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  START: { label: "Início", icon: Play, color: "border-success/50 bg-success/10 text-success" },
  SEND_MESSAGE: { label: "Enviar mensagem", icon: Send, color: "border-primary/50 bg-primary/10 text-primary" },
  WAIT: { label: "Aguardar", icon: Clock, color: "border-warning/50 bg-warning/10 text-warning" },
  WAIT_FOR_REPLY: { label: "Aguardar resposta", icon: MessageCircleQuestion, color: "border-warning/50 bg-warning/10 text-warning" },
  CONDITION: { label: "Condição", icon: GitBranch, color: "border-info/50 bg-info/10 text-info" },
  TAG_CONTACT: { label: "Marcar tag", icon: Tag, color: "border-fire/50 bg-fire/10 text-fire" },
  REMOVE_TAG: { label: "Remover tag", icon: TagIcon, color: "border-fire/50 bg-fire/10 text-fire" },
  TRANSFER: { label: "Transferir", icon: ArrowRightLeft, color: "border-info/50 bg-info/10 text-info" },
  SEND_INVITE: { label: "Enviar convite", icon: UserPlus, color: "border-primary/50 bg-primary/10 text-primary" },
  END: { label: "Fim", icon: Square, color: "border-gray-500/50 bg-gray-500/10 text-gray-400" },
};

const COL_WIDTH = 220;
const ROW_HEIGHT = 110;
const NODE_W = 176;
const NODE_H = 64;

function hasNumericPosition(p: unknown): p is { x: number; y: number } {
  return !!p && typeof p === "object" && typeof (p as any).x === "number" && typeof (p as any).y === "number";
}

/** Auto-layout em colunas via BFS a partir do nó START (ou do primeiro nó, se não houver START). */
function computeLayout(nodes: AutomationNode[]): Record<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = nodes.find((n) => n.type === "START") ?? nodes[0];
  const depth = new Map<string, number>();
  const visited = new Set<string>();
  if (start) {
    let queue: string[] = [start.id];
    depth.set(start.id, 0);
    while (queue.length) {
      const next: string[] = [];
      for (const id of queue) {
        if (visited.has(id)) continue;
        visited.add(id);
        const node = byId.get(id);
        const d = depth.get(id) ?? 0;
        for (const childId of node?.nextNodeIds ?? []) {
          if (!depth.has(childId) || depth.get(childId)! < d + 1) depth.set(childId, d + 1);
          next.push(childId);
        }
      }
      queue = next;
    }
  }
  // nós desconectados vão para uma coluna extra ao final
  const maxDepth = Math.max(0, ...Array.from(depth.values()));
  nodes.forEach((n) => {
    if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1);
  });

  const columns = new Map<number, string[]>();
  nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), n.id]);
  });

  const positions: Record<string, { x: number; y: number }> = {};
  columns.forEach((ids, col) => {
    ids.forEach((id, row) => {
      positions[id] = { x: col * COL_WIDTH, y: row * ROW_HEIGHT };
    });
  });
  return positions;
}

export function AutomationCanvas({ nodes }: { nodes: AutomationNode[] }) {
  const layout = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const needsAuto = nodes.some((n) => !hasNumericPosition(n.position));
    if (needsAuto) {
      return computeLayout(nodes);
    }
    nodes.forEach((n) => {
      positions[n.id] = n.position as { x: number; y: number };
    });
    return positions;
  }, [nodes]);

  const width = Math.max(600, ...Object.values(layout).map((p) => p.x + NODE_W + 40));
  const height = Math.max(200, ...Object.values(layout).map((p) => p.y + NODE_H + 40));

  return (
    <div className="overflow-auto border border-border rounded-lg bg-background">
      <div className="relative" style={{ width, height, minWidth: "100%" }}>
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
          {nodes.map((n) =>
            n.nextNodeIds.map((targetId) => {
              const from = layout[n.id];
              const to = layout[targetId];
              if (!from || !to) return null;
              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;
              const midX = (x1 + x2) / 2;
              return (
                <path
                  key={`${n.id}-${targetId}`}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#3b4759"
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                />
              );
            })
          )}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#3b4759" />
            </marker>
          </defs>
        </svg>

        {nodes.map((n) => {
          const pos = layout[n.id] ?? { x: 0, y: 0 };
          const meta = NODE_META[n.type] ?? { label: n.type, icon: Square, color: "border-border bg-surface text-muted" };
          const Icon = meta.icon;
          return (
            <div
              key={n.id}
              className={`absolute flex items-center gap-2 rounded-lg border px-3 py-2.5 shadow-card ${meta.color}`}
              style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
            >
              <Icon size={16} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{meta.label}</div>
                <div className="text-[10px] opacity-70 truncate">{n.type}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
