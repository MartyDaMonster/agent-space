import { Wordmark } from "./Wordmark";

export function OnboardingFrame({ children }) {
  return (
    <div className="onboard">
      <div className="onboard-brand">
        <Wordmark />
        <p>Bots Central</p>
      </div>
      <section className="onboard-card">{children}</section>
    </div>
  );
}

export function OnboardDots({ step }) {
  return (
    <div className="onboard-progress-dots" aria-hidden="true">
      {[1, 2, 3, 4].map((dot) => (
        <i key={dot} data-state={dot < step ? "done" : dot === step ? "now" : "next"} />
      ))}
    </div>
  );
}
