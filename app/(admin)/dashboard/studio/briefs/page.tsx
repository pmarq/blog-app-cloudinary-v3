"use client";

import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/withBasePath";

type Brief = {
  id: string;
  title: string;
  status?: string;
  owner?: string;
  orgId?: string;
};

export default function StudioBriefs() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const loadBriefs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(withBasePath("/api/studio/briefs"));
        const data = await res.json();
        setBriefs(data.items || []);
      } catch (err) {
        console.error(err);
        setError("Falha ao carregar briefs (mock).");
      } finally {
        setLoading(false);
      }
    };
    loadBriefs();
  }, []);

  const handleCreatePost = async (briefId: string) => {
    try {
      const res = await fetch(withBasePath("/api/studio/briefs/create-post"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId }),
      });
      if (!res.ok) throw new Error("Falha ao criar post (mock).");
      const data = await res.json();
      const postId = data?.post?.id;
      if (postId) {
        toast({
          title: "Post criado (mock)",
          description: `postId: ${postId}`,
          variant: "default",
        });
        router.push(`/dashboard/posts/create?postId=${postId}&briefId=${briefId}`);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro",
        description: "Falha ao criar post (mock).",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-2">
        <StudioNav />
        <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
          Briefs
        </h1>
        <p className="text-secondary-dark dark:text-secondary-light">
          Crie e gerencie briefs. Integração mock por enquanto.
        </p>

        <div className="mt-4 flex gap-2">
          <button className="text-xs px-3 py-2 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition">
            Novo brief (mock)
          </button>
        </div>

        {loading && (
          <p className="text-xs text-secondary-dark dark:text-secondary-light">
            Carregando briefs...
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="mt-4 overflow-hidden rounded border border-secondary-dark/30 dark:border-secondary-light/30">
          <table className="w-full text-sm">
            <thead className="bg-secondary-light/40 dark:bg-secondary-dark/40 text-left">
              <tr>
                <th className="p-3">Título</th>
                <th className="p-3">Status</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {briefs.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-secondary-dark/20 dark:border-secondary-light/20"
                >
                  <td className="p-3">{b.title}</td>
                  <td className="p-3 capitalize">{b.status}</td>
                  <td className="p-3">{b.owner}</td>
                  <td className="p-3 space-x-2">
                    <button className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition">
                      Abrir no editor
                    </button>
                    <button
                      className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition"
                      onClick={() => handleCreatePost(b.id)}
                    >
                      Criar post
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
