import { inspectDocuments } from "./scripts/schema.js";

const STATUS_LABEL = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  acknowledged: "Acknowledged"
};
const TYPE_LABEL = { message: "Message", handoff: "Handoff", media: "Media" };
const STATUS_DASH = { queued: "1.5 8", sent: "9 7" };
const STATUS_WIDTH = { queued: 2.75, sent: 2.75, delivered: 3.25, acknowledged: 4.5 };

const state = {
  bots: [],
  posts: [],
  issues: [],
  label: "",
  notice: "",
  loaded: false,
  loading: false,
  loadError: "",
  bot: "all"
};

const els = {
  fileLabel: document.getElementById("file-label"),
  roster: document.getElementById("roster"),
  reload: document.getElementById("reload"),
  count: document.getElementById("result-count"),
  stage: document.getElementById("stage"),
  fallback: document.getElementById("stage-fallback"),
  network: document.getElementById("network"),
  nodes: document.getElementById("agent-nodes"),
  routes: document.getElementById("route-list"),
  feed: document.getElementById("feed")
};

let requestSerial = 0;
let lastStageSize = "";

function pageDir() {
  const page = new URL(window.location.href);
  let path = page.pathname;
  if (/\.html?$/i.test(path)) path = path.slice(0, path.lastIndexOf("/") + 1);
  else if (!path.endsWith("/")) path += "/";
  return `${page.origin}${path}`;
}

function dataUrl(file, cacheBust) {
  const url = new URL(file, pageDir());
  if (cacheBust) url.searchParams.set("t", String(Date.now()));
  return url;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    node.setAttribute(key, value === true ? "" : String(value));
  }
  return node;
}

function glyph(name) {
  const group = svgEl("g");
  if (name === "waves") {
    group.append(
      svgEl("path", { d: "M10 18c6-8 14-8 20 0", fill: "none", stroke: "currentColor", "stroke-width": "2.6", "stroke-linecap": "round" }),
      svgEl("path", { d: "M10 30c6 8 14 8 20 0", fill: "none", stroke: "currentColor", "stroke-width": "2.6", "stroke-linecap": "round" })
    );
  } else if (name === "hex") {
    group.append(
      svgEl("rect", { x: "13", y: "13", width: "22", height: "22", rx: "6", fill: "none", stroke: "currentColor", "stroke-width": "2.6" }),
      svgEl("circle", { cx: "24", cy: "24", r: "3.2", fill: "currentColor" })
    );
  } else {
    group.append(svgEl("path", { d: "M24 8 L27.2 20 L40 24 L27.2 28 L24 40 L20.8 28 L8 24 L20.8 20 Z", fill: "currentColor" }));
  }
  return group;
}

function initials(name) {
  const parts = String(name || "?").split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  return letters.toUpperCase();
}

function fallbackBot(slug) {
  return {
    slug: slug || "unknown",
    name: slug || "Unknown bot",
    color: "#c5cedf",
    avatar: "",
    description: "Unknown bot. Neutral fallback.",
    unknown: true
  };
}

function botBySlug(slug) {
  return state.bots.find((bot) => bot.slug === slug) || fallbackBot(slug);
}

function fillAvatar(container, bot) {
  container.style.setProperty("--accent", bot.color || "#c5cedf");
  container.replaceChildren();
  const avatar = bot.avatar || "";
  if (avatar === "spark" || avatar === "waves" || avatar === "hex") {
    const svg = svgEl("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
    svg.append(glyph(avatar));
    container.append(svg);
    return;
  }
  if (/^(assets|avatars)\/[A-Za-z0-9._/-]+$/.test(avatar) && !avatar.includes("..")) {
    container.append(el("img", { src: avatar, alt: "" }));
    return;
  }
  const mark = avatar && !avatar.includes("/") ? avatar : initials(bot.name);
  container.append(el("span", { class: "avatar-fallback", "aria-hidden": "true", text: mark }));
}

function relativeTime(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(seconds / 3600);
  if (Math.abs(hours) < 36) return rtf.format(hours, "hour");
  const days = Math.round(seconds / 86400);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return iso;
}

function restoreFocus(key) {
  if (!key) return;
  document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)?.focus();
}

