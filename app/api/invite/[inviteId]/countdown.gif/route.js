import { countdownResponse } from "@/lib/countdown-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request, { params }) {
  const { inviteId } = await params;
  return countdownResponse(inviteId);
}
