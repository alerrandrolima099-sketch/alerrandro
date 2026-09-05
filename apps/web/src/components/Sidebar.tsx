"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Smartphone, Users,
  Clock, UsersRound, ScrollText, Settings, Building2, LogOut, Menu, X,
  ShieldCheck, User, Radio, Headphones, Bot,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import clsx from "clsx";

const clientNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/instances", label: "Meus Números", icon: Smartphone },
  { href: "/conversations", label: "Conversas", icon: Radio },
  { href: "/attendance", label: "Atendimentos", icon: Headphones },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/personas", label: "Perfis de Conversa", icon: Bot },
  { href: "/sessions", label: "Sessões", icon: Clock },
  { href: "/groups", label: "Grupos", icon: UsersRound },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Configurações", icon: Settings },
];

const adminNav = [
  { href: "/admin", label: "Dashboard Admin", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Clientes", icon: Building2 },
  { href: "/admin/senders", label: "Pool de Números", icon: Smartphone },
  { href: "/admin/grupos", label: "Grupos", icon: UsersRound },
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
        className="md:hidden fixed top-4 left-4 z-40 bg-sidebar/90 backdrop-blur p-2 rounded-lg border border-border shadow-soft"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={clsx(
          "fixed md:static z-30 top-0 left-0 h-full w-64 bg-sidebar/95 backdrop-blur border-r border-border flex flex-col transition-transform",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lowzap-icon.png" alt="LowZap" className="w-8 h-8 rounded-lg shrink-0" />
            <span className="font-semibold text-lg tracking-tight">LowZap</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  active
                    ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary font-medium"
                    : "text-muted hover:bg-surfaceHover hover:text-white"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" aria-hidden />
                )}
                <Icon size={18} className={active ? "" : "text-muted group-hover:text-white transition-colors"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background/60 border border-borderLight">
            <div className="w-7 h-7 rounded-full bg-surfaceHover flex items-center justify-center shrink-0">
              <User size={13} className="text-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">
                {user?.role === "ADMIN" ? "Administrador" : "Cliente"}
              </div>
            </div>
            {user?.role === "ADMIN" && <ShieldCheck size={14} className="text-accent shrink-0" />}
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-surfaceHover hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm" onClick={() => setOpen(false)} />}
    </>
  );
}
