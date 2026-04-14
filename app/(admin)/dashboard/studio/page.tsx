import AdminLayout from "@/app/components/layout/AdminLayout";
import Link from "next/link";
import StudioNav from "@/app/components/admin/StudioNav";

export default function StudioLanding() {
  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-6">
        <StudioNav />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Studio
          </h1>
          <p className="text-secondary-dark dark:text-secondary-light">
            Gere conteúdos de alta qualidade com IA — blog, Instagram, newsletter e muito mais.
          </p>
          <p className="text-xs text-secondary-dark/80 dark:text-secondary-light/80">
            Se a Biblioteca ainda estiver vazia, comece por Mercado (KB) para
            subir PDFs e testar busca.
          </p>
        </div>

        {/* Featured: Criar com IA */}
        <StudioCard
          title="✦ Criar com IA"
          description="Interface tipo Gemini: escreva o que quer criar, escolha a fonte (Qdrant / Internet / Combinado) e o formato (Blog, Instagram, Carrossel, Newsletter, SEO e mais). A IA gera em tempo real."
          href="/dashboard/studio/create"
          featured
        />

        <div className="grid gap-4 md:grid-cols-2">
          <StudioCard
            title="Conteúdos"
            description="Crie peças e variações por canal. Use isso como fila de produção antes do calendário."
            href="/dashboard/studio/briefs"
          />
          <StudioCard
            title="Biblioteca"
            description="Suba materiais (PDFs, referências, templates) e valide a busca. Mercado e projetos ficam separados."
            href="/dashboard/studio/library"
          />
          <StudioCard
            title="Calendário"
            description="Planeje cadência por canal e acompanhe status do que está pronto para publicar."
            href="/dashboard/studio/agenda"
          />
          <StudioCard
            title="Regras & Voz"
            description="Defina temas (pilares), tom e regras de conteúdo para manter consistência e evitar erros."
            href="/dashboard/studio/settings/editorial"
          />
          <StudioCard
            title="Métricas"
            description="Insights de blog + Instagram com distribution logs."
            href="/dashboard/studio/metrics"
          />
        </div>
      </div>
    </AdminLayout>
  );
}

type CardProps = {
  title: string;
  description: string;
  href: string;
  featured?: boolean;
};

function StudioCard({ title, description, href, featured }: CardProps) {
  return (
    <Link
      href={href}
      className={`block rounded border p-4 hover:scale-[0.99] transition ${
        featured
          ? "border-highlight-light dark:border-highlight-dark bg-secondary-light/15 dark:bg-secondary-dark/40 md:col-span-2"
          : "border-secondary-dark/30 dark:border-secondary-light/20 bg-secondary-light/10 dark:bg-secondary-dark/30"
      }`}
    >
      <h2 className="text-lg font-semibold text-highlight-light dark:text-highlight-dark mb-1">
        {title}
      </h2>
      <p className="text-sm text-secondary-dark dark:text-secondary-light">
        {description}
      </p>
    </Link>
  );
}
