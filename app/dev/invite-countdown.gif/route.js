import { renderCountdownPng } from "@/lib/countdown-png";
import { COUNTDOWN_HEADERS } from "@/lib/countdown-route";
import { devPreviewBlocked } from "@/lib/dev-preview";

export const dynamic = "force-dynamic";

export async function GET() {
  if (devPreviewBlocked()) return new Response("Not found", { status: 404 });
  const png = await renderCountdownPng(new Date(Date.now() + 36 * 60 * 60 * 1000));
  return new Response(png, { headers: COUNTDOWN_HEADERS });
}
