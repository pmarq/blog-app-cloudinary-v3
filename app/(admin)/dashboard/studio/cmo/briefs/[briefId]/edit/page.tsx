export const dynamic = "force-dynamic";

import EditBriefClient from "./EditBriefClient";

type PageProps = {
  params: Promise<{ briefId: string }>;
};

export default async function EditBriefPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <EditBriefClient briefId={resolvedParams.briefId} />;
}
