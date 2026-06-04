import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";

export default function StudioGuardrails() {
  const issues = [
    { id: "g1", field: "palette", message: "Cor fora do padrão", severity: "warn" },
    { id: "g2", field: "alt", message: "Imagem sem alt text", severity: "warn" },
    { id: "g3", field: "ratio", message: "Proporção incorreta para feed", severity: "info" },
  ];

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-2">
        <StudioNav />
        <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
          Guardrails
        </h1>
        <p className="text-secondary-dark dark:text-secondary-light">
          Regras de paleta, tipografia, ratio e CTA com severidade info/warn/block.
        </p>

        <div className="mt-4 overflow-hidden rounded border border-secondary-dark/30 dark:border-secondary-light/30">
          <table className="w-full text-sm">
            <thead className="bg-secondary-light/40 dark:bg-secondary-dark/40 text-left">
              <tr>
                <th className="p-3">Campo</th>
                <th className="p-3">Mensagem</th>
                <th className="p-3">Severidade</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((row) => (
                <tr key={row.id} className="border-t border-secondary-dark/20 dark:border-secondary-light/20">
                  <td className="p-3">{row.field}</td>
                  <td className="p-3">{row.message}</td>
                  <td className="p-3 capitalize">{row.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
