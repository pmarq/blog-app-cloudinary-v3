import { useMemo } from "react";

type BriefItem = {
  id?: string;
  briefRunId?: string | null;
  title?: string;
  channel?: string;
  status?: string;
  scheduledAt?: string | null;
  objective?: string;
  theme?: string | null;
  scope?: string | null;
  sourceSignals?: {
    calendarTitle?: string;
    calendarScope?: string;
    calendarTheme?: string;
    portfolioRegions?: string[];
    opportunityTitles?: string[];
    strategyPillars?: string[];
  };
};

type CmoReviewSectionProps = {
  briefGenerationReady: boolean;
  briefGenerationIssues: string[];
  strategyId?: string | null;
  portfolioSnapshot: {
    territorialIndex?: {
      coverage?: {
        projectCount?: number;
        neighborhoodCount?: number;
        cityCount?: number;
      };
      territorialSummary?: string;
      focusNeighborhoods?: string[];
      focusCities?: string[];
    };
    mainNeighborhoods?: string[];
    mainCities?: string[];
    strategicSummary?: string;
  } | null;
  cmoRunTrace: {
    opportunitySearchId: string | null;
    strategyId: string | null;
    calendarRunId: string | null;
    briefRunId: string | null;
    selectedOpportunityTitles: string[];
  };
  uniqueBriefItems: BriefItem[];
  pautaIaItemsCount: number;
  pautaUserItemsCount: number;
  briefsError: string | null;
  onApproveBrief: (brief: BriefItem) => void;
  onSendBriefToAgenda: (brief: BriefItem) => void;
  onOpenBriefEdit: (brief: BriefItem) => void;
  onOpenBriefDraft: (brief: BriefItem) => void;
  getBriefSourceLabel: (brief: BriefItem) => string;
};

