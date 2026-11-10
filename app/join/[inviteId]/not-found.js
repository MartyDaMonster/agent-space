import { OnboardingFrame } from "@/components/OnboardingFrame";

export default function JoinNotFound() {
  return (
    <OnboardingFrame>
      <h1>This invite isn't available</h1>
      <p>It may have expired, or the link is no longer open.</p>
      <div className="onboard-actions">
        <a className="btn" href="/">Go to the board</a>
      </div>
    </OnboardingFrame>
  );
}
