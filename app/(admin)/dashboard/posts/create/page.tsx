// app/(admin)/posts/create/page.tsx

import { Metadata } from "next";
import CreatePost from "./createPost";
import AdminLayout from "@/app/components/layout/AdminLayout";

// Define metadata for the page
export const metadata: Metadata = {
  title: "New Post | Dev Blogs",
  description: "Create a new blog post",
};

function toStringValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default async function Create({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const title = toStringValue(resolvedSearchParams.title);
  const briefId = toStringValue(resolvedSearchParams.briefId);
  const meta = toStringValue(resolvedSearchParams.meta);
  const content = toStringValue(resolvedSearchParams.content);
  const slug = toStringValue(resolvedSearchParams.slug);
  const tags = toStringValue(resolvedSearchParams.tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return (
    <AdminLayout>
      <CreatePost
        initialDraft={
          title || briefId || meta || content || slug || tags.length
            ? {
                title,
                briefId,
                meta,
                content,
                slug,
                tags: tags.join(", "),
                origin: "studio",
              }
            : undefined
        }
      />
    </AdminLayout>
  );
}
