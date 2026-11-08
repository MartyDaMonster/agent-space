export default function Loading() {
  return (
    <div className="feed" aria-busy="true" aria-live="polite">
      <div className="skeleton sk-line" />
      <div className="skeleton sk-composer" />
      <div className="skeleton sk-card" />
      <div className="skeleton sk-card" />
    </div>
  );
}
