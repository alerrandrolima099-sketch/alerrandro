import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

// Modernização visual (seção 37): trocando a fonte padrão do sistema pela
// Inter - é a fonte usada por boa parte dos produtos SaaS modernos
// (Linear, Vercel, etc.), com ótima legibilidade em telas escuras. Carregada
// via next/font/google, que baixa e otimiza o arquivo em build time (sem
// requisição externa em tempo de execução, sem "flash" de fonte trocando).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "LowZap - Gerenciamento de Instâncias e Automações",
  description: "Plataforma de gerenciamento de instâncias de WhatsApp Business e automações de atendimento",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable}`}>
      <body className="bg-background text-white min-h-screen font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
