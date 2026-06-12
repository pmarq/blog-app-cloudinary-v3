type EditorialSuggestion = {
  id: string;
  category: "Mercado" | "Produto" | "Autoridade" | "Indicadores";
  label: string;
  rationale: string;
  evidence: string[];
};

type CmoPautasSectionProps = {
  activePautaView: "ia" | "usuario";
  aiTopicSuggestionSummary: string;
  aiTopicSuggestions: EditorialSuggestion[];
  aiTopicSuggestionGroups: Array<{
    category: EditorialSuggestion["category"];
    items: EditorialSuggestion[];
  }>;
  manualTopicSuggestions: string[];
  manualTopics: string;
  onActivePautaViewChange: (value: "ia" | "usuario") => void;
  onAppendAllAiSuggestions: () => void;
  onAppendTopic: (topic: string) => void;
  onManualTopicsChange: (value: string) => void;
  onUseExamples: () => void;
  getSuggestionChipText: (suggestion: EditorialSuggestion) => string;
};

export function CmoPautasSection({
  activePautaView,
  aiTopicSuggestionSummary,
  aiTopicSuggestions,
  aiTopicSuggestionGroups,
  manualTopicSuggestions,
  manualTopics,
  onActivePautaViewChange,
  onAppendAllAiSuggestions,
  onAppendTopic,
  onManualTopicsChange,
  onUseExamples,
  getSuggestionChipText,
}: CmoPautasSectionProps) {
  const hasAiSuggestions = aiTopicSuggestions.length > 0;
  const hasManualTopics = manualTopicSuggestions.length > 0;

  return (
    <div
      id="cmo-pautas"
      className="space-y-4 rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-4"
    >
      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
            Pautas por origem
          </div>
          <p className="text-sm text-secondary-dark/80 dark:text-secondary-light/80">
            A IA sugere pautas com base no contexto real. O usuário completa o que fizer sentido e ignora o resto.
          </p>
          <div className="text-[11px] text-secondary-dark/60 dark:text-secondary-light/60">
            Base usada: {aiTopicSuggestionSummary}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <CountPill
              label={hasAiSuggestions ? "sugestões IA" : "IA aguardando contexto"}
              value={aiTopicSuggestions.length}
            />
            <CountPill
              label={hasManualTopics ? "pautas do usuário" : "sem pautas manuais"}
              value={manualTopicSuggestions.length}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {[
            { key: "ia", label: `IA (${aiTopicSuggestions.length})` },
            { key: "usuario", label: `Usuário (${manualTopicSuggestions.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onActivePautaViewChange(tab.key as "ia" | "usuario")}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                activePautaView === tab.key
                  ? "border-highlight-light bg-highlight-light/10 text-highlight-light"
                  : "border-secondary-dark/20 bg-white/20 text-secondary-dark hover:bg-white/35 dark:border-secondary-light/20 dark:text-secondary-light dark:hover:bg-black/15"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onAppendAllAiSuggestions}
            disabled={!hasAiSuggestions}
            className="rounded-full border border-highlight-light px-3 py-2 text-xs font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
          >
            Usar todas as sugestões IA
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <details
            className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3 space-y-3"
            open={hasAiSuggestions}
          >
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-highlight-light">
              Sugestões IA
            </summary>
            <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
              Ideias úteis para o blog, com base em portfólio, oportunidades e agenda.
            </div>

            {hasAiSuggestions ? (
              <div className="space-y-3">
                {aiTopicSuggestionGroups.map((group) =>
                  group.items.length ? (
                    <div key={group.category} className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-dark/60 dark:text-secondary-light/60">
                        {group.category}
                      </div>
                      <div className="space-y-2">
                        {group.items.slice(0, 3).map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => onAppendTopic(suggestion.label)}
                            className="w-full rounded-xl border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 px-3 py-3 text-left transition hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/30"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-medium text-secondary-dark dark:text-secondary-light">
                                + {getSuggestionChipText(suggestion)}
                              </div>
                              <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 px-2 py-0.5 text-[10px] text-secondary-dark/60 dark:text-secondary-light/60">
                                adicionar
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] leading-4 text-secondary-dark/70 dark:text-secondary-light/70">
                              {suggestion.rationale}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {suggestion.evidence.slice(0, 3).map((evidence, evidenceIndex) => (
                                <span
                                  key={`${suggestion.id}-evidence-${evidenceIndex}`}
                                  className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 px-2 py-0.5 text-[10px] text-secondary-dark/70 dark:text-secondary-light/70"
                                >
                                  {evidence}
                                </span>
                              ))}
                            </div>
                          </button>
                        ))}
                        {group.items.length > 3 ? (
                          <div className="text-[11px] text-secondary-dark/60 dark:text-secondary-light/60">
                            + {group.items.length - 3} sugestões adicionais neste grupo.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null,
                )}
                <div className="rounded-xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/20 dark:bg-black/10 p-3 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                  Clique em uma sugestão para jogá-la na coluna do usuário.
                </div>
              </div>
            ) : (
              <div className="rounded border border-dashed border-secondary-dark/20 dark:border-secondary-light/20 p-3 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                Complete o contexto para gerar sugestões mais precisas.
              </div>
            )}
          </details>
        </div>

        <div className="space-y-3">
          <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
              Pautas do usuário
            </div>
            <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
              {activePautaView === "usuario"
                ? "Aqui entram as pautas que você quer forçar no plano editorial."
                : "Use essa coluna quando quiser forçar temas específicos no plano editorial."}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
              Uma pauta por linha.
            </div>
            <button
              type="button"
              onClick={onUseExamples}
              className="rounded border border-secondary-dark/20 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/20"
            >
              Usar exemplos
            </button>
          </div>

          <TextAreaField label="Pautas sugeridas" value={manualTopics} onChange={onManualTopicsChange} rows={6} />

          <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
              Pré-visualização
            </div>
            {manualTopicSuggestions.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {manualTopicSuggestions.slice(0, 6).map((topic, index) => (
                  <div
                    key={`${topic}-${index}`}
                    className="rounded border border-secondary-dark/10 px-2 py-1 text-sm text-secondary-dark dark:text-secondary-light"
                  >
                    {topic}
                  </div>
                ))}
                {manualTopicSuggestions.length > 6 ? (
                  <div className="text-xs text-secondary-dark/60 dark:text-secondary-light/60 sm:col-span-2">
                    + {manualTopicSuggestions.length - 6} pautas adicionais.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                Nenhuma pauta sugerida pelo usuário ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="space-y-1">
      <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
      />
    </label>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 px-3 py-1 text-[11px] text-secondary-dark/70 dark:text-secondary-light/70">
      <span className="font-semibold text-secondary-dark dark:text-secondary-light">{value}</span> {label}
    </span>
  );
}