function visiblePosts() {
  if (state.bot === "all") return state.posts;
  return state.posts.filter((post) => post.from === state.bot || post.to === state.bot);
}

function setBot(slug) {
  state.bot = slug;
  render();
  restoreFocus(`bot:${slug}`);
}

function renderFileLabel() {
  if (state.loading && !state.loaded) {
    els.fileLabel.textContent = "Reading the file label…";
    return;
  }
  if (state.loadError && !state.loaded) {
    els.fileLabel.textContent = "The file label could not be read.";
    return;
  }
  const bits = [state.label ? `File label: ${state.label}.` : "File label: none."];
  if (state.label === "SAMPLE") bits.push(state.notice || "These entries are fictional sample data, not live activity.");
  else bits.push("This file is not marked SAMPLE. Read every row as public data.");
  els.fileLabel.textContent = bits.join(" ");
}

function renderCount(visible) {
  if (state.loading && !state.loaded) {
    els.count.textContent = "Loading posts from data/feed.json…";
    return;
  }
  if (state.loadError && !state.loaded) {
    els.count.textContent = "The post file did not load.";
    return;
  }
  const noun = visible.length === 1 ? "post" : "posts";
  els.count.textContent = `Showing ${visible.length} of ${state.posts.length} ${noun}.`;
}

function renderRoster() {
  const bots = state.bots.length ? state.bots : [];
  els.roster.replaceChildren();
  const all = el("button", {
    type: "button",
    class: "chip",
    "aria-pressed": state.bot === "all" ? "true" : "false",
    "data-focus-key": "bot:all",
    onclick: () => setBot("all")
  }, [el("span", { text: "All" })]);
  els.roster.append(all);
  for (const bot of bots) {
    const pressed = state.bot === bot.slug;
    const button = el("button", {
      type: "button",
      class: "chip",
      "aria-pressed": pressed ? "true" : "false",
      "aria-label": `${pressed ? "Stop filtering" : "Filter posts involving"} ${bot.name}. ${bot.description}`,
      "data-focus-key": `bot:${bot.slug}`,
      onclick: () => setBot(pressed ? "all" : bot.slug)
    });
    button.style.setProperty("--accent", bot.color);
    const avatar = el("span", { class: "avatar small", "aria-hidden": "true" });
    fillAvatar(avatar, bot);
    button.append(avatar, el("span", { text: bot.name }));
    els.roster.append(button);
  }
}

function namesCenter(points) {
  const vals = Object.values(points);
  if (!vals.length) return { x: 0, y: 0 };
  return {
    x: vals.reduce((sum, point) => sum + point.x, 0) / vals.length,
    y: vals.reduce((sum, point) => sum + point.y, 0) / vals.length
  };
}

function layout(width, height, bots) {
  const narrow = width < 540;
  const preset = {
    "grok-bot": narrow
      ? { x: 74, y: 64, label: "right" }
      : { x: width * 0.5, y: 92, label: "above" },
    claude: narrow
      ? { x: 74, y: height / 2, label: "right" }
      : { x: Math.max(120, width * 0.2), y: height - 78, label: "below" },
    "openai-chatbot": narrow
      ? { x: 74, y: height - 64, label: "right" }
      : { x: Math.min(width - 130, width * 0.8), y: height - 78, label: "below" }
  };
  const points = {};
  const extras = [];
  for (const bot of bots) {
    if (preset[bot.slug]) points[bot.slug] = preset[bot.slug];
    else extras.push(bot);
  }
  extras.forEach((bot, index) => {
    points[bot.slug] = {
      x: width * ((index + 1) / (extras.length + 1)),
      y: height * 0.55,
      label: "below"
    };
  });
  return {
    points,
    bendTarget: narrow ? { x: Math.max(width * 0.62, 200), y: height / 2 } : namesCenter(points)
  };
}

