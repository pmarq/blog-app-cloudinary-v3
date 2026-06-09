// app/dashboard/posts/create/page.tsx

"use client";

import React, { useState } from "react";
import EditorComponent, { FinalPost } from "@/app/components/common/editor";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { createPost } from "../action";
import { DEFAULT_ORG_ID } from "@/lib/studio/org";
import type { PostInput } from "@/app/utils/types";

type CreatePostProps = {
  initialDraft?: Partial<FinalPost>;
};

export default function CreatePost({ initialDraft }: CreatePostProps) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const { currentUser } = useAuth();
  const userId = currentUser?.uid;
  const { toast } = useToast();

  const handleOnSubmit = async (post: FinalPost) => {
    if (!userId) {
      setErrorMessage("Usuário não autenticado.");
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      // ✅ Limpa thumbnail para ficar compatível com PostInput
      let cleanedThumbnail: PostInput["thumbnail"];

      if (
        post.thumbnail &&
        typeof post.thumbnail === "object" &&
        "url" in post.thumbnail
      ) {
        cleanedThumbnail = {
          url: post.thumbnail.url,
          public_id: post.thumbnail.public_id,
        };
      } else if (post.thumbnail instanceof File) {
        cleanedThumbnail = post.thumbnail;
      } else {
        cleanedThumbnail = undefined; // ignora string/null
      }

      const postData: PostInput = {
        title: post.title,
        content: post.content,
        slug: post.slug || "",
        meta: post.meta || "",
        tags: post.tagsArray || [],
        categoryId: post.categoryId || "",
        thumbnail: cleanedThumbnail,
        authorId: userId,
        briefId: post.briefId || undefined,
        orgId: DEFAULT_ORG_ID,
      };

      const response = await createPost(postData, userId);
      if (response.error || !response.postId) {
        throw new Error(response.message || "Falha ao criar o post.");
      }

      toast({
        title: "Sucesso!",
        description: "Post criado com sucesso!",
        variant: "default",
      });

      router.push("/dashboard/posts");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao criar o post.";
      console.error("Erro ao criar o post:", error);
      setErrorMessage(message);
      toast({
        title: "Erro!",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {errorMessage && <p className="text-red-500">{errorMessage}</p>}
      <EditorComponent
        onSubmit={handleOnSubmit}
        busy={busy}
        initialValue={
          initialDraft
            ? ({
                title: initialDraft.title || "",
                content: initialDraft.content || "",
                meta: initialDraft.meta || "",
                slug: initialDraft.slug || "",
                tags: Array.isArray(initialDraft.tags)
                  ? initialDraft.tags.join(", ")
                  : initialDraft.tags || "",
                categoryId: initialDraft.categoryId || "",
                briefId: initialDraft.briefId,
                origin: initialDraft.origin,
              } as FinalPost)
            : undefined
        }
        briefId={initialDraft?.briefId}
      />
    </div>
  );
}
