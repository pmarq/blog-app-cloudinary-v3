"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryLinks = [
  { href: "/dashboard/studio/cmo", label: "CMO" },
  { href: "/dashboard/studio/create", label: "✦ Criar com IA" },
  { href: "/dashboard/studio", label: "Início" },
  { href: "/dashboard/studio/library", label: "Biblioteca" },
  { href: "/dashboard/studio/agenda", label: "Calendário" },
  { href: "/dashboard/studio/briefs", label: "Conteúdos" },
  { href: "/dashboard/studio/metrics", label: "Métricas" },
];

const settingsLinks = [
  { href: "/dashboard/studio/settings/editorial", label: "Regras & Voz" },
  { href: "/dashboard/studio/settings/guardrails", label: "Guardrails" },
];

const adminLinks = [
  { href: "/dashboard/studio/pipeline", label: "Diagnóstico" },
  { href: "/dashboard/studio/jobs", label: "Jobs" },
];

export default function StudioNav() {
  const pathname = usePathname();

  const renderLink = (link: { href: string; label: string }) => {
    const active = pathname === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        className={`px-3 py-1 rounded border transition ${
          active
            ? "border-highlight-light text-highlight-light dark:border-highlight-dark dark:text-highlight-dark bg-secondary-light/30 dark:bg-secondary-dark/30"
            : "border-secondary-dark/30 dark:border-secondary-light/30 text-secondary-dark dark:text-secondary-light hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30"
        }`}
      >
        {link.label}
      </Link>
    );
  };

  return (
    <nav className="space-y-2 text-sm mb-4">
      <div className="flex flex-wrap gap-2">{primaryLinks.map(renderLink)}</div>

      <div className="flex flex-wrap gap-2 items-center">
        <details className="group">
          <summary className="cursor-pointer list-none px-3 py-1 rounded border border-secondary-dark/30 dark:border-secondary-light/30 text-secondary-dark dark:text-secondary-light hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition">
            Configurações
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {settingsLinks.map(renderLink)}
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer list-none px-3 py-1 rounded border border-secondary-dark/30 dark:border-secondary-light/30 text-secondary-dark dark:text-secondary-light hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition">
            Admin
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">{adminLinks.map(renderLink)}</div>
        </details>

        <div className="text-xs text-secondary-dark/60 dark:text-secondary-light/60">
          Dica: use &ldquo;Criar com IA&rdquo; para gerar conteúdo. Biblioteca é onde você sobe PDFs para o Qdrant.
        </div>
      </div>
    </nav>
  );
}
