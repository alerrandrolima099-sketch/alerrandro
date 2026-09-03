import { MessageCircle, Zap, ShieldCheck, Sparkles } from "lucide-react";

const FEATURES = [
  { icon: Zap, text: "Automações e respostas por IA em tempo real" },
  { icon: MessageCircle, text: "Todas as conversas centralizadas em um só lugar" },
  { icon: ShieldCheck, text: "Aquecimento de números para proteger suas contas" },
];

/**
 * Layout compartilhado das telas de autenticação (login/cadastro) - seção
 * 37 (modernização visual). Em telas médias+ mostra um painel de marca à
 * esquerda (gradiente + blobs animados + destaques do produto) e o
 * formulário (passado como children) em um cartão de vidro à direita; em
 * telas pequenas, só o formulário aparece, com o logo compacto no topo.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Painel de marca - some em telas pequenas */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden bg-gradient-to-br from-[#0d1420] via-[#0a0d13] to-[#0d1118] border-r border-border">
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-blob"
          aria-hidden
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-accent/20 blur-3xl animate-blob"
          style={{ animationDelay: "-7s" }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lowzap-icon.png" alt="LowZap" className="w-10 h-10 rounded-xl shadow-glow" />
            <span className="font-semibold text-lg tracking-tight">LowZap</span>
          </div>

          <div className="space-y-8 max-w-md">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
              <Sparkles size={12} />
              Plataforma de atendimento via WhatsApp
            </div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Gerencie todas as suas conversas em <span className="text-gradient-primary">um só lugar</span>
            </h2>
            <ul className="space-y-4">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-muted">
                  <span className="w-8 h-8 rounded-lg bg-surface border border-borderLight flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-primary" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted">© {new Date().getFullYear()} LowZap. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lowzap-icon.png" alt="LowZap" className="w-9 h-9 rounded-xl" />
            <span className="font-semibold text-lg tracking-tight">LowZap</span>
          </div>

          <div className="glass rounded-2xl p-8 shadow-card">
            <h1 className="text-xl font-semibold mb-1 tracking-tight">{title}</h1>
            <p className="text-sm text-muted mb-6">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
