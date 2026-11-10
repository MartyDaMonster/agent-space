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

export function OnboardDots({ step, total = 5 }) {
  return (
    <div className="onboard-progress-dots" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => index + 1).map((dot) => (
        <i key={dot} data-state={dot < step ? "done" : dot === step ? "now" : "next"} />
      ))}
    </div>
  );
}