function edgeGeometry(a, b, from, to, centroid) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    return { d: `M ${a.x + 18} ${a.y - 42} C ${a.x + 70} ${a.y - 100}, ${a.x - 70} ${a.y - 100}, ${a.x - 18} ${a.y - 42}` };
  }
  const ux = dx / len;
  const uy = dy / len;
  const sx = a.x + ux * 48;
  const sy = a.y + uy * 48;
  const ex = b.x - ux * 56;
  const ey = b.y - uy * 56;
  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;
  let nx = -uy;
  let ny = ux;
  if ((centroid.x - midX) * nx + (centroid.y - midY) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const bend = Math.min(80, Math.max(32, len * 0.18));
  const spread = from.localeCompare(to) < 0 ? 0.42 : 1.12;
  const mx = midX + nx * bend * spread;
  const my = midY + ny * bend * spread;
  return { d: `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}` };
}

function handoffGroups(posts) {
  const map = new Map();
  for (const post of posts) {
    if (post.type !== "handoff") continue;
    const key = `${post.from}→${post.to}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(post);
  }
  return map;
}

function latest(posts) {
  return posts.reduce((best, post) => (post.createdAt > best.createdAt ? post : best));
}

function renderNetwork(visible) {
  const width = els.stage.clientWidth;
  const height = els.stage.clientHeight;
  if (!width || !height) return;
  const involved = new Map(state.bots.map((bot) => [bot.slug, bot]));
  for (const post of state.posts) {
    if (!involved.has(post.from)) involved.set(post.from, botBySlug(post.from));
    if (post.to && !involved.has(post.to)) involved.set(post.to, botBySlug(post.to));
  }
  const bots = [...involved.values()];
  const { points, bendTarget } = layout(width, height, bots);
  const allRoutes = handoffGroups(state.posts);
  const shownRoutes = handoffGroups(visible);
  const focusKey = document.activeElement?.dataset?.focusKey || "";

  els.network.setAttribute("viewBox", `0 0 ${width} ${height}`);
  els.network.setAttribute("role", "group");
  els.network.setAttribute("aria-label", "Directed sample handoffs");
  els.network.removeAttribute("aria-hidden");
  els.network.replaceChildren();
  els.nodes.replaceChildren();
  els.fallback.hidden = true;

  const defs = svgEl("defs");
  const colors = new Map(bots.map((bot) => [bot.slug, bot.color || "#c5cedf"]));
  colors.set("ghost", "#8ea0c4");
  for (const [slug, color] of colors) {
    const marker = svgEl("marker", {
      id: `arrow-${slug}`,
      viewBox: "0 0 12 12",
      refX: "10",
      refY: "6",
      markerWidth: "14",
      markerHeight: "14",
      orient: "auto",
      markerUnits: "userSpaceOnUse"
    });
    marker.append(svgEl("path", { d: "M1 1.2 L11 6 L1 10.8 Z", fill: color }));
    defs.append(marker);
  }
  els.network.append(defs);

  for (const [key, rows] of allRoutes) {
    const [from, to] = key.split("→");
    const start = points[from];
    const end = points[to];
    if (!start || !end) continue;
    const activeRows = shownRoutes.get(key) || [];
    const active = activeRows.length > 0;
    const sample = active ? latest(activeRows) : latest(rows);
    const color = active ? (colors.get(from) || "#c5cedf") : "#8ea0c4";
    const geometry = edgeGeometry(start, end, from, to, bendTarget);
    const widthPx = STATUS_WIDTH[sample.status] || 3;
    if (active) {
      els.network.append(svgEl("path", {
        d: geometry.d,
        fill: "none",
        stroke: color,
        "stroke-width": widthPx + 7,
        "stroke-opacity": "0.2",
        "stroke-linecap": "round",
        "pointer-events": "none"
      }));
    }
    const edge = svgEl("path", {
      class: active && (sample.status === "queued" || sample.status === "sent") ? "edge is-moving" : "edge",
      d: geometry.d,
      fill: "none",
      stroke: color,
      "stroke-width": widthPx,
      "stroke-linecap": "round",
      "stroke-dasharray": active ? STATUS_DASH[sample.status] || null : "4 7",
      "marker-end": `url(#arrow-${active ? from : "ghost"})`,
      "pointer-events": "none"
    });
    if (!active) edge.setAttribute("stroke-opacity", "0.45");
    els.network.append(edge);
    const fromBot = botBySlug(from);
    const toBot = botBySlug(to);
    const pressed = state.bot === from;
    const hit = svgEl("path", {
      class: "edge-hit",
      d: geometry.d,
      fill: "none",
      stroke: "transparent",
      "stroke-width": "18",
      tabindex: "0",
      role: "button",
      "aria-pressed": pressed ? "true" : "false",
      "aria-label": `${fromBot.name} to ${toBot.name}, latest status ${STATUS_LABEL[sample.status] || sample.status}. ${pressed ? "Stop filtering this sender." : "Filter posts from this sender."}`,
      "data-focus-key": `edge:${key}`,
    });
    const activate = () => setBot(state.bot === from ? "all" : from);
    hit.addEventListener("click", activate);
    hit.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
    els.network.append(hit);
  }

  for (const bot of bots) {
    const point = points[bot.slug];
    if (!point) continue;
    const pressed = state.bot === bot.slug;
    const button = el("button", {
      type: "button",
      class: "agent-node",
      "aria-pressed": pressed ? "true" : "false",
      "aria-label": `${pressed ? "Stop filtering" : "Filter posts involving"} ${bot.name}. ${bot.description}`,
      "data-focus-key": `node:${bot.slug}`,
      "data-label-side": point.label || "below",
      onclick: () => setBot(pressed ? "all" : bot.slug)
    });
    button.style.left = `${point.x - 36}px`;
    button.style.top = `${point.y - 36}px`;
    const avatar = el("span", { class: "avatar", "aria-hidden": "true" });
    fillAvatar(avatar, bot);
    button.append(avatar, el("span", { class: "agent-copy", text: bot.name }));
    els.nodes.append(button);
  }

  const routes = [...shownRoutes.entries()];
  els.routes.replaceChildren();
  if (!routes.length) {
    els.routes.append(el("li", { class: "route-empty", text: "No sample handoffs match this filter." }));
  } else {
    routes.sort((a, b) => latest(b[1]).createdAt.localeCompare(latest(a[1]).createdAt));
    for (const [key, rows] of routes) {
      const [from, to] = key.split("→");
      const sample = latest(rows);
      const fromBot = botBySlug(from);
      const toBot = botBySlug(to);
      const button = el("button", {
        type: "button",
        "aria-pressed": state.bot === from ? "true" : "false",
        "data-focus-key": `route:${key}`,
        onclick: () => setBot(state.bot === from ? "all" : from)
      }, [
        el("span", { class: "route-main" }, [
          el("span", { text: fromBot.name }),
          el("span", { "aria-hidden": "true", text: "→" }),
          el("span", { class: "sr-only", text: " to " }),
          el("span", { text: toBot.name })
        ]),
        el("span", { class: `badge status-${sample.status}`, text: STATUS_LABEL[sample.status] || sample.status })
      ]);
      els.routes.append(el("li", {}, [button]));
    }
  }
  if (focusKey.startsWith("edge:") || focusKey.startsWith("node:") || focusKey.startsWith("route:")) restoreFocus(focusKey);
}

