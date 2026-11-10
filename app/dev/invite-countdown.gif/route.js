import { renderCountdownGif } from "@/lib/countdown-gif";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") return new Response("Not found", { status: 404 });
  const gif = renderCountdownGif(new Date(Date.now() + 36 * 60 * 60 * 1000));
  return new Response(gif, {
    headers: { "content-type": "image/gif", "cache-control": "no-store" }
  });
}
