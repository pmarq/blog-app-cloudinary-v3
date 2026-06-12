import Link from "next/link";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";

const entryPoints = [
  {
    href: "/dashboard/studio/cmo/workspace",
    title: "Workspace completo",
    description: "Abre o fluxo completo: diagnóstico, pautas, revisão e entrega.",
    accent: "Execução",
  },
  {
    href: "/dashboard/studio/cmo/company-profile",
    title: "Perfil da empresa",
    description: "Ajusta posicionamento, público, regiões, tom e guardrails.",
    accent: "Base",
  },
  {
    href: "/dashboard/studio/cmo/portfolio",
    title: "Portfólio",
    description: "Lê o inventário, cruza sinais e prepara a leitura do mês.",
    accent: "Diagnóstico",
  },
  {
    href: "/dashboard/studio/cmo/briefs",
    title: "Briefs",
    description: "Revisa pautas, aprova briefs e envia para produção.",
    accent: "Produção",
  },
];

const flowSteps = [
  {
    step: "01",
    title: "Perfil da empresa",
    description: "Defina posicionamento, público, tom e guardrails antes de produzir qualquer pauta.",
    href: "/dashboard/studio/cmo/company-profile",
  },
  {
    step: "02",
    title: "Workspace completo",
    description: "Leitura guiada do contexto, do portfólio e dos sinais que sustentam a estratégia.",
    href: "/dashboard/studio/cmo/workspace",
  },
  {
    step: "03",
    title: "Briefs e rascunhos",
    description: "Revise pautas, gere rascunhos e empurre apenas o que já tem contexto suficiente.",
    href: "/dashboard/studio/cmo/briefs",
  },
];

export default function CmoHubPage() {
  return (
    <AdminLayout>
      <div className="max-w-7xl space-y-6">
        <StudioNav />

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-2xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-gradient-to-br from-highlight-light/10 via-white/30 to-white/10 dark:from-highlight-dark/10 dark:via-black/10 dark:to-black/20 p-6 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-highlight-light/20 bg-white/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-highlight-light dark:border-highlight-dark/20 dark:bg-black/20 dark:text-highlight-dark">
              CMO Studio
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-secondary-dark dark:text-secondary-light">
              Entrada operacional para estratégia, briefs e produção.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary-dark/80 dark:text-secondary-light/80">
              O hub não deve parecer um painel genérico. Ele precisa dizer, sem ambiguidade, onde começa o fluxo,
              quais decisões vêm primeiro e qual rota seguir para sair do ruído e chegar a conteúdo útil.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {entryPoints.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="group rounded-xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/60 dark:bg-black/20 p-4 transition hover:-translate-y-0.5 hover:border-highlight-light/40"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-highlight-light">
                    {entry.accent}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-secondary-dark dark:text-secondary-light">
                    {entry.title}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-secondary-dark/75 dark:text-secondary-light/75">
                    {entry.description}
                  </div>
                  <div className="mt-4 text-xs font-semibold text-highlight-light">
                    Abrir →
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-highlight-light">
              Fluxo recomendado
            </div>
            <div className="mt-3 space-y-3">
              {flowSteps.map((item) => (
                <Link
                  key={item.step}
                  href={item.href}
                  className="block rounded-xl border border-secondary-dark/10 dark:border-secondary-light/10 bg-white/50 dark:bg-black/15 p-4 transition hover:border-highlight-light/35 hover:bg-white/70 dark:hover:bg-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-dark/60 dark:text-secondary-light/60">
                        {item.step}
                      </div>
                      <div className="text-sm font-semibold text-secondary-dark dark:text-secondary-light">
                        {item.title}
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-highlight-light">Abrir →</div>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-secondary-dark/75 dark:text-secondary-light/75">
                    {item.description}
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-highlight-light/20 bg-highlight-light/10 p-4 text-sm leading-6 text-secondary-dark dark:text-secondary-light">
              Se a empresa ainda não tem contexto confiável, comece pelo perfil. Se já existe base, siga para o
              workspace e só depois avance para briefs.
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/45 dark:bg-black/10 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-highlight-light">
              Por que esta área existe
            </div>
            <div className="mt-3 grid gap-3 text-sm leading-6 text-secondary-dark/80 dark:text-secondary-light/80">
              <div>• Separar contexto, estratégia e produção evita gerar conteúdo desconectado do negócio.</div>
              <div>• O CMO precisa ser um sistema de decisão, não um botão de texto genérico.</div>
              <div>• Cada empresa deve operar com seu próprio perfil, portfólio e guardrails.</div>
              <div>• O objetivo é chegar em brief e rascunho com menos tentativa e erro.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/45 dark:bg-black/10 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-highlight-light">
              Atalhos úteis
            </div>
            <div className="mt-3 grid gap-3">
              <Link
                href="/dashboard/studio/cmo/workspace"
                className="rounded-xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/60 dark:bg-black/20 p-4 transition hover:border-highlight-light/40"
              >
                <div className="text-sm font-semibold text-secondary-dark dark:text-secondary-light">
                  Abrir workspace completo
                </div>
                <div className="mt-1 text-xs leading-5 text-secondary-dark/75 dark:text-secondary-light/75">
                  Diagnóstico, pautas e revisão em um fluxo único.
                </div>
              </Link>
              <Link
                href="/dashboard/studio/cmo/briefs"
                className="rounded-xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/60 dark:bg-black/20 p-4 transition hover:border-highlight-light/40"
              >
                <div className="text-sm font-semibold text-secondary-dark dark:text-secondary-light">
                  Ir direto para revisão de briefs
                </div>
                <div className="mt-1 text-xs leading-5 text-secondary-dark/75 dark:text-secondary-light/75">
                  Útil quando a empresa já tem base definida e precisa produzir.
                </div>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
