// app/dashboard/posts/action.ts

"use server";

import { v4 as uuidv4 } from "uuid";
import { Timestamp, DocumentReference } from "firebase-admin/firestore";
import { Post } from "@/app/models/Post";
import { postValidationSchema, validateSchema } from "@/lib/validationSchema";
import { firestore } from "@/firebase/server";
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";
import { v2 as cloudinary } from "cloudinary";
import { PostInput } from "@/app/utils/types";

// Configurar o Cloudinary no servidor
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Tipos das respostas
interface CreatePostResponse {
  postId?: string;
  error?: boolean;
  message?: string;
}

interface SavePostImagesParams {
  postId: string;
  paths: string[]; // URLs completas das imagens no Cloudinary
}

interface SavePostImagesResponse {
  success?: boolean;
  error?: boolean;
  message?: string;
}

interface UpdatePostResponse {
  success?: boolean;
  error?: boolean;
  message?: string;
}

/**
 * Cria um novo post no Firestore.
 * @param postData Dados do post.
 * @param authorId ID do autor do post.
 * @returns Resposta da operação.
 */

export async function createPost(
  postData: PostInput,
  authorId: string
): Promise<CreatePostResponse> {
  try {
    console.log("Recebendo dados do post:", postData);

    // 1. Validação
    const errorMessage = validateSchema(postValidationSchema, postData);
    if (errorMessage) {
      return { error: true, message: errorMessage };
    }

    // 2. Checar slug duplicado
    const existing = await firestore
      .collection("posts")
      .where("slug", "==", postData.slug)
      .get();
    if (!existing.empty) {
      return {
        error: true,
        message: "Slug já está em uso. Por favor, escolha outro.",
      };
    }

    // 3. Converter tags
    if (typeof postData.tags === "string") {
      postData.tags = postData.tags.split(",").map((t: string) => t.trim());
    }

    // 4. Gerar ID do post
    const postId = uuidv4();

    // 5. Fazer upload da thumbnail para o Cloudinary e obter URL e public_id
    let thumbnailUrl = "";
    let thumbnailPublicId = "";

    if (
      postData.thumbnail &&
      typeof postData.thumbnail === "object" &&
      "url" in postData.thumbnail &&
      "public_id" in postData.thumbnail
    ) {
      // Thumbnail já enviado como objeto com url e public_id
      thumbnailUrl = postData.thumbnail.url;
      thumbnailPublicId = postData.thumbnail.public_id || "";
      console.log(
        "Thumbnail recebido como objeto:",
        thumbnailUrl,
        thumbnailPublicId
      );
    }

    // 6. Category

    let categoryRef: DocumentReference | null = null;
    let categorySlug = "";
    let categoryTitle = "";

    if (postData.categoryId) {
      const categoryDoc = await firestore
        .collection("categories")
        .doc(postData.categoryId)
        .get();
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        categoryRef = categoryDoc.ref;
        categorySlug = categoryData?.slug || ""; // <-- você precisa garantir que existe
        categoryTitle = categoryData?.title || "";
      }
    }

    // 7. Montar objeto
    const newPost: Post = {
      id: postId,
      title: postData.title,
      category: categoryRef,
      categorySlug,
      categoryTitle,
      slug: postData.slug,
      meta: postData.meta,
      content: postData.content,
      tags: postData.tags || [],
      briefId: postData.briefId,
      orgId: postData.orgId,
      channel: postData.channel,
      status: postData.status,
      thumbnail: thumbnailUrl
        ? { url: thumbnailUrl, public_id: thumbnailPublicId }
        : null,
      images: [],
      author: firestore.collection("users").doc(authorId) as DocumentReference,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    console.log("POST====>>>>", newPost);

    // 7. Salvar no Firestore
    await firestore.collection("posts").doc(postId).set(newPost);

    console.log("Post criado com sucesso:", postId);

    return { postId };
  } catch (error) {
    console.error("Erro ao criar post:", error);
    return {
      error: true,
      message: (error as Error).message || "Falha ao criar o post",
    };
  }
}

/**
 * Salva as URLs das imagens no post criado.
 * @param data Parâmetros contendo o ID do post e as URLs das imagens.
 * @returns Resposta da operação.
 */
