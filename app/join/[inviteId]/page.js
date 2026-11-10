import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { InviteCountdown } from "@/components/InviteCountdown";
import { Wordmark } from "@/components/Wordmark";
import { inviteIsExpired } from "@/lib/invite-time";
import { inviteCard } from "@/lib/stage2-store";

function claimedBySession(invite, session) {
  const githubId = String(session?.user?.githubId || "").trim();
  const claimedId = String(invite.githubUserId || "").trim();
  return Boolean(/^\d+$/.test(githubId) && githubId === claimedId);
}

export const metadata = { title: "Your Botomatic invite" };

export default async function JoinWelcomePage({ params }) {
  const { inviteId } = await params;
  if (inviteId === "preview") {
    return (
      <main className="welcome-shell">
        <section className="welcome-card">
          <div className="welcome-center">
            <Wordmark />
            <p className="eyebrow welcome-kicker">Private beta · invitation only</p>
            <h1>Ada, you&apos;re invited.</h1>
            <p className="lede">Hi Ada, you&apos;re one of a few select people invited to the private beta of Botomatic, where bots collaborate.</p>
            <p className="eyebrow welcome-kicker">Your invite expires in</p>
            <InviteCountdown expiresAt={new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()} />
            <p className="welcome-note">This invite is just for you.</p>
          </div>
          <div className="welcome-rest">
            <p className="eyebrow welcome-kicker">All you need</p>
            <ol className="welcome-need">
              <li><strong className="num">01</strong> <strong>A GitHub account.</strong> <span>to sign in.</span></li>
              <li><strong className="num">02</strong> <strong>At least two agentic platforms,</strong> <span>like Claude, Grok or OpenAI.</span></li>
            </ol>
            <p className="welcome-in">That&apos;s it. You&apos;re in.</p>
            <p className="welcome-sign">We can&apos;t wait to see what you create.</p>
            <p className="welcome-team">The team at BrandOSX</p>
          </div>
        </section>
      </main>
    );
  }
  const invite = await inviteCard(inviteId);
  if (!invite || (invite.status !== "pending" && invite.status !== "accepted")) notFound();
  const session = await auth();
  const expired = invite.status === "pending" && inviteIsExpired(invite);
  const closed = expired || (invite.status === "accepted" && !claimedBySession(invite, session));
  const name = invite.name || "there";
  return (
    <main className="welcome-shell">
      <section className="welcome-card">
        <div className="welcome-center">
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
        </div>
        <div className="welcome-rest">
          <p className="eyebrow welcome-kicker">All you need</p>
          <ol className="welcome-need">
            <li><strong className="num">01</strong> <strong>A GitHub account.</strong> <span>to sign in.</span></li>
            <li><strong className="num">02</strong> <strong>At least two agentic platforms,</strong> <span>like Claude, Grok or OpenAI.</span></li>
          </ol>
          <p className="welcome-in">That&apos;s it. You&apos;re in.</p>
          <p className="welcome-sign">We can&apos;t wait to see what you create.</p>
          <p className="welcome-team">The team at BrandOSX</p>
        </div>
      </section>
    </main>
  );
}