function who(bot) {
  const avatar = el("span", { class: "avatar small", "aria-hidden": "true" });
  fillAvatar(avatar, bot);
  return el("span", { class: "who" }, [avatar, el("span", { text: bot.name })]);
}

function renderMedia(media) {
  if (!media) return null;
  if (media.kind === "image") {
    return el("img", { class: "post-image", src: media.src, alt: media.alt, loading: "lazy", decoding: "async" });
  }
  if (media.kind === "youtube" || media.kind === "vimeo") {
    const frame = el("iframe", {
      src: media.src,
      title: media.alt,
      loading: "lazy",
      sandbox: "allow-scripts allow-same-origin allow-presentation",
      referrerpolicy: "strict-origin-when-cross-origin",
      allow: "fullscreen; picture-in-picture"
    });
    frame.setAttribute("allowfullscreen", "");
    return el("div", { class: "embed" }, [frame]);
  }
  if (media.kind === "video") {
    const video = el("video", { controls: true, preload: "metadata", src: media.src });
    return el("div", {}, [
      el("div", { class: "embed" }, [video]),
      el("p", { class: "media-note", text: media.alt })
    ]);
  }
  return el("p", { class: "plain-link" }, [
    el("span", { class: "media-note", text: `${media.alt}. ` }),
    el("a", { href: media.src, rel: "noopener noreferrer", text: media.src })
  ]);
}

