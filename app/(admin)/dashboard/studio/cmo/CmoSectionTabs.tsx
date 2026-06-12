type CmoSectionTabsProps = {
  activeSection: "diagnostico" | "pautas" | "revisao";
  onChange: (section: "diagnostico" | "pautas" | "revisao") => void;
};

export function CmoSectionTabs({ activeSection, onChange }: CmoSectionTabsProps) {
  return (
    <div className="rounded-2xl border border-secondary-dark/10 dark:border-secondary-light/10 bg-white/20 p-2 shadow-sm backdrop-blur">
      <div className="grid gap-2 md:grid-cols-3">
      {[
        {
          key: "diagnostico",
          title: "Diagnóstico",
          description: "Perfil da empresa, portfólio e direção estratégica.",
        },
        {
          key: "pautas",
          title: "Pautas",
          description: "Ideias IA e pautas do usuário em um só lugar.",
        },
        {
          key: "revisao",
          title: "Revisão",
          description: "Briefs, rascunhos e envio para produção.",
        },
      ].map((step) => {
        const isActive = activeSection === step.key;
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onChange(step.key as "diagnostico" | "pautas" | "revisao")}
            className={`rounded-xl border p-4 text-left transition ${
              isActive
                ? "border-highlight-light bg-highlight-light/10 text-secondary-dark dark:border-highlight-dark dark:bg-highlight-dark/10 dark:text-secondary-light"
                : "border-secondary-dark/15 bg-white/25 text-secondary-dark hover:bg-white/35 dark:border-secondary-light/15 dark:bg-black/10 dark:text-secondary-light dark:hover:bg-black/15"
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-highlight-light">
              {step.title}
            </div>
            <div className="mt-2 text-sm leading-6 opacity-80">{step.description}</div>
          </button>
        );
      })}
      </div>
    </div>
  );
}
