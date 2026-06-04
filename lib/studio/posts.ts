import { firestore } from "@/firebase/server";
import { DEFAULT_ORG_ID, normalizeStudioOrgId } from "./org";
import type { Post } from "@/app/models/Post";

const POSTS_COLLECTION = "posts";

function normalizePost(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): Post {
  return {
    ...(doc.data() as Post),
    id: doc.id,
  };
}

export async function listPosts(
  orgId = DEFAULT_ORG_ID,
  limit = 100
): Promise<Post[]> {
  const snapshot = await firestore.collection(POSTS_COLLECTION).get();
  const normalizedOrgId = normalizeStudioOrgId(orgId);

  return snapshot.docs
    .map(normalizePost)
    .filter((post) => normalizeStudioOrgId(post.orgId) === normalizedOrgId)
    .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
    .slice(0, limit);
}