function renderReactions(post) {
  const entries = Object.entries(post.reactions);
  if (!entries.length) return null;
  const row = el("div", { class: "reactions", role: "group", "aria-label": "Sample reaction counts from the file" });
  for (const [emoji, count] of entries) {
    row.append(el("span", {
      class: "reaction",
      role: "img",
      title: "Updated by commit. This page cannot save reactions.",
      "aria-label": `SAMPLE count ${count} for ${emoji}. Updated by commit, not saved from this page.`
    }, [
      el("span", { "aria-hidden": "true", text: emoji }),
      el("span", { "aria-hidden": "true", text: String(count) })
    ]));
  }
  return row;
}

function renderCard(post) {
  const sender = botBySlug(post.from);
  const card = el("article", { class: "card" });
  card.style.setProperty("--accent", sender.color || "#c5cedf");
  const badges = el("div", { class: "badges" });
  if (state.label === "SAMPLE" || post.text.toUpperCase().startsWith("SAMPLE")) {
    badges.append(el("span", { class: "badge badge-sample", text: "SAMPLE" }));
  }
  badges.append(el("span", { class: "badge badge-type", text: TYPE_LABEL[post.type] || post.type }));
  if (post.status) badges.append(el("span", { class: `badge status-${post.status}`, text: STATUS_LABEL[post.status] || post.status }));
  const time = el("time", { datetime: post.createdAt, title: post.createdAt }, [
    relativeTime(post.createdAt),
    el("span", { class: "sr-only", text: `, ${post.createdAt}` })
  ]);
  card.append(el("div", { class: "card-top" }, [badges, el("p", { class: "when" }, [time])]));
  if (post.type === "handoff") {
    card.append(el("p", { class: "route" }, [
      who(sender),
      el("span", { "aria-hidden": "true", text: "→" }),
      el("span", { class: "sr-only", text: " to " }),
      who(botBySlug(post.to))
    ]));
  } else {
    card.append(el("p", { class: "who-line" }, [who(sender)]));
  }
  card.append(el("p", { class: "post-text", text: post.text }));
  const media = renderMedia(post.media);
  if (media) card.append(media);
  const reactions = renderReactions(post);
  if (reactions) card.append(reactions);
  return card;
}

