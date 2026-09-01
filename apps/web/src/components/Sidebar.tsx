"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Smartphone, MessageSquare, Users, Workflow,
  Clock, UsersRound, ScrollText, Settings, Building2, LogOut, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import clsx from "clsx";

const clientNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/instances", label: "Instâncias", icon: Smartphone },
  { href: "/conversations", label: "Conversas", icon: MessageSquare },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/automations", label: "Automações", icon: Workflow },
  { href: "/sessions", label: "Sessões", icon: Clock },
  { href: "/groups", label: "Grupos", icon: UsersRound },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Configurações", icon: Settings },
];

const adminNav = [
  { href: "/admin", label: "Dashboard Admin", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Clientes", icon: Building2 },
  { href: "/admin/senders", label: "Pool de Números", icon: Smartphone },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const nav = user?.role === "ADMIN" ? adminNav : clientNav;

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-40 bg-surface p-2 rounded-lg border border-border"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={clsx(
          "fixed md:static z-30 top-0 left-0 h-full w-64 bg-surface border-r border-border flex flex-col transition-transform",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-black">W</div>
            <span className="font-semibold text-lg">WhatsApp SaaS</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active ? "bg-primary/15 text-primary" : "text-muted hover:bg-surfaceHover hover:text-white"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-surfaceHover hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
