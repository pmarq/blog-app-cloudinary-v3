import { NextRequest } from "next/server";
import { ok, badRequest, readJson, makeRunId } from "../../utils";
import { requireAdmin } from "@/lib/adminAuth";

interface CuratePdfRequestBody {
  url?: string;
  fileId?: string;
  context?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  // Suporta JSON (url/fileId) ou multipart/form-data com file
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return badRequest("Envie um PDF em 'file'.");
    }
    const fileName = file.name || "documento.pdf";

    return ok({
      schemaVersion: "1.0",
      runId: makeRunId(),
      extractedText: `Mock: texto extraído de ${fileName}.`,
      sections: [
        { heading: "Resumo", content: "Resumo executivo mock do PDF." },
        { heading: "Destaques", content: "Pontos principais listados aqui." },
      ],
      sources: [fileName],
      notes: "Mock: substitua por extração real na próxima fase.",
    });
  }

  const body = await readJson<CuratePdfRequestBody>(request);
  if (!body) return badRequest("Invalid JSON body.");
  if (!body.url && !body.fileId) {
    return badRequest("Informe url ou fileId para curadoria de PDF.");
  }

  return ok({
    schemaVersion: "1.0",
    runId: makeRunId(),
    extractedText: "Mock: texto extraído do PDF.",
    sections: [
      { heading: "Resumo", content: "Resumo executivo mock do PDF." },
      { heading: "Destaques", content: "Pontos principais listados aqui." },
    ],
    sources: [body.url || body.fileId],
    notes: "Mock: substitua por extração real na próxima fase.",
  });
}
