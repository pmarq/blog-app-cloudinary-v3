export const dynamic = "force-dynamic";

import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { DEFAULT_ORG_ID } from "@/lib/studio/org";
import { listJobs } from "@/lib/studio/jobs";
import { listBacklogItems, listMonthItems } from "@/lib/studio/schedule";
import { listPosts } from "@/lib/studio/posts";

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

function countPostsBy(
  items: { status?: string | null; channel?: string | null }[],
  key: "status" | "channel"
): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const value = String(item[key] || "unknown");
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

function countJobsBy(
  items: { status: string }[]
): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const value = item.status;
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

export default async function StudioMetrics() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const [posts, jobs, backlogItems, monthItems] = await Promise.all([
    listPosts(DEFAULT_ORG_ID, 100),
    listJobs(DEFAULT_ORG_ID, 100),
    listBacklogItems(),
    listMonthItems(monthStart, monthEnd),
  ]);

  const postStatusCounts = countPostsBy(posts, "status");
  const postChannelCounts = countPostsBy(posts, "channel");
  const jobStatusCounts = countJobsBy(jobs);
  const publishedPosts = posts.filter((post) => (post.status || "").toLowerCase() === "published").length;
  const scheduledPosts = posts.filter((post) => Boolean(post.scheduledAt)).length;
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "processing").length;

  const recentPosts = posts.slice(0, 5);

  return (
    <AdminLayout>
      <div className="max-w-6xl space-y-4">
        <StudioNav />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Métricas
          </h1>
          <p className="text-secondary-dark dark:text-secondary-light">
            Painel operacional do Studio para o tenant {DEFAULT_ORG_ID}. Mostra
            posts, jobs e pauta real, sem números inventados.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Posts totais" value={posts.length} />
          <MetricCard label="Publicados" value={publishedPosts} />
          <MetricCard label="Agendados" value={scheduledPosts} />
          <MetricCard label="Jobs ativos" value={activeJobs} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Status de posts">
            <KeyValueList items={postStatusCounts} />
          </SectionCard>

          <SectionCard title="Canais de posts">
            <KeyValueList items={postChannelCounts} />
          </SectionCard>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Jobs por status">
            <KeyValueList items={jobStatusCounts} />
          </SectionCard>

          <SectionCard title="Agenda do mês">
            <div className="space-y-2 text-sm text-secondary-dark dark:text-secondary-light">
              <p>Itens no mês: {monthItems.length}</p>
              <p>Itens no backlog: {backlogItems.length}</p>
              <p className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                Período atual: {formatDateTime(monthStart)} → {formatDateTime(monthEnd)}
              </p>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Posts recentes">
          <div className="overflow-hidden rounded border border-secondary-dark/30 dark:border-secondary-light/30">
            <table className="w-full text-sm">
              <thead className="bg-secondary-light/40 dark:bg-secondary-dark/40 text-left">
                <tr>
                  <th className="p-3">Título</th>
                  <th className="p-3">Canal</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {recentPosts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-4 text-xs text-secondary-dark/70 dark:text-secondary-light/70"
                    >
                      Nenhum post encontrado.
                    </td>
                  </tr>
                ) : (
                  recentPosts.map((post) => (
                    <tr
                      key={post.id}
                      className="border-t border-secondary-dark/20 dark:border-secondary-light/20"
                    >
                      <td className="p-3">{post.title}</td>
                      <td className="p-3 capitalize">{post.channel || "-"}</td>
                      <td className="p-3 capitalize">{post.status || "-"}</td>
                      <td className="p-3">{formatDateTime(post.updatedAt.toDate())}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </AdminLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-secondary-light/10 dark:bg-secondary-dark/30 p-4">
      <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-secondary-light/10 dark:bg-secondary-dark/30 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-highlight-light dark:text-highlight-dark">
        {title}
      </h2>
      {children}
    </section>
  );
}

function KeyValueList({ items }: { items: Record<string, number> }) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
        Sem dados.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="capitalize text-secondary-dark dark:text-secondary-light">
            {key}
          </span>
          <span className="font-semibold text-highlight-light dark:text-highlight-dark">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
