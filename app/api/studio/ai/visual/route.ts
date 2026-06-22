import { NextRequest } from "next/server";
import { Action } from "@/app/models/Studio";
import {
  mockActionResult,
  ok,
  badRequest,
  readJson,
  normalizeContext,
} from "../../utils";
import { StudioContext } from "@/app/models/Studio";
import { requireAdmin } from "@/lib/adminAuth";

interface VisualRequestBody {
  context?: Partial<StudioContext>;
  references?: string[];
  style?: string;
  constraints?: string[];
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<VisualRequestBody>(request);
  if (!body) return badRequest("Invalid JSON body.");

  const actions: Action[] = [
    {
      type: "visual_prompt",
      prompt:
        "Estilo INLEVOR: luz suave, arquitetura contemporânea, paleta preto/branco/areia/dourado discreto.",
    },
    {
      type: "moodboard",
      items: [
        "fachada_contemporanea.jpg",
        "living_luz_suave.jpg",
        "detalhe_dourado_sutil.jpg",
      ],
    },
    {
      type: "curation",
      items: body.references || [],
      message: "Curadoria mock baseada nas referências fornecidas.",
    },
  ];

  const result = mockActionResult({
    actions,
    guardrailScore: 0.85,
    notes: "Mock: retornando prompts/curadoria estáticos.",
    context: body.context ? normalizeContext(body.context) : undefined,
  });

  return ok(result);
}
