import { useId } from "react";
import { motionTiming, shapeById } from "@/lib/avatar-presets";

function Eyes({ spec }) {
  const rx = spec.eyeRx || spec.eyeR;
  const ry = spec.eyeRy || spec.eyeR;
  const y = spec.eyeY;
  return (
    <g className="bot-eyes eyes" fill="#fff">
      <g className="bot-blink">
        <ellipse cx={spec.eyes[0]} cy={y} rx={rx} ry={ry} />
        <ellipse cx={spec.eyes[1]} cy={y} rx={rx} ry={ry} />
      </g>
    </g>
  );
}

function Crab() {
  return (
    <>
      <g className="crab-legs" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
        <path d="M18 50 L10 55" />
        <path d="M21 54 L15 60" />
        <path d="M46 50 L54 55" />
        <path d="M43 54 L49 60" />
      </g>
      <g className="crab-arm crab-arm-l">
        <path d="M19 40 Q11 35 10 23" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <g className="pincer pincer-l-a"><ellipse cx="7" cy="15.5" rx="4" ry="6.6" transform="rotate(-24 7 15.5)" /></g>
        <g className="pincer pincer-l-b"><ellipse cx="13" cy="15.5" rx="4" ry="6.6" transform="rotate(24 13 15.5)" /></g>
      </g>
      <g className="crab-arm crab-arm-r">
        <path d="M45 40 Q53 35 54 23" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <g className="pincer pincer-r-a"><ellipse cx="51" cy="15.5" rx="4" ry="6.6" transform="rotate(-24 51 15.5)" /></g>
        <g className="pincer pincer-r-b"><ellipse cx="57" cy="15.5" rx="4" ry="6.6" transform="rotate(24 57 15.5)" /></g>
      </g>
      <ellipse cx="32" cy="44" rx="17.5" ry="13" />
    </>
  );
}

function Cloud() {
  return (
    <>
      <circle cx="15" cy="43" r="10" />
      <circle cx="25" cy="33" r="12.5" />
      <circle cx="39" cy="30" r="13" />
      <circle cx="51" cy="41" r="10" />
      <rect x="5" y="38" width="55" height="20" rx="10" />
    </>
  );
}

function Body({ spec }) {
  if (spec.id === "square") return <rect x="9" y="12" width="46" height="46" rx="14" />;
  if (spec.id === "crab") return <Crab />;
  if (spec.id === "cloud") return <Cloud />;
  if (spec.id === "circle") return <circle cx="32" cy="36" r="22" />;
  return spec.paths.map((d) => <path key={d} d={d} />);
}

function Shade({ clipId }) {
  return (
    <g className="bot-shade" clipPath={`url(#${clipId})`}>
      <g className="shade-dark">
        <rect x="-8" y="-6" width="24" height="76" />
        <rect x="16" y="-6" width="14" height="76" opacity="0.42" />
      </g>
      <g className="shade-light">
        <rect x="48" y="-6" width="24" height="76" />
        <rect x="34" y="-6" width="14" height="76" opacity="0.42" />
      </g>
    </g>
  );
}

export function AvatarMark({ shape, motion = "full", seed = "" }) {
  const spec = shapeById(shape);
  const clipId = `botclip${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!spec) return null;
  const motionClass = spec.id === "circle" ? "bot--circle bot--ball" : `bot--${spec.id}`;
  const timing = motionTiming(seed || spec.id);
  return (
    <svg
      className={`avatar-mark bot ${motionClass}${motion === "calm" ? " bot--calm" : ""}`}
      viewBox="0 0 64 64"
      style={timing}
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <Body spec={spec} />
        </clipPath>
      </defs>
      <ellipse className="bot-shadow" cx="32" cy="61" rx="16" ry="2.8" />
      <g className="bot-turn">
        <g className="bot-body" fill="currentColor">
          <Body spec={spec} />
          <Shade clipId={clipId} />
          <Eyes spec={spec} />
        </g>
      </g>
    </svg>
  );
}
