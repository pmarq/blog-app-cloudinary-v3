import { NextRequest } from "next/server";
import { Action, GuardrailIssue } from "@/app/models/Studio";
import {
  mockActionResult,
  ok,
  badRequest,
  readJson,
  normalizeContext,
} from "../../utils";
import { StudioContext } from "@/app/models/Studio";
import { requireAdmin } from "@/lib/adminAuth";

interface GuardrailRequestBody {
  context?: Partial<StudioContext>;
  html?: string;
  assets?: string[];
  palette?: string[];
  thumbUrl?: string;
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<GuardrailRequestBody>(request);
  if (!body) return badRequest("Invalid JSON body.");

  const issues: GuardrailIssue[] = [
    {
      field: "image.alt",
      message: "Adicione alt text descritivo às imagens.",
      severity: "warn",
    },
    {
      field: "palette",
      message: "Paleta fora do padrão preto/branco/cinza/areia/dourado.",
      severity: "warn",
    },
  ];

  const actions: Action[] = [
    {
      type: "guardrail_fix",
      message: "Inserir alt text recomendado nas imagens.",
      data: { suggestion: "Fachada contemporânea com luz suave." },
    },
  ];

  const result = mockActionResult({
    actions,
    issues,
    guardrailScore: 0.72,
    notes: "Mock: checagem de guardrails básica (não bloqueia).",
    context: body.context ? normalizeContext(body.context) : undefined,
  });

  return ok(result);
}