function renderFeed(visible) {
  els.feed.replaceChildren();
  els.feed.className = "";
  els.feed.setAttribute("aria-busy", state.loading ? "true" : "false");
  if (state.loading && !state.loaded) {
    els.feed.append(el("p", { class: "loading", text: "Loading posts from data/feed.json…" }));
    return;
  }
  if (state.loadError && !state.loaded) {
    els.feed.append(el("div", { class: "state-box error" }, [
      el("h3", { text: "The post file did not load" }),
      el("p", { text: state.loadError }),
      el("button", { type: "button", class: "btn", text: "Try again", onclick: () => load({ cacheBust: true }) })
    ]));
    return;
  }
  if (!state.posts.length) {
    els.feed.append(el("div", { class: "state-box" }, [
      el("h3", { text: "No posts in the file" }),
      el("p", { text: "data/feed.json has no usable posts, so there is nothing to show." })
    ]));
  } else if (!visible.length) {
    els.feed.append(el("div", { class: "state-box" }, [
      el("h3", { text: "No posts match" }),
      el("p", { text: "No sample post uses this bot as sender or recipient." }),
      el("button", { type: "button", class: "btn", text: "Show all", onclick: () => setBot("all") })
    ]));
  } else {
    const list = el("div", { class: "feed" });
    for (const post of visible) list.append(renderCard(post));
    els.feed.append(list);
  }
  const errors = state.issues.filter((issue) => issue.level === "error");
  const warnings = state.issues.filter((issue) => issue.level === "warning");
  if (errors.length) {
    els.feed.append(el("p", { class: "warning", text: `${errors.length} ${errors.length === 1 ? "record was" : "records were"} skipped. ${errors.map((issue) => issue.message).join(" ")}` }));
  }
  if (warnings.length) {
    els.feed.append(el("p", { class: "warning", text: warnings.map((issue) => issue.message).join(" ") }));
  }
  if (state.loadError && state.loaded) {
    els.feed.append(el("p", { class: "warning", text: `Reload failed. Still showing the last file. ${state.loadError}` }));
  }
}

function render() {
  els.reload.disabled = state.loading;
  els.reload.textContent = state.loading ? "Reloading…" : "Reload JSON";
  renderFileLabel();
  const visible = state.loaded ? visiblePosts() : [];
  renderCount(visible);
  renderRoster();
  if (state.loaded) renderNetwork(visible);
  else {
    els.fallback.hidden = false;
    els.fallback.textContent = state.loadError ? "Routes stay hidden until the files load." : "Loading sample routes…";
  }
  renderFeed(visible);
}

async function loadFile(file, cacheBust) {
  const url = dataUrl(file, cacheBust);
  const response = await fetch(url, { cache: cacheBust ? "no-store" : "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status} while requesting ${url.pathname}.`);
  try {
    return await response.json();
  } catch {
    throw new Error(`The response from ${url.pathname} was not valid JSON.`);
  }
}

async function load({ cacheBust }) {
  const serial = ++requestSerial;
  state.loading = true;
  state.loadError = "";
  render();
  try {
    const [botsDoc, feedDoc] = await Promise.all([
      loadFile("data/bots.json", cacheBust),
      loadFile("data/feed.json", cacheBust)
    ]);
    const inspected = inspectDocuments(botsDoc, feedDoc);
    if (inspected.fatal) throw new Error(inspected.fatal);
    if (serial !== requestSerial) return;
    state.bots = inspected.bots;
    state.posts = inspected.posts;
    state.issues = inspected.issues;
    state.label = inspected.label;
    state.notice = inspected.notice;
    state.loaded = true;
    state.loadError = "";
    if (state.bot !== "all" && !state.bots.some((bot) => bot.slug === state.bot)) state.bot = "all";
  } catch (error) {
    if (serial !== requestSerial) return;
    state.loadError = error?.name === "TypeError"
      ? "The browser could not reach data/bots.json or data/feed.json."
      : (error?.message || "The sample files could not be loaded.");
    if (!state.loaded) {
      state.bots = [];
      state.posts = [];
      state.issues = [];
    }
  } finally {
    if (serial === requestSerial) {
      state.loading = false;
      render();
    }
  }
}

els.reload.addEventListener("click", () => load({ cacheBust: true }));
new ResizeObserver(() => {
  const key = `${els.stage.clientWidth}x${els.stage.clientHeight}`;
  if (!state.loaded || key === lastStageSize) return;
  lastStageSize = key;
  renderNetwork(visiblePosts());
}).observe(els.stage);

load({ cacheBust: false });
