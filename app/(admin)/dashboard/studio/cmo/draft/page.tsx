export const dynamic = "force-dynamic";

import DraftClient from "./DraftClient";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StudioCmoDraftPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <DraftClient initialSearchParams={resolvedSearchParams} />;
}
