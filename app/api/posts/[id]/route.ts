// app/api/posts/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "@/firebase/server";
import { isThumbnail, Post } from "@/app/models/Post";
import { validateSchema, postValidationSchema } from "@/lib/validationSchema";
import { deleteFromCloudinary } from "@/lib/cloudinary.server";
import { requireAdmin } from "@/lib/adminAuth";

function duplicateSlugQuery(slug: string, cat: string, excludeId: string) {
  return firestore
    .collection("posts")
    .where("slug", "==", slug)
    .where("categorySlug", "==", cat)
    .where("__name__", "!=", excludeId)
    .limit(1)
    .get();
}

// ---------- GET ----------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const docSnap = await firestore.doc(`posts/${id}`).get();
    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "Post não encontrado." },
        { status: 404 }
      );
    }

    const data = docSnap.data() as Post;
    return NextResponse.json({
      thumbnail: data.thumbnail?.url ?? null,
      images: (data.images || []).map((i) => ({ path: i.path, url: i.url })),
    });
  } catch (e) {
    console.error("GET post", e);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

// ---------- PUT ----------
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await context.params;

  try {
    const unauthorized = await requireAdmin(req);
    if (unauthorized) return unauthorized;

    const body = await req.json();
    const {
      title,
      content,
      meta,
      slug: newSlug,
      thumbnail,
      categorySlug: newCatSlug,
      categoryTitle,
      categoryId,
    } = body;

    const docRef = firestore.doc(`posts/${postId}`);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: true, message: "Post não encontrado." },
        { status: 404 }
      );
    }
    const existing = snap.data() as Post;

    const rawTags = body.tagsArray ?? body.tags;
    const parsedTags: string[] = Array.isArray(rawTags)
      ? rawTags
      : typeof rawTags === "string"
        ? rawTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
    const finalTags =
      parsedTags.length > 0 ? parsedTags : (existing.tags ?? []);

    const targetSlug = newSlug || existing.slug;
    const targetCat = newCatSlug || existing.categorySlug;
    const dup = await duplicateSlugQuery(targetSlug, targetCat, postId);
    if (!dup.empty) {
      return NextResponse.json(
        { error: true, message: "Slug já existe nesta categoria." },
        { status: 400 }
      );
    }

    const categoryRef = categoryId
      ? firestore.doc(`categories/${categoryId}`)
      : (existing.category as FirebaseFirestore.DocumentReference | null);

    let thumbToSave = existing.thumbnail;
    if (thumbnail && isThumbnail(thumbnail)) {
      if (existing.thumbnail?.public_id) {
        await deleteFromCloudinary(existing.thumbnail.public_id);
      }
      thumbToSave = { url: thumbnail.url, public_id: thumbnail.public_id };
    }

    const update: Partial<Post> = {
      title,
      content,
      meta,
      slug: targetSlug,
      tags: finalTags,
      categorySlug: targetCat,
      categoryTitle,
      category: categoryRef,
      thumbnail: thumbToSave,
      updatedAt: Timestamp.now(),
    };

    const err = validateSchema(postValidationSchema, { ...update, categoryId });
    if (err) {
      return NextResponse.json({ error: true, message: err }, { status: 400 });
    }

    await docRef.update(update);

    return NextResponse.json(
      { success: true, message: "Post atualizado com sucesso." },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Falha ao atualizar.";
    console.error("PUT post", e);
    return NextResponse.json({ error: true, message }, { status: 500 });
  }
}

// ---------- DELETE ----------
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await context.params;

  try {
    const unauthorized = await requireAdmin(req);
    if (unauthorized) return unauthorized;

    const docRef = firestore.doc(`posts/${postId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const post = docSnap.data() as Post;

    if (post.thumbnail?.public_id) {
      await deleteFromCloudinary(post.thumbnail.public_id);
    }

    await docRef.delete();

    return NextResponse.json(
      { success: true, message: "Post deletado com sucesso." },
      { status: 200 }
    );
  } catch (e) {
    console.error("DELETE post", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
