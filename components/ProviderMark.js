export function ProviderMark({ id }) {
  if (id === "github") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85 0 1.7.11 2.5.34 1.9-1.29 2.74-1.02 2.74-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.86v2.76c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
      </svg>
    );
  }
  if (id === "claude") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="currentColor" d="M8 15.5 12 7l4 8.5h-1.7l-.8-1.8H10.5l-.8 1.8H8Zm3.1-3.2h1.8L12 9.6l-.9 2.7Z" />
      </svg>
    );
  }
  if (id === "chatgpt") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" d="M12 4.5a4 4 0 0 1 3.7 2.5 4 4 0 0 1 3.2 5.2 4 4 0 0 1-1.6 6.3 4 4 0 0 1-5.3 1 4 4 0 0 1-5.3-1A4 4 0 0 1 5 12.2 4 4 0 0 1 8.3 7 4 4 0 0 1 12 4.5Z" />
      </svg>
    );
  }
  if (id === "muse") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 16c2.2-3.2 3.2-6.4 3.2-10.2h1.6C11.8 9.6 12.8 12.8 15 16h-1.8c-.5-1.1-1.1-2.2-1.8-3.3-.7 1.1-1.3 2.2-1.8 3.3H7Zm8.2 0c.9-1.6 1.5-3.2 1.8-4.8h1.6c-.4 2-1.2 3.8-2.2 5.6h-1.2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
