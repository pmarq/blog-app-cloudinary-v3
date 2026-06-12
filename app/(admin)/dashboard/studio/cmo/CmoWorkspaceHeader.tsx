type CmoWorkspaceHeaderProps = {
  cmoStage: string;
  profileScore: number;
  profileState: "forte" | "ok" | "incompleto";
  missingFields: string[];
  activeProducts: number;
  opportunities: number;
  calendarItems: number;
  briefs: number;
  strategies: number;
  title: string;
  description: string;
  hint: string;
  actionLabel: string;
  onExecuteNextStep: () => void;
  onJumpToSection: (section: "diagnostico" | "pautas" | "revisao") => void;
  disabled: boolean;
};

export function CmoWorkspaceHeader({
  cmoStage,
  profileScore,
  profileState,
  missingFields,
  activeProducts,
  opportunities,
  calendarItems,
  briefs,
  strategies,
  title,
  description,
  hint,
  actionLabel,
  onExecuteNextStep,
  onJumpToSection,
  disabled,
}: CmoWorkspaceHeaderProps) {
  const readinessLabel =
    profileState === "forte" ? "pronto" : profileState === "ok" ? "quase pronto" : "incompleto";

  const keyMetrics = [
    {
      label: "Perfil",
      value: `${profileScore}%`,
      detail:
        profileState === "forte"
          ? "base forte para gerar estratégia"
          : profileState === "ok"
            ? "base funcional, ainda com lacunas"
            : "precisa de contexto antes de avançar",
    },
    {
      label: "Contexto",
      value: String(activeProducts + opportunities),
      detail: `${activeProducts} produtos • ${opportunities} sinais de mercado`,
    },
    {
      label: "Saída",
      value: String(briefs),
      detail: `${calendarItems} itens no calendário • ${strategies} estratégias`,
    },
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
      <div className="rounded-2xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-gradient-to-br from-highlight-light/10 via-white/35 to-white/10 dark:from-highlight-dark/10 dark:via-black/10 dark:to-black/20 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-highlight-light/20 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-highlight-light dark:border-highlight-dark/20 dark:bg-black/20 dark:text-highlight-dark">
            CMO Studio
          </div>
          <div className="rounded-full border border-secondary-dark/15 bg-white/50 px-3 py-1 text-[11px] font-medium text-secondary-dark/70 dark:border-secondary-light/15 dark:bg-black/15 dark:text-secondary-light/70">
            Base {profileScore}% {readinessLabel}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-secondary-dark dark:text-secondary-light">
            Um fluxo editorial que transforma perfil, portfólio e mercado em pauta útil.
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-secondary-dark/80 dark:text-secondary-light/80">
            A jornada vai do perfil da empresa ao brief pronto para produção. Cada etapa existe para reduzir
            ruído, evitar conteúdo genérico e chegar em decisões editoriais com contexto real.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {keyMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/60 dark:bg-black/20 p-4"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-dark/60 dark:text-secondary-light/60">
                {metric.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-secondary-dark dark:text-secondary-light">
                {metric.value}
              </div>
              <div className="mt-1 text-xs leading-5 text-secondary-dark/70 dark:text-secondary-light/70">
                {metric.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onJumpToSection("diagnostico")}
            className="rounded-full border border-secondary-dark/20 bg-white/60 px-4 py-2 text-xs font-semibold text-secondary-dark transition hover:bg-white dark:border-secondary-light/20 dark:bg-black/20 dark:text-secondary-light"
          >
            Ver diagnóstico
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection("pautas")}
            className="rounded-full border border-secondary-dark/20 bg-white/60 px-4 py-2 text-xs font-semibold text-secondary-dark transition hover:bg-white dark:border-secondary-light/20 dark:bg-black/20 dark:text-secondary-light"
          >
            Revisar pautas
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection("revisao")}
            className="rounded-full border border-secondary-dark/20 bg-white/60 px-4 py-2 text-xs font-semibold text-secondary-dark transition hover:bg-white dark:border-secondary-light/20 dark:bg-black/20 dark:text-secondary-light"
          >
            Ir para revisão
          </button>
        </div>

        {missingFields.length ? (
          <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-secondary-dark dark:text-secondary-light">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              faltando contexto
            </div>
            <div className="mt-2 leading-6">
              Preencha: {missingFields.slice(0, 3).join(", ")}
              {missingFields.length > 3 ? ` e mais ${missingFields.length - 3}.` : "."}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-highlight-light">
              Próximo passo
            </div>
            <h2 className="text-xl font-semibold text-secondary-dark dark:text-secondary-light">
              {title}
            </h2>
            <p className="text-sm leading-6 text-secondary-dark/80 dark:text-secondary-light/80">
              {description}
            </p>
          </div>
          <div className="rounded-xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/60 dark:bg-black/20 px-3 py-2 text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-dark/60 dark:text-secondary-light/60">
              estágio
            </div>
            <div className="text-sm font-semibold text-secondary-dark dark:text-secondary-light">
              {cmoStage}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-highlight-light/20 bg-highlight-light/10 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-highlight-light">
            O que acontece ao clicar
          </div>
          <div className="mt-2 text-sm leading-6 text-secondary-dark dark:text-secondary-light">
            {hint}
          </div>
        </div>

        <button
          type="button"
          onClick={onExecuteNextStep}
          disabled={disabled}
          className="mt-5 w-full rounded-xl bg-highlight-light px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {actionLabel}
        </button>

        <div className="mt-4 grid gap-2">
          {[ 
            "1. Ajuste o perfil e os guardrails.",
            "2. Leia o portfólio e os sinais de mercado.",
            "3. Gere estratégia, pauta e rascunho.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-lg border border-secondary-dark/10 dark:border-secondary-light/10 bg-white/35 dark:bg-black/15 px-3 py-2 text-xs text-secondary-dark/75 dark:text-secondary-light/75"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
