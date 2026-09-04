"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message ?? "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Acesse sua conta para gerenciar suas instâncias.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-muted block mb-1.5">E-mail</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background/70 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              placeholder="voce@empresa.com"
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-muted block mb-1.5">Senha</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background/70 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary to-primaryDark hover:brightness-110 text-white font-medium rounded-lg py-2.5 text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-glow"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Entrando...
            </>
          ) : (
            <>
              Entrar <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <p className="text-sm text-muted mt-6 text-center">
        Não tem conta?{" "}
        <Link href="/register" className="text-primary hover:underline font-medium">
          Cadastre-se
        </Link>
      </p>
    </AuthShell>
  );
}
