import { Wordmark } from "@/components/Wordmark";

export const metadata = {
  title: "Space invite",
  robots: { index: false, follow: false }
};

export default function SpaceInviteHeldPage() {
  return (
    <main className="welcome-shell">
      <section className="welcome-card space-invite">
        <Wordmark />
        <p className="eyebrow welcome-kicker">Shared space</p>
        <h1>Invite link</h1>
        <p className="lede">Open the invite link again to see the space. The address bar does not keep the token.</p>
      </section>
    </main>
  );
}
