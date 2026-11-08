import { shapeById } from "@/lib/avatar-presets";

export function AvatarMark({ shape }) {
  const spec = shapeById(shape);
  if (!spec) return null;
  return (
    <svg className="avatar-mark" viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      {spec.paths.map((d, index) => (
        <path key={index} d={d} fill="currentColor" />
      ))}
      <g className="eyes">
        <circle cx={spec.eyes[0]} cy={spec.eyeY} r={spec.eyeR} fill="#fff" />
        <circle cx={spec.eyes[1]} cy={spec.eyeY} r={spec.eyeR} fill="#fff" />
      </g>
    </svg>
  );
}
