import { NextRequest, NextResponse } from "next/server";
import { auth, blogStorage } from "@/firebase/server";
import { buildKbCoreHeaders, getKbCoreUrl } from "@/lib/studio/kb-core";

export const runtime = "nodejs";

const MARKET_SCOPE_ID = "market__br";

const normalizeId = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const safeFileName = (value: string) =>
  value
    .trim()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180) || "documento.pdf";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const authToken = String(form.get("authToken") || "").trim();

    const orgId = normalizeId(form.get("orgId") || "inlevor") || "inlevor";
    const state = normalizeId(form.get("state"));
    const city = normalizeId(form.get("city"));
    const neighborhood = normalizeId(form.get("neighborhood"));
    const autoIndex = String(form.get("autoIndex") || "true").trim() !== "false";

    if (!authToken) {
      return NextResponse.json(
        { success: false, message: "authToken e obrigatorio." },
        { status: 401 },
      );
    }

    const verified = await auth.verifyIdToken(authToken);
    if (!verified.admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 },
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Envie um PDF em 'file'." },
        { status: 400 },
      );
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, message: "Apenas PDFs sao aceitos." },
        { status: 400 },
      );
    }

    const sourceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const filename = safeFileName(file.name || "documento.pdf");
    const storagePath = `studio/kb/market/${orgId}/${MARKET_SCOPE_ID}/${sourceId}/${filename}`;
    const bucket = blogStorage.bucket();
    const buffer = Buffer.from(await file.arrayBuffer());

    await bucket.file(storagePath).save(buffer, {
      contentType: file.type || "application/pdf",
      resumable: false,
    });

    const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const documentVersion = `${Date.now()}-${buffer.length}-${file.lastModified || 0}`;
    const updatedAt = new Date().toISOString();

    const kbResponse = await fetch(getKbCoreUrl("/kb/sources/register"), {
      method: "POST",
      headers: buildKbCoreHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify({
        sourceId,
        orgId,
        sourceProject: "blog-app",
        kbDomain: "market",
        scopeId: MARKET_SCOPE_ID,
        documentType: "market_document",
        sourceType: "market_doc",
        documentVersion,
        updatedAt,
        isActive: true,
        label: filename,
        storagePath,
        storage: {
          provider: "firebase",
          bucket: bucket.name,
          storagePath,
          downloadUrl,
        },
        state: state || undefined,
        city: city || undefined,
        neighborhood: neighborhood || undefined,
        options: {
          autoProcess: autoIndex,
        },
      }),
      cache: "no-store",
    });

    const raw = await kbResponse.text();
    const payload = raw ? JSON.parse(raw) : {};

    if (!kbResponse.ok || !payload?.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            payload?.error || "Falha ao registrar a fonte no KB Core.",
        },
        { status: kbResponse.status === 400 ? 400 : 502 },
      );
    }

    return NextResponse.json({
      success: true,
      sourceId,
      storagePath,
      scopeId: MARKET_SCOPE_ID,
      state: state || null,
      city: city || null,
      neighborhood: neighborhood || null,
      preparationId: payload?.preparationId || null,
    });
  } catch (error) {
    console.error("[studio/kb/market/add-source] error:", error);
    return NextResponse.json(
      { success: false, message: "Erro ao adicionar documento de mercado." },
      { status: 500 },
    );
  }
}
