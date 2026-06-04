import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";

export default function StudioAssetSets() {
  const sets = [
    { id: "s1", name: "Carousel Zona Sul", purpose: "carousel", guardrailScore: 0.82 },
    { id: "s2", name: "Stories retrofit", purpose: "stories", guardrailScore: 0.74 },
    { id: "s3", name: "Ads premium", purpose: "ads", guardrailScore: 0.9 },
  ];

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-2">
        <StudioNav />
        <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
          Asset Sets
        </h1>
        <p className="text-secondary-dark dark:text-secondary-light">
          Agrupar assets por formato (carousel/stories/ads/blog) e aplicar
          guardrails.
        </p>

        <div className="mt-4 overflow-hidden rounded border border-secondary-dark/30 dark:border-secondary-light/30">
          <table className="w-full text-sm">
            <thead className="bg-secondary-light/40 dark:bg-secondary-dark/40 text-left">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Formato</th>
                <th className="p-3">Guardrail</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => (
                <tr key={s.id} className="border-t border-secondary-dark/20 dark:border-secondary-light/20">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3 capitalize">{s.purpose}</td>
                  <td className="p-3">{Math.round(s.guardrailScore * 100)}%</td>
                  <td className="p-3 space-x-2">
                    <button className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition">
                      Validar
                    </button>
                    <button className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition">
                      Aprovar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
