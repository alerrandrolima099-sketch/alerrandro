"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
        <h1 className="text-xl font-semibold mb-1">Criar conta</h1>
        <p className="text-sm text-muted mb-6">Comece a gerenciar suas instâncias de WhatsApp.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: "tenantName", label: "Nome da empresa", type: "text" },
            { key: "name", label: "Seu nome", type: "text" },
            { key: "email", label: "E-mail", type: "email" },
            { key: "password", label: "Senha (mín. 8 caracteres)", type: "password" },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-sm text-muted block mb-1.5">{f.label}</label>
              <input
                type={f.type}
                required
                minLength={f.key === "password" ? 8 : undefined}
                value={(form as any)[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primaryDark text-black font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60"
          >
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>

        <p className="text-sm text-muted mt-6 text-center">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
