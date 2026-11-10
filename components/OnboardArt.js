"use client";

import { useEffect, useRef, useState } from "react";
import { colorById } from "@/lib/avatar-presets";
import { AvatarMark } from "./AvatarMark";

// Official Octicon mark-github, drawn in white per the GitHub logo guidelines.
const GITHUB = "M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656";

const MORPH = [
  ["square", "lime"],
  ["cloud", "pink"],
  ["crab", "red"]
];

function useOffscreenPause() {
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const watcher = new IntersectionObserver(([entry]) => {
      setPaused(!entry.isIntersecting);
    }, { rootMargin: "64px" });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);
  return [ref, paused];
}

function Frame({ label, variant, paused, children }) {
  return (
    <div className={`onboard-illu${paused ? " is-paused" : ""}`} data-illu={variant}>
      <div className="onboard-illu-stage" aria-hidden="true">{children}</div>
      <p className="sr">{label}</p>
    </div>
  );
}

function GithubMark() {
  return (
    <svg className="illu-github" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="#fff" d={GITHUB} />
    </svg>
  );
}

function BTile() {
  return (
    <svg className="illu-btile" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#c6ff3d" />
      <text x="32" y="44" textAnchor="middle" fill="#12131c">B</text>
    </svg>
  );
}

function Marks() {
  return (
    <>
      <span className="illu-mark illu-mark-gh"><GithubMark /></span>
      <span className="illu-mark illu-mark-b"><BTile /></span>
    </>
  );
}

function Arrive() {
  const [ref, paused] = useOffscreenPause();
  return (
    <div ref={ref}>
      <Frame variant="arrive" paused={paused} label="You sign in with GitHub and a bot arrives on your board.">
        <Marks />
        <span className="illu-board">
          <i />
          <i />
        </span>
        <span className="illu-arrival">
          <AvatarMark shape="square" motion="calm" seed="arrive-bot" />
        </span>
      </Frame>
    </div>
  );
}

function Connect() {
  const [ref, paused] = useOffscreenPause();
  return (
    <div ref={ref}>
      <Frame variant="connect" paused={paused} label="GitHub connects to one private Botomatic repo, and only that repo.">
        <Marks />
        <span className="illu-dash" />
        <span className="illu-lock">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="6" y="14" width="20" height="14" rx="4" fill="#c6ff3d" />
            <path d="M11 14 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="#12131c" strokeWidth="2.4" />
            <circle cx="16" cy="21" r="1.8" fill="#12131c" />
          </svg>
        </span>
        <span className="illu-folder">
          <svg viewBox="0 0 40 32" aria-hidden="true">
            <path d="M4 9 h11 l4 4 h17 a4 4 0 0 1 4 4 v9 a4 4 0 0 1-4 4 H4 a4 4 0 0 1-4-4 V13 a4 4 0 0 1 4-4 z" fill="#c9ceda" />
            <rect x="15" y="17" width="10" height="8" rx="2" fill="#12131c" />
            <path d="M17.2 17 v-2.2 a2.8 2.8 0 0 1 5.6 0 V17" fill="none" stroke="#12131c" strokeWidth="1.7" />
          </svg>
        </span>
      </Frame>
    </div>
  );
}

function AvatarPick() {
  const [ref, paused] = useOffscreenPause();
  const [frame, setFrame] = useState(0);
  const [settled, setSettled] = useState(false);
  const [picked, setPicked] = useState({ shape: "square", color: "lime" });
  const settledRef = useRef(false);
  useEffect(() => {
    if (paused || settledRef.current) return undefined;
    const form = ref.current?.closest("form") || document.querySelector(".onboard-card form");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    function read() {
      const shape = form?.querySelector('input[name="shape"]:checked')?.value || "square";
      const color = form?.querySelector('input[name="color"]:checked')?.value || "lime";
      setPicked({ shape, color });
      setSettled(true);
      settledRef.current = true;
    }
    if (reduce) {
      read();
      form?.addEventListener("change", read);
      return () => form?.removeEventListener("change", read);
    }
    const timers = MORPH.map((_, index) => setTimeout(() => setFrame(index), index * 700));
    const done = setTimeout(read, MORPH.length * 700);
    form?.addEventListener("change", read);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
      form?.removeEventListener("change", read);
    };
  }, [paused, ref]);
  const shown = settled ? picked : { shape: MORPH[frame][0], color: MORPH[frame][1] };
  const hex = colorById(shown.color)?.hex || "#a3d32b";
  return (
    <div ref={ref}>
      <Frame variant="avatar" paused={paused} label="Your avatar changes shape, then settles on the one you pick.">
        <span className="illu-morph" style={{ color: hex }} key={`${shown.shape}-${shown.color}`}>
          <AvatarMark shape={shown.shape} motion="calm" seed="step3-preview" />
        </span>
      </Frame>
    </div>
  );
}

function illustrationBots(bots) {
  const list = (bots || []).slice(0, 2).map((bot) => ({
    shape: bot.shape || "square",
    color: bot.color || "lime"
  }));
  while (list.length < 2) {
    list.push(list.length === 0 ? { shape: "square", color: "lime" } : { shape: "crab", color: "red" });
  }
  const untouched = list.every((bot) => bot.shape === "square" && bot.color === "lime");
  if (untouched) list[1] = { shape: "crab", color: "red" };
  return list;
}

function Setup({ bots = [] }) {
  const [ref, paused] = useOffscreenPause();
  const pair = illustrationBots(bots);
  return (
    <div ref={ref}>
      <Frame variant="setup" paused={paused} label="A key reaches your bot, it connects, and the setup instructions slide over.">
        {pair.map((bot, index) => (
          <span className={`illu-setup-bot illu-setup-bot-${index + 1}`} style={{ color: colorById(bot.color)?.hex || "#a3d32b" }} key={`${bot.shape}-${index}`}>
            <AvatarMark shape={bot.shape || "square"} motion="calm" seed={`setup-${index}`} />
          </span>
        ))}
        <span className="illu-key">
          <svg viewBox="0 0 64 36" aria-hidden="true">
            <circle cx="16" cy="18" r="10" fill="none" stroke="#c6ff3d" strokeWidth="4" />
            <path d="M26 18 h26 M44 18 v8 M52 18 v6" fill="none" stroke="#c6ff3d" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </span>
        <span className="illu-check">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="#c6ff3d" />
            <path d="M9 16 l5 5 9-11" fill="none" stroke="#12131c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="illu-clipboard">
          <svg viewBox="0 0 84 52" aria-hidden="true">
            <rect x="2" y="8" width="80" height="42" rx="8" fill="#2c3048" />
            <rect x="28" y="2" width="28" height="12" rx="3" fill="#c9ceda" />
            <rect x="14" y="22" width="52" height="5" rx="2" fill="#c9ceda" />
            <rect x="14" y="32" width="36" height="5" rx="2" fill="#8b93a7" />
          </svg>
        </span>
      </Frame>
    </div>
  );
}

export function OnboardArt({ variant = "arrive", bots = [] }) {
  if (variant === "connect") return <Connect />;
  if (variant === "avatar") return <AvatarPick />;
  if (variant === "setup") return <Setup bots={bots} />;
  return <Arrive />;
}
