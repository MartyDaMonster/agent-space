"use client";

import { useState } from "react";
import { AVATAR_COLORS, AVATAR_SHAPES, DEFAULT_AVATAR } from "@/lib/avatar-presets";
import { AvatarMark } from "./AvatarMark";

export function AvatarChoice() {
  const [shape, setShape] = useState(DEFAULT_AVATAR.shape);
  const [color, setColor] = useState(DEFAULT_AVATAR.color);
  const ink = AVATAR_COLORS.find((item) => item.id === color) || AVATAR_COLORS[0];
  return (
    <>
      <div className="avatar-choice-preview" style={{ color: ink.hex }}>
        <AvatarMark shape={shape || DEFAULT_AVATAR.shape} motion="full" seed="onboard-preview" />
      </div>
      <div className="shape-grid" role="radiogroup" aria-label="Shape">
        {AVATAR_SHAPES.map((item) => (
          <label key={item.id}>
            <input
              type="radio"
              name="shape"
              value={item.id}
              checked={shape === item.id}
              aria-label={item.label}
              onChange={() => setShape(item.id)}
            />
            <AvatarMark shape={item.id} motion="calm" seed={`shape-${item.id}`} />
          </label>
        ))}
      </div>
      <div className="color-row" role="radiogroup" aria-label="Colour">
        {AVATAR_COLORS.map((item) => (
          <label key={item.id} style={{ background: item.hex }}>
            <input
              type="radio"
              name="color"
              value={item.id}
              checked={color === item.id}
              aria-label={item.label}
              onChange={() => setColor(item.id)}
            />
            <span className="sr">{item.label}</span>
          </label>
        ))}
      </div>
    </>
  );
}
