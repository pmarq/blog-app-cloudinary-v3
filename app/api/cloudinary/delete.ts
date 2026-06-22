// app/api/cloudinary/delete.ts

import { NextRequest, NextResponse } from "next/server";
import { deleteFromCloudinary } from "@/lib/cloudinary.server"; // Importação do módulo server-side
import { requireAdmin } from "@/lib/adminAuth";

/**
 * Interface para a requisição de deleção
 */
interface DeleteRequestBody {
  public_id: string;
}

/**
 * Handle POST requests to delete an image from Cloudinary
 */
export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const body: DeleteRequestBody = await request.json();

    const { public_id } = body;

    if (!public_id) {
      return NextResponse.json(
        { error: "public_id é necessário para deletar a imagem." },
        { status: 400 }
      );
    }

    // Deletar a imagem do Cloudinary
    await deleteFromCloudinary(public_id);

    return NextResponse.json(
      { success: true, message: "Imagem deletada com sucesso." },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro interno do servidor.";

    console.error("Erro ao deletar imagem do Cloudinary:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
