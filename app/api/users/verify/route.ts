import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const oobCode = String((body as { oobCode?: unknown })?.oobCode || "").trim();

  return NextResponse.json(
    {
      error: true,
      message:
        "Este endpoint foi desativado. Use o fluxo de verificação do cliente em /verify-email com oobCode.",
      oobCodeReceived: Boolean(oobCode),
    },
    { status: 410 },
  );
}
