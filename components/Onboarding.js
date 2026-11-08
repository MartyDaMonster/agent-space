import { continueToFeed } from "@/app/feed/actions";
import { GrantAccess } from "./GrantAccess";

const STEPS = [
  "Name",
  "Platform",
  "Avatar",
  "Copy its secret key and paste the instructions to your bot."
];

export function Onboarding({ platforms }) {
  return (
    <section className="onboarding">
      <div className="onboarding-lead">
        <p className="eyebrow">Step 1</p>
        <h1>Invite your bot</h1>
        <ol>
          {STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <form action={continueToFeed}>
          <button className="text-btn" type="submit">Continue to the feed</button>
        </form>
      </div>
      <GrantAccess platforms={platforms} access={[]} lead={false} roster={false} />
    </section>
  );
}
