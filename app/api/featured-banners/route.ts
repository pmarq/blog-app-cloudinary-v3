// app/api/featured-banners/route.ts

import { NextResponse } from "next/server";
import { Banner } from "@/app/models/Banners";
import {
  createFeaturedBanner,
  getFeaturedBanners,
} from "@/app/(admin)/dashboard/featured-banners/action";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  try {
    const banners: Banner[] = await getFeaturedBanners();
    return NextResponse.json(banners, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao obter banners.";
    console.error("Erro ao obter banners:", error);
    return NextResponse.json({ error: true, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const data = await request.json();

    const { title, link, linkTitle, imageUrl, publicId } = data;

    // Validar dados
    if (!title || !link || !linkTitle || !imageUrl || !publicId) {
      return NextResponse.json(
        { error: true, message: "Dados do banner estão incompletos." },
        { status: 400 }
      );
    }

    const bannerData = {
      title,
      link,
      linkTitle,
      imageUrl,
      publicId,
    };

    const response = await createFeaturedBanner(bannerData);

    if (response.error) {
      return NextResponse.json(
        { error: true, message: response.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, bannerId: response.bannerId },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Falha ao criar o banner.";
    console.error("Erro ao criar banner via API:", error);
    return NextResponse.json({ error: true, message }, { status: 500 });
  }
}
