export const dynamic = "force-dynamic";

import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { DEFAULT_ORG_ID } from "@/lib/studio/org";
import { listJobs } from "@/lib/studio/jobs";
import { listAllItems, serializeScheduleItem } from "@/lib/studio/schedule";

const STAGE_ORDER = [
  "idea",
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
] as const;

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export default async function StudioPipeline() {
  const [scheduleItems, jobs] = await Promise.all([
    listAllItems(DEFAULT_ORG_ID),
    listJobs(DEFAULT_ORG_ID, 50),
  ]);

  const stageBuckets = STAGE_ORDER.map((stage) => ({
    stage,
    items: scheduleItems
      .filter((item) => item.status === stage)
      .sort((a, b) => {
        const aTime = a.updatedAt.toMillis();
        const bTime = b.updatedAt.toMillis();
        return bTime - aTime;
      }),
  }));

  const openJobs = jobs.filter((job) => job.status === "queued" || job.status === "processing");

  return (
    <AdminLayout>
      <div className="max-w-6xl space-y-4">
        <StudioNav />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Pipeline
          </h1>
          <p className="text-secondary-dark dark:text-secondary-light">
            Fluxo real do Studio para o tenant {DEFAULT_ORG_ID}: pautas, agenda
            e jobs, sem mock.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          {stageBuckets.map((bucket) => (
            <div
              key={bucket.stage}
              className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-secondary-light/10 dark:bg-secondary-dark/30 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-secondary-dark dark:text-secondary-light">
                  {bucket.stage}
                </span>
                <span className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                  {bucket.items.length}
                </span>
              </div>

              <div className="space-y-2">
                {bucket.items.length === 0 ? (
                  <p className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                    Vazio.
                  </p>
                ) : (
                  bucket.items.slice(0, 4).map((item) => {
                    const serialized = serializeScheduleItem(item);
                    return (
                      <article
                        key={item.id}
                        className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-primary/60 dark:bg-primary-dark/60 p-2 text-xs"
                      >
                        <div className="font-medium text-highlight-light dark:text-highlight-dark">
                          {serialized.title}
                        </div>
                        <div className="mt-1 text-secondary-dark/70 dark:text-secondary-light/70">
                          {serialized.channel} · {serialized.theme}
                        </div>
                        <div className="mt-1 text-secondary-dark/60 dark:text-secondary-light/60">
                          {formatDateTime(serialized.scheduledAt)}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-secondary-light/10 dark:bg-secondary-dark/30 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-highlight-light dark:text-highlight-dark">
              Jobs abertos
            </h2>
            {openJobs.length === 0 ? (
              <p className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                Nenhum job em fila ou execução.
              </p>
            ) : (
              <div className="space-y-2">
                {openJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-primary/60 dark:bg-primary-dark/60 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-highlight-light dark:text-highlight-dark">
                        {job.type}
                      </span>
                      <span className="capitalize text-secondary-dark/70 dark:text-secondary-light/70">
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-1 text-secondary-dark/60 dark:text-secondary-light/60">
                      {job.scheduleItemId ? `Pauta ${job.scheduleItemId}` : "Job independente"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-secondary-light/10 dark:bg-secondary-dark/30 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-highlight-light dark:text-highlight-dark">
              Resumo
            </h2>
            <div className="space-y-2 text-sm text-secondary-dark dark:text-secondary-light">
              <p>Total de pautas: {scheduleItems.length}</p>
              <p>Jobs totais: {jobs.length}</p>
              <p>Itens em publicação/agendados: {scheduleItems.filter((item) => item.status === "scheduled" || item.status === "published").length}</p>
              <p>Backlog: {scheduleItems.filter((item) => !item.scheduledAt).length}</p>
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
