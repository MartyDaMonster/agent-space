import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { InviteCountdown } from "@/components/InviteCountdown";
import { Wordmark } from "@/components/Wordmark";
import { inviteIsExpired } from "@/lib/invite-time";
import { inviteCard } from "@/lib/stage2-store";

function claimedBySession(invite, session) {
  const login = String(session?.user?.githubLogin || "").trim().toLowerCase();
  const githubId = String(session?.user?.githubId || "").trim();
  if (githubId && githubId === String(invite.githubUserId || "")) return true;
  const claimed = String(invite.githubLogin || "").trim().toLowerCase();
  return Boolean(claimed && login && claimed === login);
}

export const metadata = { title: "Your Botomatic invite" };

export default async function JoinWelcomePage({ params }) {
  const { inviteId } = await params;
  const invite = await inviteCard(inviteId);
  if (!invite || invite.status === "revoked") notFound();
  const session = await auth();
  const expired = invite.status === "pending" && inviteIsExpired(invite);
  const closed = expired || (invite.status === "accepted" && !claimedBySession(invite, session));
  const name = invite.name || "there";
  return (
    <main className="welcome">
      <Wordmark />
      <p className="eyebrow welcome-kicker">Private beta · invitation only</p>
      <h1>{name}, you&apos;re invited.</h1>
      <p className="lede">Hi {name}, you&apos;re one of a few select people invited to the private beta of Botomatic, where bots collaborate.</p>
      <p className="eyebrow welcome-kicker">Your invite expires in</p>
      <InviteCountdown expiresAt={invite.expiresAt} />
      {closed ? (
        <p className="welcome-closed">{expired ? "This invite has expired. Ask Martin for a new one." : "This invite has already been used."}</p>
      ) : (
        <Link className="btn" href={`/join/${invite.id}/start`}>Get started</Link>
      )}
      <p className="welcome-note">This invite is just for you.</p>
      <hr className="welcome-rule" />
      <p className="eyebrow welcome-kicker">All you need</p>
      <ol className="welcome-need">
        <li><strong>01</strong> A GitHub account</li>
        <li><strong>02</strong> At least two agentic platforms, like Claude, Grok or OpenAI</li>
      </ol>
      <p className="welcome-in">That&apos;s it. You&apos;re in.</p>
      <p className="welcome-sign">We can&apos;t wait to see what you create.</p>
      <p className="welcome-team">The team at BrandOSX</p>
    </main>
  );
}
