// app/api/cloudinary/get-signature/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAdmin } from "@/lib/adminAuth";

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

/**
 * Handler para o método GET.
 * Gera uma assinatura para uploads assinados no Cloudinary.
 * 
 * Parâmetros aceitos via query string:
 * - folder: A pasta no Cloudinary onde a imagem será armazenada.
 */
export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") || "";

  const timestamp = Math.round(new Date().getTime() / 1000);

  const paramsToSign: { [key: string]: any } = {
    timestamp,
  };

  if (folder) {
    paramsToSign.folder = folder;
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET as string
  );

  return NextResponse.json({ timestamp, signature });
}
