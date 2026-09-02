"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, User, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/AuthShell";

const FIELDS = [
  { key: "tenantName", label: "Nome da empresa", type: "text", icon: Building2 },
  { key: "name", label: "Seu nome", type: "text", icon: User },
  { key: "email", label: "E-mail", type: "email", icon: Mail },
  { key: "password", label: "Senha (mín. 8 caracteres)", type: "password", icon: Lock },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ tenantName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/auth/register", { method: "POST", body: form });
      router.push("/login");
    } catch (err: any) {
      setError(err.message ?? "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Comece a gerenciar suas instâncias de WhatsApp.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {FIELDS.map(({ key, label, type, icon: Icon }) => (
          <div key={key}>
            <label className="text-sm text-muted block mb-1.5">{label}</label>
            <div className="relative">
              <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type={type}
                required
                minLength={key === "password" ? 8 : undefined}
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full bg-background/70 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        ))}

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary to-primaryDark hover:brightness-110 text-black font-medium rounded-lg py-2.5 text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-glow"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Cadastrando...
            </>
          ) : (
            <>
              Cadastrar <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <p className="text-sm text-muted mt-6 text-center">
        Já tem conta?{" "}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
