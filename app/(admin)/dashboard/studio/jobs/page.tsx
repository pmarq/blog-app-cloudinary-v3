export const dynamic = "force-dynamic";

import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { listJobs } from "@/lib/studio/jobs";
import type { StudioJob } from "@/lib/studio/types";

const DEFAULT_ORG_ID = "org_inlevor";

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

function getJobLabel(job: StudioJob): string {
  if (job.type === "generate_draft" && job.scheduleItemId) {
    return `Agenda ${job.scheduleItemId}`;
  }

  return job.type;
}

export default async function StudioJobsPage() {
  const jobs = await listJobs(DEFAULT_ORG_ID, 50);

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-4">
        <StudioNav />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Jobs
          </h1>
          <p className="text-secondary-dark dark:text-secondary-light">
            Fila real de jobs do Studio para o tenant {DEFAULT_ORG_ID}. O fluxo
            legado e o CMO passam por esta mesma coleção.
          </p>
        </div>

        <div className="overflow-hidden rounded border border-secondary-dark/30 dark:border-secondary-light/30">
          <table className="w-full text-sm">
            <thead className="bg-secondary-light/40 dark:bg-secondary-dark/40 text-left">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Criado em</th>
                <th className="p-3">Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-4 text-xs text-secondary-dark/70 dark:text-secondary-light/70"
                  >
                    Nenhum job encontrado.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-t border-secondary-dark/20 dark:border-secondary-light/20"
                  >
                    <td className="p-3">
                      <div className="font-medium text-highlight-light dark:text-highlight-dark">
                        {job.id}
                      </div>
                      <div className="text-[11px] text-secondary-dark/70 dark:text-secondary-light/70">
                        {getJobLabel(job)}
                      </div>
                    </td>
                    <td className="p-3">{job.type}</td>
                    <td className="p-3 capitalize">{job.status}</td>
                    <td className="p-3">{formatDateTime(job.createdAt.toDate())}</td>
                    <td className="p-3">
                      {formatDateTime(job.updatedAt?.toDate())}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
