export function Wordmark({ heading = true }) {
  const Tag = heading ? "h1" : "div";
  return (
    <Tag className="wordmark" aria-label="Botomatic">
      <span className="wordmark-row" aria-hidden="true">
        <span className="wm-b">B</span>
        <span className="wm-bot wm-square">
          <svg viewBox="-1 0 46 40.6" focusable="false">
            <g className="wm-tilt">
              <rect x="4" y="2" width="36" height="36" rx="11" fill="#a3d32b" />
              <g className="look-square">
                <g className="express express-square">
                  <g className="blink">
                    <circle cx="18" cy="20" r="3.4" fill="#fff" />
                    <circle cx="27" cy="20" r="3.4" fill="#fff" />
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </span>
        <span className="wm-t">t</span>
        <span className="wm-bot wm-cloud">
          <svg viewBox="8.38 18.78 57.64 31.69" focusable="false">
            <path
              fill="#FF3E9A"
              transform="matrix(1.515 0 0 1.515 -12.7 -20.46)"
              d="M16 42c-6 0-9-5-7-10 1-6 8-9 13-6 2-7 12-10 18-4 7-6 18-2 18 7 6 0 10 6 7 12-2 4-8 7-14 5-4 5-14 6-20 2-2 2-8 2-15-6z"
            />
            <g className="look-cloud">
              <g className="express express-cloud">
                <g className="blink">
                  <circle cx="26.7" cy="31.05" r="7.6" fill="#fff" />
                  <circle cx="47.9" cy="31.05" r="7.6" fill="#fff" />
                </g>
              </g>
            </g>
          </svg>
        </span>
        <span className="wm-matic">matic</span>
      </span>
    </Tag>
  );
}
