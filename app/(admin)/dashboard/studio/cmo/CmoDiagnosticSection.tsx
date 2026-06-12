import { useMemo } from "react";

type CompanyProfileValue = {
  name: string;
  positioning: string;
  valueProposition: string;
  preferredTone: string;
  audience: string[];
  commercialGoals: string[];
  marketSegment: string[];
  regions: string[];
  forbiddenTopics: string[];
  preferredTopics: string[];
  channels: string[];
};

type DiagnosticSectionProps = {
  orgId: string;
  loadingProfile: boolean;
  loadingDrafts: boolean;
  savingProfile: boolean;
  analyzingPortfolio: boolean;
  searchingOpportunities: boolean;
  period: string;
  objective: string;
  generatingStrategy: boolean;
  generatingCalendar: boolean;
  generatingBriefs: boolean;
  opportunitySummary: {
    count: number;
    selectedCount: number;
    items: Array<{
      key: string;
      selected: boolean;
      title: string;
      scope: string;
      fitScore: number;
      relatedRegions?: string[];
      suggestedContents?: string[];
    }>;
  };
  selectedOpportunityKeys: string[];
  onToggleOpportunitySelection: (key: string) => void;
  onClearOpportunitySelection: () => void;
  companyProfile: CompanyProfileValue;
  profileFormValue: {
    audience: string;
    commercialGoals: string;
    marketSegment: string;
    regions: string;
    forbiddenTopics: string;
    preferredTopics: string;
    channels: string;
  };
  calendarItems: Array<{
    id?: string;
    calendarRunId?: string | null;
    title?: string;
    channel?: string;
    scope?: string;
    scheduledAt?: string | null;
    relatedRegions?: string[];
    theme?: string;
    angle?: string;
    objective?: string;
  }>;
  strategyObjective?: string;
  onProfileChange: (updater: (previous: CompanyProfileValue) => CompanyProfileValue) => void;
  onSaveProfile: () => void;
  onAnalyzePortfolio: () => void;
  onSearchOpportunities: () => void;
  onGenerateStrategy: () => void;
  onGenerateCalendar: () => void;
  onGenerateBriefs: () => void;
  onPeriodChange: (value: string) => void;
  onObjectiveChange: (value: string) => void;
  getCalendarItemSourceLabel: (item: {
    id?: string;
    calendarRunId?: string | null;
    title?: string;
    channel?: string;
    scope?: string;
    scheduledAt?: string | null;
    relatedRegions?: string[];
    theme?: string;
    angle?: string;
    objective?: string;
  }) => string;
};

