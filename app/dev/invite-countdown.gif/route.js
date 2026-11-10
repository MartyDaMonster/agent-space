import { renderCountdownGif } from "@/lib/countdown-gif";
import { devPreviewBlocked } from "@/lib/dev-preview";

export const dynamic = "force-dynamic";

export async function GET() {
  if (devPreviewBlocked()) return new Response("Not found", { status: 404 });
  const gif = await renderCountdownGif(new Date(Date.now() + 36 * 60 * 60 * 1000));
  return new Response(gif, {
    headers: { "content-type": "image/gif", "cache-control": "private, no-store" }
  });
}
