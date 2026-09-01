import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "WhatsApp SaaS - Gerenciamento de Instâncias e Automações",
  description: "Plataforma de gerenciamento de instâncias de WhatsApp Business e automações de atendimento",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-background text-white min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
