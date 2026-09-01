"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, setTokens, clearTokens } from "./api";

type User = { sub: string; tenantId: string; role: "ADMIN" | "CLIENT" };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: User }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await api<{ accessToken: string; refreshToken: string; user: any }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setTokens(data.accessToken, data.refreshToken);
    const me = await api<{ user: User }>("/auth/me");
    setUser(me.user);
    router.push("/dashboard");
  }

  function logout() {
    clearTokens();
    setUser(null);
    router.push("/login");
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
