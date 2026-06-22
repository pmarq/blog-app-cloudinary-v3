// app/api/featured-banners/[id]/route.ts

import { NextResponse } from "next/server";
import {
  deleteFeaturedBanner,
  getFeaturedBannerById,
  updateFeaturedBanner,
} from "@/app/(admin)/dashboard/featured-banners/action";
import { v2 as cloudinary } from "cloudinary";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const banner = await getFeaturedBannerById(id);
    if (!banner) {
      return NextResponse.json(
        { error: true, message: "Banner não encontrado." },
        { status: 404 }
      );
    }
    return NextResponse.json(banner, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao obter o banner.";
    console.error("Erro ao obter banner:", error);
    return NextResponse.json({ error: true, message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const data = await request.json();
    const { title, link, linkTitle, imageUrl, publicId, oldPublicId } = data;

    if (!title || !link || !linkTitle || !imageUrl || !publicId) {
      return NextResponse.json(
        { error: true, message: "Dados do banner estão incompletos." },
        { status: 400 }
      );
    }

    // 1. Deleta imagem antiga do Cloudinary SE for diferente da nova
    if (oldPublicId && publicId && oldPublicId !== publicId) {
      try {
        await cloudinary.uploader.destroy(oldPublicId);
        console.log("Imagem antiga deletada do Cloudinary:", oldPublicId);
      } catch (err) {
        console.error("Erro ao deletar imagem antiga do Cloudinary:", err);
        // Não retorna erro, só loga, segue fluxo
      }
    }

    const bannerData = {
      title,
      link,
      linkTitle,
      imageUrl,
      publicId,
    };

    const response = await updateFeaturedBanner(id, bannerData);

    if (response.error) {
      return NextResponse.json(
        { error: true, message: response.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Falha ao atualizar o banner.";
    console.error("Erro ao atualizar banner via API:", error);
    return NextResponse.json({ error: true, message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const response = await deleteFeaturedBanner(id);

    if (response.error) {
      return NextResponse.json(
        { error: true, message: response.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Falha ao deletar o banner.";
    console.error("Erro ao deletar banner via API:", error);
    return NextResponse.json({ error: true, message }, { status: 500 });
  }
}
