import { NextRequest } from "next/server";
import { Action } from "@/app/models/Studio";
import { mockActionResult, ok, badRequest, readJson, normalizeContext } from "../../utils";
import { StudioContext } from "@/app/models/Studio";
import { requireAdmin } from "@/lib/adminAuth";

interface IdeaRequestBody {
  context?: Partial<StudioContext>;
  topic?: string;
  target?: string;
  tone?: string;
  keywords?: string[];
  constraints?: string[];
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<IdeaRequestBody>(request);
  if (!body) return badRequest("Invalid JSON body.");

  const actions: Action[] = [
    { type: "insert_title", value: "Título mock: mercado imobiliário 2025" },
    {
      type: "insert_outline",
      items: [
        "Contexto de mercado (dados atualizados e fontes)",
        "Oportunidades por segmento",
        "Riscos e mitigação",
        "CTA final para leads qualificados",
      ],
    },
    {
      type: "insert_seo",
      meta: "Panorama do mercado imobiliário em 2025 com fontes confiáveis.",
      tags: ["imoveis", "mercado", "investimento"],
    },
    {
      type: "insert_ctas",
      items: ["Fale com um especialista", "Baixe o guia completo"],
    },
  ];

  const result = mockActionResult({
    actions,
    guardrailScore: 0.9,
    notes: "Mock: somente para validar o contrato frontend/backend.",
    context: body.context ? normalizeContext(body.context) : undefined,
  });

  return ok(result);
}