export async function savePostImages(
  data: SavePostImagesParams
): Promise<SavePostImagesResponse> {
  try {
    const { postId, paths } = data;
    if (!paths || paths.length === 0) {
      return { success: true };
    }

    // 1) Define a primeira imagem como thumbnail, as demais como images
    const thumbnailPath = paths[0];
    const otherPaths = paths.slice(1);

    // 2) Montar objeto para update
    const updateData: Partial<Post> = {
      updatedAt: Timestamp.now(),
    };

    // Monta "thumbnail" se existir
    if (thumbnailPath) {
      // Obter o `public_id` a partir da URL
      const publicId = thumbnailPath.split("/").pop()?.split(".")[0] || "";

      updateData.thumbnail = {
        url: thumbnailPath, // URL do Cloudinary
        public_id: publicId, // `public_id` extraído
      };
    }

    // Monta "images" se tiver
    if (otherPaths.length > 0) {
      updateData.images = otherPaths.map((p) => ({
        path: p,
        url: p, // URL do Cloudinary
      }));
    }

    // 3) Atualizar o documento no Firestore
    const postRef = firestore.collection("posts").doc(postId);
    await postRef.update(updateData);

    return { success: true };
  } catch (error) {
    console.error("Erro ao salvar imagens do post:", error);
    return {
      error: true,
      message: (error as Error).message || "Falha ao salvar imagens do post",
    };
  }
}

/**
 * Atualiza um post existente no Firestore.
 * @param slug Slug do post a ser atualizado.
 * @param postData Dados atualizados do post, incluindo possivelmente uma nova thumbnail.
 * @returns Resposta da operação.
 */
export async function updatePost(
  slug: string,
  postData: PostInput
): Promise<UpdatePostResponse> {
  try {
    // 1. Validação
    const errorMessage = validateSchema(postValidationSchema, postData);
    if (errorMessage) {
      return { error: true, message: errorMessage };
    }

    // 2. Autenticação do usuário
    const authorId = postData.authorId; // Supondo que o authorId seja passado no postData
    if (!authorId) {
      return { error: true, message: "Usuário não autenticado." };
    }

    // 3. Buscar o post pelo slug
    const postsRef = firestore.collection("posts");
    const querySnapshot = await postsRef.where("slug", "==", slug).get();

    if (querySnapshot.empty) {
      return { error: true, message: "Post não encontrado." };
    }

    const postDoc = querySnapshot.docs[0];
    const postId = postDoc.id;
    const existingPost = postDoc.data() as Post;

    // 4. Checar se o novo slug (se alterado) é único
    if (postData.slug !== existingPost.slug) {
      const slugSnapshot = await postsRef
        .where("slug", "==", postData.slug)
        .get();
      if (!slugSnapshot.empty) {
        return {
          error: true,
          message: "Slug já está em uso. Por favor, escolha outro.",
        };
      }
    }

    // 5. Converter tags
    if (typeof postData.tags === "string") {
      postData.tags = postData.tags.split(",").map((t: string) => t.trim());
    }

    //6. Category

    let categoryRef: DocumentReference | null = null;
    if (postData.categoryId) {
      categoryRef = firestore.collection("categories").doc(postData.categoryId);
    }

    // 7. Gerenciar thumbnail
    const updateData: Partial<Post> = {
      title: postData.title,
      slug: postData.slug,
      meta: postData.meta,
      content: postData.content,
      category: categoryRef,
      tags: postData.tags || [],
      updatedAt: Timestamp.now(),
    };

    if (postData.thumbnail) {
      // Se a thumbnail for um objeto File (nova imagem)
      if (postData.thumbnail instanceof File) {
        // 6.1 Deletar a thumbnail antiga do Cloudinary, se existir
        if (existingPost.thumbnail && existingPost.thumbnail.public_id) {
          try {
            await cloudinary.uploader.destroy(existingPost.thumbnail.public_id);
          } catch (err) {
            console.error("Erro ao deletar thumbnail antiga:", err);
            throw new Error("Falha ao deletar thumbnail antiga.");
          }
        }

        // 6.2 Fazer upload da nova thumbnail usando o helper
        const uploadResponse = await uploadToCloudinary(
          postData.thumbnail,
          `posts/${postId}`
        );
        updateData.thumbnail = {
          url: uploadResponse.secure_url,
          public_id: uploadResponse.public_id,
        };
      }
      // Se a thumbnail for apenas uma URL (sem alteração)
      else if (
        typeof postData.thumbnail === "object" &&
        "url" in postData.thumbnail
      ) {
        updateData.thumbnail = {
          url: postData.thumbnail.url,
          public_id:
            postData.thumbnail.public_id ||
            existingPost.thumbnail?.public_id ||
            "",
        };
      }
    }

    // 7. Atualizar no Firestore
    await postsRef.doc(postId).update(updateData);

    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar post:", error);
    return {
      error: true,
      message: (error as Error).message || "Falha ao atualizar o post",
    };
  }
}