export function CmoReviewSection({
  briefGenerationReady,
  briefGenerationIssues,
  strategyId,
  portfolioSnapshot,
  cmoRunTrace,
  uniqueBriefItems,
  pautaIaItemsCount,
  pautaUserItemsCount,
  briefsError,
  onApproveBrief,
  onSendBriefToAgenda,
  onOpenBriefEdit,
  onOpenBriefDraft,
  getBriefSourceLabel,
}: CmoReviewSectionProps) {
  const hasBriefs = uniqueBriefItems.length > 0;
  const briefPreview = uniqueBriefItems.slice(0, 6);
  const territorialSnapshot = useMemo(() => {
    const territorialIndex = portfolioSnapshot?.territorialIndex || null;
    const topNeighborhoods = uniqueStrings([
      ...(territorialIndex?.focusNeighborhoods || []),
      ...(portfolioSnapshot?.mainNeighborhoods || []),
    ]);
    const topCities = uniqueStrings([
      ...(territorialIndex?.focusCities || []),
      ...(portfolioSnapshot?.mainCities || []),
    ]);
    const coverage =
      territorialIndex?.coverage?.neighborhoodCount || territorialIndex?.coverage?.cityCount
        ? `${territorialIndex?.coverage?.neighborhoodCount || 0} bairros • ${territorialIndex?.coverage?.cityCount || 0} cidades`
        : `${topNeighborhoods.length} bairros • ${topCities.length} cidades`;

    return {
      summary:
        territorialIndex?.territorialSummary ||
        portfolioSnapshot?.strategicSummary ||
        "Sem índice territorial disponível.",
      topNeighborhoods: topNeighborhoods.slice(0, 6),
      topCities: topCities.slice(0, 4),
      coverage,
    };
  }, [portfolioSnapshot]);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
            Gate de qualidade
          </div>
          {briefGenerationReady ? (
            <div className="text-sm text-secondary-dark dark:text-secondary-light">
              Contexto suficiente para gerar briefs com menos ruído.
            </div>
          ) : (
            <div className="space-y-2 text-sm text-secondary-dark dark:text-secondary-light">
              <div>Bloqueado até resolver os pontos abaixo:</div>
              <ul className="space-y-1 text-xs text-secondary-dark/80 dark:text-secondary-light/80">
                {briefGenerationIssues.map((issue) => (
                  <li key={issue} className="rounded border border-secondary-dark/10 px-2 py-1">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
            Próxima ação
          </div>
          <div className="text-sm text-secondary-dark dark:text-secondary-light">
            {strategyId
              ? "Cruzar calendário, contexto e pautas para gerar briefs mais específicos."
              : "Gerar o plano CMO antes de seguir para briefs."}
          </div>
        </div>
        <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
            Território
          </div>
          <div className="text-sm text-secondary-dark dark:text-secondary-light">
            {territorialSnapshot.coverage}
          </div>
          <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
            {territorialSnapshot.topNeighborhoods.length
              ? territorialSnapshot.topNeighborhoods.slice(0, 4).join(" • ")
              : "Sem bairros priorizados"}
          </div>
        </div>
        <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
            Revisão
          </div>
          <div className="text-sm text-secondary-dark dark:text-secondary-light">
            Depois disso, o usuário revisa o rascunho e abre o editor final.
          </div>
        </div>
      </div>

      <div className="grid gap-2 rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/20 dark:bg-black/10 p-3 text-xs text-secondary-dark/75 dark:text-secondary-light/75 md:grid-cols-4">
        <TraceCard label="Oportunidade" value={cmoRunTrace.opportunitySearchId || "sem id"} />
        <TraceCard label="Estratégia" value={cmoRunTrace.strategyId || "sem id"} />
        <TraceCard label="Calendário" value={cmoRunTrace.calendarRunId || "sem id"} />
        <TraceCard label="Briefs" value={cmoRunTrace.briefRunId || "sem id"} />
        <div className="md:col-span-4">
          <div className="font-semibold text-secondary-dark dark:text-secondary-light">
            Seleção que alimentou a revisão
          </div>
          <div className="mt-1">
            {cmoRunTrace.selectedOpportunityTitles.length
              ? cmoRunTrace.selectedOpportunityTitles.slice(0, 4).join(" • ")
              : "Nenhuma oportunidade selecionada ainda"}
          </div>
        </div>
      </div>

      <div id="cmo-revisao" className="space-y-4">
        <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Revisão editorial
              </div>
              <div className="text-sm text-secondary-dark/80 dark:text-secondary-light/80">
                Ajuste, aprove e envie só o que realmente vale seguir adiante.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <MetricPill label="IA" value={pautaIaItemsCount} />
              <MetricPill label="Usuário" value={pautaUserItemsCount} />
              <MetricPill label="Briefs" value={uniqueBriefItems.length} />
            </div>
          </div>

          {briefsError ? (
            <div className="mt-3 rounded border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">
              <div className="font-semibold">Erro ao gerar pautas</div>
              <pre className="mt-2 whitespace-pre-wrap break-words">{briefsError}</pre>
            </div>
          ) : null}
        </div>

        {hasBriefs && briefGenerationReady ? (
          <details className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-4" open>
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-highlight-light">
              Ver briefs gerados
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {briefPreview.map((brief, index) => (
                <BriefCard
                  key={brief.id || `${brief.briefRunId || "brief"}-${brief.title || "untitled"}-${brief.scheduledAt || "no-date"}-${index}`}
                  brief={brief}
                  getBriefSourceLabel={getBriefSourceLabel}
                  onApproveBrief={onApproveBrief}
                  onSendBriefToAgenda={onSendBriefToAgenda}
                  onOpenBriefEdit={onOpenBriefEdit}
                  onOpenBriefDraft={onOpenBriefDraft}
                />
              ))}
            </div>
            {uniqueBriefItems.length > briefPreview.length ? (
              <div className="mt-3 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                Mostrando {briefPreview.length} de {uniqueBriefItems.length} briefs.
              </div>
            ) : null}
          </details>
        ) : hasBriefs ? (
          <div className="rounded border border-dashed border-secondary-dark/20 dark:border-secondary-light/20 p-4 text-sm text-secondary-dark/70 dark:text-secondary-light/70">
            As pautas já existem, mas a revisão ainda está bloqueada. Gere estratégia e calendário antes.
          </div>
        ) : (
          <div className="rounded border border-dashed border-secondary-dark/20 dark:border-secondary-light/20 p-4 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
            Nenhum brief gerado ainda.
          </div>
        )}
      </div>
    </>
  );
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-3 py-2 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
      <span className="font-semibold text-secondary-dark dark:text-secondary-light">{value}</span> {label}
    </div>
  );
}

function TraceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 px-3 py-2">
      <div className="font-semibold text-secondary-dark dark:text-secondary-light">{label}</div>
      <div className="mt-1 break-all">{value}</div>
    </div>
  );
}

function previewText(value: string, fallback: string, maxLength = 120): string {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return fallback;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function BriefCard({
  brief,
  getBriefSourceLabel,
  onApproveBrief,
  onSendBriefToAgenda,
  onOpenBriefEdit,
  onOpenBriefDraft,
}: {
  brief: BriefItem;
  getBriefSourceLabel: (brief: BriefItem) => string;
  onApproveBrief: (brief: BriefItem) => void;
  onSendBriefToAgenda: (brief: BriefItem) => void;
  onOpenBriefEdit: (brief: BriefItem) => void;
  onOpenBriefDraft: (brief: BriefItem) => void;
}) {
  return (
    <div className="h-full rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-4 space-y-3 flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
            {brief.title || "Brief sem título"}
          </div>
          <div className="text-[11px] font-medium text-secondary-dark/80 dark:text-secondary-light/75">
            {brief.channel || "blog"} • {brief.status || "rascunho"} •{" "}
            {brief.scheduledAt ? new Date(brief.scheduledAt).toLocaleDateString("pt-BR") : "sem data"}
          </div>
          <div className="text-[11px] text-secondary-dark/75 dark:text-secondary-light/70">
            {previewText(brief.objective || "", "Sem objetivo definido.", 120)}
          </div>
        </div>
        <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 px-2 py-0.5 text-[9px] text-secondary-dark/70 dark:text-secondary-light/70">
          {getBriefSourceLabel(brief)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {brief.sourceSignals
          ? uniqueStrings([
              ...(brief.sourceSignals.calendarTitle ? [brief.sourceSignals.calendarTitle] : []),
              ...(brief.sourceSignals.calendarScope ? [brief.sourceSignals.calendarScope] : []),
              ...(brief.sourceSignals.calendarTheme ? [brief.sourceSignals.calendarTheme] : []),
              ...(brief.sourceSignals.portfolioRegions || []),
              ...(brief.sourceSignals.opportunityTitles || []),
              ...(brief.sourceSignals.strategyPillars || []),
            ])
              .slice(0, 4)
              .map((chip) => (
                <span
                  key={`${brief.id || brief.title || "brief"}-${chip}`}
                  className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[9px] text-secondary-dark/70 dark:text-secondary-light/70"
                >
                  {chip}
                </span>
              ))
          : null}
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onApproveBrief(brief)}
          className="rounded border border-secondary-dark/30 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
        >
          Aprovar
        </button>
        <button
          type="button"
          onClick={() => onSendBriefToAgenda(brief)}
          className="rounded border border-highlight-light px-3 py-1 text-xs font-semibold text-highlight-light transition hover:bg-secondary-light/20"
        >
          Enviar
        </button>
        <button
          type="button"
          onClick={() => onOpenBriefEdit(brief)}
          className="rounded border border-secondary-dark/30 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => onOpenBriefDraft(brief)}
          className="rounded border border-secondary-dark/30 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
        >
          Rascunho
        </button>
      </div>
    </div>
  );
}



