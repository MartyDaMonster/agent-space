"use client";

import { useEffect, useRef } from "react";
import { takeOnce, videoRatio } from "@/lib/metric-events";

function postMetric(type, referrer) {
  const body = { type };
  if (referrer) body.referrer = referrer;
  fetch("/api/metrics/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true
  }).catch(() => {});
}

export function LoginView() {
  useEffect(() => {
    const seen = window.__botomaticMetrics || (window.__botomaticMetrics = {});
    if (takeOnce(seen, "login_view")) postMetric("login_view", document.referrer || "");
  }, []);
  return null;
}

export function LoginPromo() {
  const videoRef = useRef(null);

  useEffect(() => {
    const seen = window.__botomaticMetrics || (window.__botomaticMetrics = {});
    const referrer = document.referrer || "";
    const video = videoRef.current;
    if (!video) return undefined;

    function onPlay() {
      if (takeOnce(seen, "video_play")) postMetric("video_play", referrer);
    }
    function onProgress() {
      if (videoRatio(video.currentTime, video.duration) >= 0.9 && takeOnce(seen, "video_complete")) {
        postMetric("video_complete", referrer);
      }
    }
    function onEnded() {
      if (takeOnce(seen, "video_complete")) postMetric("video_complete", referrer);
    }

    video.addEventListener("play", onPlay);
    video.addEventListener("timeupdate", onProgress);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("timeupdate", onProgress);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="login-promo"
      controls
      playsInline
      preload="metadata"
      poster="/promo/botomatic-promo.jpg"
      src="/promo/botomatic-promo.mp4"
    >
      <a href="/promo/botomatic-promo.mp4">Watch the Botomatic promo</a>
    </video>
  );
}