export function CmoDiagnosticSection({
  orgId,
  loadingProfile,
  loadingDrafts,
  savingProfile,
  analyzingPortfolio,
  searchingOpportunities,
  period,
  objective,
  generatingStrategy,
  generatingCalendar,
  generatingBriefs,
  opportunitySummary,
  selectedOpportunityKeys,
  onToggleOpportunitySelection,
  onClearOpportunitySelection,
  companyProfile,
  profileFormValue,
  calendarItems,
  strategyObjective,
  onProfileChange,
  onSaveProfile,
  onAnalyzePortfolio,
  onSearchOpportunities,
  onGenerateStrategy,
  onGenerateCalendar,
  onGenerateBriefs,
  onPeriodChange,
  onObjectiveChange,
  getCalendarItemSourceLabel,
}: DiagnosticSectionProps) {
  const profileReady =
    Boolean(companyProfile.name.trim()) &&
    Boolean(companyProfile.positioning.trim()) &&
    Boolean(companyProfile.valueProposition.trim()) &&
    Boolean(companyProfile.preferredTone.trim()) &&
    companyProfile.audience.length > 0 &&
    companyProfile.commercialGoals.length > 0 &&
    companyProfile.marketSegment.length > 0 &&
    companyProfile.regions.length > 0;
  const strategyReady = Boolean(strategyObjective?.trim()) || calendarItems.length > 0;
  const agendaReady = calendarItems.length > 0;
  const calendarOverview = useMemo(
    () => ({
      totalItems: calendarItems.length,
      channels: uniqueStrings(calendarItems.map((item) => item.channel || "")),
      themes: uniqueStrings(
        calendarItems.flatMap((item) => [item.theme || "", item.angle || "", item.scope || ""]),
      ),
      nextTitle: calendarItems[0]?.title || "Nenhuma pauta gerada",
      nextObjective: calendarItems[0]?.objective || strategyObjective || "Sem objetivo definido.",
    }),
    [calendarItems, strategyObjective],
  );

  return (
    <section id="cmo-diagnostico" className="space-y-4">
      <div className="rounded-2xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/25 dark:bg-black/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-highlight-light">
              Fluxo guiado
            </div>
            <div className="text-sm text-secondary-dark/80 dark:text-secondary-light/80">
              Complete o perfil, valide o contexto e só então avance para estratégia, calendário e briefs.
            </div>
            {opportunitySummary.count ? (
              <div className="text-[11px] text-secondary-dark/60 dark:text-secondary-light/60">
                Radar de mercado atualizado: {opportunitySummary.count} sinais encontrados.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-secondary-dark/70 dark:text-secondary-light/70">
            <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-3 py-1">
              1. Perfil
            </span>
            <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-3 py-1">
              2. Portfólio
            </span>
            <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-3 py-1">
              3. Oportunidades
            </span>
            <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-3 py-1">
              4. Estratégia
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          id="cmo-company-profile"
          className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-secondary-light/10 dark:bg-secondary-dark/20 p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-highlight-light dark:text-highlight-dark">
              Perfil da empresa
            </h2>
            <span className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
              {loadingProfile
                ? "Carregando..."
                : loadingDrafts
                  ? "Atualizando drafts..."
                  : "Organização: " + orgId}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ProfileSummaryCard label="Nome" value={companyProfile.name || "Sem nome"} />
            <ProfileSummaryCard
              label="Posicionamento"
              value={previewText(companyProfile.positioning, "Descreva o posicionamento em poucas linhas.", 160)}
            />
            <ProfileSummaryCard
              label="Proposta de valor"
              value={previewText(companyProfile.valueProposition, "Descreva a proposta de valor.", 180)}
              className="md:col-span-2"
            />
            <ProfileSummaryCard
              label="Tom preferido"
              value={previewText(companyProfile.preferredTone, "Sem tom definido.")}
            />
            <ProfileSummaryCard
              label="Público-alvo"
              value={previewLines(profileFormValue.audience, "Sem público definido.")}
            />
            <ProfileSummaryCard
              label="Objetivos comerciais"
              value={previewLines(profileFormValue.commercialGoals, "Sem objetivos definidos.")}
            />
          </div>

          <details className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-highlight-light">
              Editar perfil
            </summary>
            <div className="mt-3 grid gap-3">
              <Field
                label="Nome"
                value={companyProfile.name}
                onChange={(value) => onProfileChange((prev) => ({ ...prev, name: value }))}
              />
              <TextAreaField
                label="Posicionamento"
                value={companyProfile.positioning}
                onChange={(value) => onProfileChange((prev) => ({ ...prev, positioning: value }))}
                rows={4}
                placeholder="Descreva a proposta estratégica da empresa em linguagem clara e consultiva."
              />
              <TextAreaField
                label="Proposta de valor"
                value={companyProfile.valueProposition}
                onChange={(value) =>
                  onProfileChange((prev) => ({ ...prev, valueProposition: value }))
                }
                rows={5}
                placeholder="Explique como a plataforma ajuda o cliente a decidir melhor."
              />
              <TextAreaField
                label="Tom preferido"
                value={companyProfile.preferredTone}
                onChange={(value) => onProfileChange((prev) => ({ ...prev, preferredTone: value }))}
                rows={3}
                placeholder="Ex.: sofisticado, consultivo, objetivo e comercialmente elegante"
              />
              <TextAreaField
                label="Público-alvo"
                value={profileFormValue.audience}
                onChange={(value) =>
                  onProfileChange((prev) => ({ ...prev, audience: fromLines(value) }))
                }
                rows={6}
                placeholder="Uma linha por segmento ou característica do público."
              />
              <TextAreaField
                label="Objetivos comerciais"
                value={profileFormValue.commercialGoals}
                onChange={(value) =>
                  onProfileChange((prev) => ({ ...prev, commercialGoals: fromLines(value) }))
                }
                rows={6}
                placeholder="Uma linha por objetivo comercial."
              />
            </div>
          </details>

          <details className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-highlight-light">
              Detalhes avançados
            </summary>
            <div className="mt-3 grid gap-3">
              <TextAreaField
                label="Segmentos de atuação"
                value={profileFormValue.marketSegment}
                onChange={(value) =>
                  onProfileChange((prev) => ({ ...prev, marketSegment: fromLines(value) }))
                }
              />
              <TextAreaField
                label="Regiões atendidas"
                value={profileFormValue.regions}
                onChange={(value) =>
                  onProfileChange((prev) => ({ ...prev, regions: fromLines(value) }))
                }
              />
              <TextAreaField
                label="Assuntos proibidos"
                value={profileFormValue.forbiddenTopics}
                onChange={(value) =>
                  onProfileChange((prev) => ({ ...prev, forbiddenTopics: fromLines(value) }))
                }
              />
              <TextAreaField
                label="Assuntos preferenciais"
                value={profileFormValue.preferredTopics}
                onChange={(value) =>
                  onProfileChange((prev) => ({ ...prev, preferredTopics: fromLines(value) }))
                }
              />
              <TextAreaField
                label="Canais"
                value={profileFormValue.channels}
                onChange={(value) =>
                  onProfileChange((prev) => ({ ...prev, channels: fromLines(value) }))
                }
              />
            </div>
          </details>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onSaveProfile}
              disabled={savingProfile}
              className="rounded border border-highlight-light px-4 py-2 text-sm font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
            >
              {savingProfile ? "Salvando..." : "Salvar perfil"}
            </button>
            <button
              type="button"
              onClick={onAnalyzePortfolio}
              disabled={analyzingPortfolio || !profileReady}
              className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
            >
              {analyzingPortfolio ? "Analisando..." : "Analisar portfólio"}
            </button>
            <button
              type="button"
              onClick={onSearchOpportunities}
              disabled={searchingOpportunities || !profileReady}
              className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
            >
              {searchingOpportunities ? "Buscando..." : "Buscar oportunidades"}
            </button>
          </div>

          <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
            {searchingOpportunities
              ? "Buscando oportunidades de mercado..."
              : opportunitySummary.count
                ? `${opportunitySummary.count} oportunidades encontradas • ${opportunitySummary.selectedCount} selecionadas.`
                : "Busca concluída. Ainda não há oportunidades visíveis para este contexto."}
          </div>

          {opportunitySummary.count ? (
            <details className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/20 dark:bg-black/10 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Oportunidades encontradas
              </summary>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                  Selecione as oportunidades que devem orientar estratégia, pautas e textos.
                </div>
                <button
                  type="button"
                  onClick={onClearOpportunitySelection}
                  disabled={!selectedOpportunityKeys.length}
                  className="rounded border border-secondary-dark/20 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/20 disabled:opacity-60"
                >
                  Limpar seleção
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {opportunitySummary.items.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-lg border p-3 transition ${
                      item.selected
                        ? "border-highlight-light bg-highlight-light/10 dark:border-highlight-dark dark:bg-highlight-dark/10"
                        : "border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10"
                    }`}
                  >
                    <details>
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                              {item.title}
                            </div>
                            <div className="text-[11px] font-medium text-secondary-dark/85 dark:text-secondary-light/75">
                              {item.scope} • fit {item.fitScore}
                            </div>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${
                              item.selected
                                ? "border-highlight-light bg-highlight-light/10 text-highlight-light"
                                : "border-secondary-dark/15 dark:border-secondary-light/15 text-secondary-dark/70 dark:text-secondary-light/70"
                            }`}
                          >
                            {item.selected ? "Selecionada" : "Selecionar"}
                          </span>
                        </div>
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {item.relatedRegions?.slice(0, 3).map((region) => (
                            <span
                              key={`${item.key}-${region}`}
                              className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[9px] font-medium text-secondary-dark/90 dark:text-secondary-light/80"
                            >
                              {region}
                            </span>
                          ))}
                        </div>
                        {item.suggestedContents?.length ? (
                          <div className="space-y-1">
                            {item.suggestedContents.slice(0, 2).map((line) => (
                              <div key={`${item.key}-${line}`} className="text-[11px] text-secondary-dark/75 dark:text-secondary-light/75">
                                • {line}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onToggleOpportunitySelection(item.key)}
                          className="rounded border border-secondary-dark/20 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/20"
                        >
                          {item.selected ? "Remover da seleção" : "Adicionar à seleção"}
                        </button>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        {profileReady ? (
          <div
            id="cmo-strategy"
            className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-secondary-light/10 dark:bg-secondary-dark/20 p-4 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-highlight-light dark:text-highlight-dark">
                  Estratégia
                </h2>
                <div className="text-sm text-secondary-dark/80 dark:text-secondary-light/80">
                  Defina o recorte mensal e transforme o diagnóstico em direção editorial.
                </div>
              </div>
              <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-3 py-1 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                {strategyReady ? "Pronto para avançar" : "Requer contexto completo"}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <ProfileSummaryCard
                label="Período"
                value={period || "AAAA-MM"}
                className="md:col-span-1"
              />
              <ProfileSummaryCard
                label="Objetivo"
                value={previewText(
                  objective,
                  "Ex.: aumentar leads qualificados para empreendimentos premium neste mês",
                  120,
                )}
                className="md:col-span-2"
              />
              <ProfileSummaryCard
                label="Próximo passo"
                value={
                  strategyReady
                    ? "O sistema já pode gerar estratégia, calendário e briefs."
                    : "Gere a estratégia para liberar calendário e briefs."
                }
                className="md:col-span-2"
              />
              <ProfileSummaryCard
                label="Ações prontas"
                value={[
                  generatingStrategy ? "Plano em geração" : "Gerar plano CMO",
                  generatingCalendar ? "Calendário em geração" : "Gerar calendário",
                  generatingBriefs ? "Briefs em geração" : "Criar pautas + briefs",
                ].join("\n")}
              />
            </div>

            <details className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Editar estratégia
              </summary>
              <div className="mt-3 grid gap-3">
                <Field label="Período" value={period} onChange={onPeriodChange} placeholder="AAAA-MM" />
                <TextAreaField
                  label="Objetivo"
                  value={objective}
                  onChange={onObjectiveChange}
                  placeholder="Ex.: aumentar leads qualificados para empreendimentos premium neste mês"
                  rows={4}
                />
              </div>
            </details>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGenerateStrategy}
                disabled={generatingStrategy}
                className="rounded border border-highlight-light px-4 py-2 text-sm font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
              >
                {generatingStrategy ? "Gerando..." : "Gerar Plano CMO"}
              </button>
              <button
                type="button"
                onClick={onGenerateCalendar}
                disabled={generatingCalendar || !strategyReady}
                className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
              >
                {generatingCalendar ? "Gerando..." : "Gerar calendário"}
              </button>
              <button
                type="button"
                onClick={onGenerateBriefs}
                disabled={generatingBriefs || !strategyReady}
                className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
              >
                {generatingBriefs ? "Gerando..." : "Criar pautas + briefs"}
              </button>
            </div>

            {agendaReady ? (
              <div className="space-y-3 rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                      Agenda gerada
                    </div>
                    <p className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                      Cada item mostra a base real: portfólio, oportunidades e regiões associadas.
                    </p>
                  </div>
                  <div className="text-[11px] text-secondary-dark/60 dark:text-secondary-light/60">
                    {calendarOverview.totalItems} itens
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <ProfileSummaryCard
                    label="Próxima pauta"
                    value={previewText(calendarOverview.nextTitle, "Nenhuma pauta gerada", 90)}
                  />
                  <ProfileSummaryCard
                    label="Objetivo da agenda"
                    value={previewText(calendarOverview.nextObjective, "Sem objetivo definido.", 110)}
                  />
                  <ProfileSummaryCard
                    label="Canais e temas"
                    value={
                      [
                        calendarOverview.channels.length
                          ? calendarOverview.channels.join("\n")
                          : "Sem canais",
                        calendarOverview.themes.length
                          ? calendarOverview.themes.slice(0, 4).join("\n")
                          : "Sem temas",
                      ].join("\n")
                    }
                  />
                </div>

                <details className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 p-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-highlight-light">
                    Ver itens da agenda
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {calendarItems.map((item, index) => (
                      <CalendarItemCard
                        key={
                          item.id ||
                          `${item.calendarRunId || "calendar"}-${item.title || "untitled"}-${item.scheduledAt || "no-date"}-${index}`
                        }
                        item={item}
                        sourceLabel={getCalendarItemSourceLabel(item)}
                        strategyObjective={strategyObjective}
                      />
                    ))}
                  </div>
                </details>
              </div>
            ) : (
              <div className="rounded border border-dashed border-secondary-dark/20 dark:border-secondary-light/20 p-3 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                Gere a estratégia para liberar calendário e briefs.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded border border-dashed border-secondary-dark/20 dark:border-secondary-light/20 p-4 text-sm text-secondary-dark/70 dark:text-secondary-light/70">
            Complete o Perfil da empresa para desbloquear a etapa de estratégia.
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1">
      <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
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
        placeholder={placeholder}
        className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
      />
    </label>
  );
}

function ProfileSummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 p-4 ${className || ""}`.trim()}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-dark/60 dark:text-secondary-light/60">
        {label}
      </div>
      <div className="mt-2 whitespace-pre-line text-sm leading-6 text-secondary-dark dark:text-secondary-light">
        {value}
      </div>
    </div>
  );
}

function CalendarItemCard({
  item,
  sourceLabel,
  strategyObjective,
}: {
  item: {
    id?: string;
    calendarRunId?: string | null;
    title?: string;
    channel?: string;
    scope?: string;
    scheduledAt?: string | null;
    relatedRegions?: string[];
    theme?: string;
    angle?: string;
    objective?: string;
  };
  sourceLabel: string;
  strategyObjective?: string;
}) {
  return (
    <div className="h-full rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 p-3 space-y-2 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
            {item.title || "Item sem título"}
          </div>
          <div className="text-[11px] font-medium text-secondary-dark/80 dark:text-secondary-light/75">
            {item.channel || "blog"} • {item.scope || "escopo não definido"} •{" "}
            {item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString("pt-BR") : "sem data"}
          </div>
        </div>
        <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 px-2 py-0.5 text-[9px] text-secondary-dark/70 dark:text-secondary-light/70">
          {sourceLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {uniqueStrings([...(item.relatedRegions || []), item.theme || "", item.angle || ""])
          .slice(0, 4)
          .map((chip) => (
            <span
              key={`${item.id || item.title || "calendar"}-${chip}`}
              className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[9px] text-secondary-dark/70 dark:text-secondary-light/70"
            >
              {chip}
            </span>
          ))}
      </div>

      <div className="mt-auto text-[10px] leading-4 text-secondary-dark/65 dark:text-secondary-light/65">
        {item.objective || strategyObjective || "Sem objetivo definido."}
      </div>
    </div>
  );
}

function previewText(value: string, fallback: string, maxLength = 140): string {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return fallback;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function previewLines(value: string, fallback: string, maxItems = 4): string {
  const lines = fromLines(value).slice(0, maxItems);
  if (!lines.length) return fallback;
  return lines.join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split(/\r?\n|,|;/g)
    .map((item) => item.trim())
    .filter(Boolean);
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




