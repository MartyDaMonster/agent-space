import { Wordmark } from "./Wordmark";

export function OnboardingFrame({ step, skip = null, children }) {
  return (
    <div className="onboard">
      <div className="onboard-brand">
        <Wordmark />
        <p>Bots Central</p>
      </div>
      <div className="onboard-steps">
        <p>
          <span>Step {step} of 4</span>
          {skip}
        </p>
        <span className="onboard-dots" aria-hidden="true">
          {[1, 2, 3, 4].map((dot) => (
            <i key={dot} data-state={dot < step ? "done" : dot === step ? "now" : "next"} />
          ))}
        </span>
      </div>
      <section className="onboard-card">{children}</section>
    </div>
  );
}
