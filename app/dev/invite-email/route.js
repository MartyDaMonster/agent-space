import { buildInviteEmail } from "@/lib/invite-email";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (process.env.VERCEL_ENV === "production") return new Response("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const message = buildInviteEmail({
    firstName: "Ada",
    joinUrl: `${origin}/join/inv-preview`,
    expiresAt: new Date(Date.now() + 36 * 60 * 60 * 1000),
    countdownUrl: `${origin}/dev/invite-countdown.gif`,
    privacyUrl: `${origin}/privacy`,
    assetOrigin: origin
  });
  return new Response(message.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
