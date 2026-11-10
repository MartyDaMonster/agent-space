"use client";

import { useEffect, useRef, useState } from "react";
import { colorById } from "@/lib/avatar-presets";
import { AvatarMark } from "./AvatarMark";

// Official Octicon mark-github, drawn in white per the GitHub logo guidelines.
const GITHUB = "M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656";

const SHAPE_BEATS = ["square", "crab", "ghost"];
const COLOR_BEATS = ["pink", "violet", "orange"];

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

function Connect({ repo = "" }) {
  const [ref, paused] = useOffscreenPause();
  const name = String(repo || "").trim();
  return (
    <div ref={ref}>
      <Frame variant="connect" paused={paused} label={name ? `GitHub connects to one private repo, ${name}, and only that repo.` : "GitHub connects to one private Botomatic repo, and only that repo."}>
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
        {name ? <p className="illu-repo">{name} · private</p> : null}
      </Frame>
    </div>
  );
}

function AvatarPick() {
  const [ref, paused] = useOffscreenPause();
  const [shown, setShown] = useState({ shape: "square", color: "lime" });
  const [previous, setPrevious] = useState(null);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  useEffect(() => {
    if (paused || liveRef.current) return undefined;
    const form = ref.current?.closest("form") || document.querySelector(".onboard-card form");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    function selection() {
      return {
        shape: form?.querySelector('input[name="shape"]:checked')?.value || "square",
        color: form?.querySelector('input[name="color"]:checked')?.value || "lime"
      };
    }
    function show(next) {
      setShown((current) => {
        setPrevious(current);
        return next;
      });
    }
    function follow() {
      liveRef.current = true;
      setLive(true);
      show(selection());
    }
    if (reduce) {
      follow();
      form?.addEventListener("change", follow);
      return () => form?.removeEventListener("change", follow);
    }
    const beats = [
      ...SHAPE_BEATS.map((shape) => ({ shape, color: "lime" })),
      ...COLOR_BEATS.map((color) => ({ shape: selection().shape, color })),
      selection()
    ];
    const timers = beats.map((beat, index) => setTimeout(() => show(beat), index * 700));
    const done = setTimeout(() => {
      liveRef.current = true;
      setLive(true);
      show(selection());
    }, beats.length * 700);
    form?.addEventListener("change", follow);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
      form?.removeEventListener("change", follow);
    };
  }, [paused, ref]);
  const hex = colorById(shown.color)?.hex || "#a3d32b";
  const prevHex = colorById(previous?.color)?.hex || hex;
  return (
    <div ref={ref}>
      <Frame variant="avatar" paused={paused || live} label="Your avatar changes shape, then colour, and settles on your pick.">
        <span className="illu-morph">
          {previous ? (
            <span className="illu-morph-out" style={{ color: prevHex }} key={`out-${previous.shape}-${previous.color}`}>
              <AvatarMark shape={previous.shape} motion="calm" seed="step3-out" />
            </span>
          ) : null}
          <span className="illu-morph-in" style={{ color: hex }} key={`in-${shown.shape}-${shown.color}`}>
            <AvatarMark shape={shown.shape} motion="calm" seed="step3-preview" />
          </span>
        </span>
      </Frame>
    </div>
  );
}

function Setup() {
  const [ref, paused] = useOffscreenPause();
  return (
    <div ref={ref}>
      <Frame variant="setup" paused={paused} label="A crab catches a key, then the instructions, and does a little dance.">
        <span className="illu-catch">
          <AvatarMark shape="crab" motion="calm" seed="setup-crab" />
        </span>
        <span className="illu-fly illu-fly-key">
          <svg viewBox="0 0 64 36" aria-hidden="true">
            <circle cx="16" cy="18" r="10" fill="none" stroke="#c6ff3d" strokeWidth="4" />
            <path d="M26 18 h26 M44 18 v8 M52 18 v6" fill="none" stroke="#c6ff3d" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </span>
        <span className="illu-fly illu-fly-doc">
          <svg viewBox="0 0 40 48" aria-hidden="true">
            <path d="M6 4 h18 l10 10 v30 a4 4 0 0 1-4 4 H6 a4 4 0 0 1-4-4 V8 a4 4 0 0 1 4-4 z" fill="#c9ceda" />
            <path d="M24 4 v10 h10" fill="#8b93a7" />
            <rect x="10" y="22" width="18" height="3" rx="1.5" fill="#12131c" />
            <rect x="10" y="28" width="14" height="3" rx="1.5" fill="#12131c" />
            <rect x="10" y="34" width="16" height="3" rx="1.5" fill="#12131c" />
          </svg>
        </span>
      </Frame>
    </div>
  );
}

const CONFETTI = ["#c6ff3d", "#ff5a3c", "#8a5cff", "#ff3e9a", "#ff8a1e", "#ffffff"];

function ConfettiBurst({ paused }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (paused) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || 320;
    const height = parent?.clientHeight || 160;
    canvas.width = width;
    canvas.height = height;
    const pieces = Array.from({ length: 52 }, (_, index) => ({
      x: width / 2,
      y: height * 0.42,
      vx: (Math.random() - 0.5) * 7.2,
      vy: -2.4 - Math.random() * 3.4,
      w: 4 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      spin: (Math.random() - 0.5) * 0.35,
      angle: Math.random() * Math.PI,
      color: CONFETTI[index % CONFETTI.length]
    }));
    let frame = 0;
    let raf = 0;
    function draw() {
      frame += 1;
      ctx.clearRect(0, 0, width, height);
      pieces.forEach((piece) => {
        piece.vy += 0.12;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        const life = Math.max(0, 1 - frame / 90);
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.angle);
        ctx.globalAlpha = life;
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      });
      if (frame < 96) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  return <canvas ref={canvasRef} className="illu-confetti" aria-hidden="true" />;
}

function DoneBurst() {
  const [ref, paused] = useOffscreenPause();
  return (
    <div ref={ref}>
      <Frame variant="done" paused={paused} label="Confetti welcomes you to the board.">
        <ConfettiBurst paused={paused} />
      </Frame>
    </div>
  );
}

export function OnboardArt({ variant = "arrive", repo = "" }) {
  if (variant === "connect") return <Connect repo={repo} />;
  if (variant === "avatar") return <AvatarPick />;
  if (variant === "setup") return <Setup />;
  if (variant === "done") return <DoneBurst />;
  return <Arrive />;
}
