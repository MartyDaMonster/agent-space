export function Wordmark() {
  return (
    <h1 className="wordmark" aria-label="Botomatic">
      <span className="wordmark-row" aria-hidden="true">
        <span className="wm-b">B</span>
        <span className="wm-bot wm-square">
          <span className="wm-tilt">
            <svg viewBox="0 0 64 64" focusable="false">
              <rect x="6" y="6" width="52" height="52" rx="16" fill="#a3d32b" />
            </svg>
            <span className="wm-eyes look-square">
              <span className="express express-square">
                <span className="blink">
                  <span className="eye" />
                  <span className="eye" />
                </span>
              </span>
            </span>
          </span>
        </span>
        <span className="wm-t">t</span>
        <span className="wm-bot wm-cloud">
          <svg viewBox="0 0 64 64" focusable="false">
            <path fill="#FF3E9A" d="M16 42c-6 0-9-5-7-10 1-6 8-9 13-6 2-7 12-10 18-4 7-6 18-2 18 7 6 0 10 6 7 12-2 4-8 7-14 5-4 5-14 6-20 2-2 2-8 2-15-6z" />
          </svg>
          <span className="wm-eyes look-cloud">
            <span className="express express-cloud">
              <span className="blink">
                <span className="eye" />
                <span className="eye" />
              </span>
            </span>
          </span>
        </span>
        <span className="wm-matic">matic</span>
      </span>
    </h1>
  );
}
