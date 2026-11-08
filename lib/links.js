import { inspectLink, readPageTitle } from "./compose.js";

const TOKEN_QUERY = /(?:^|[?&#])(?:access[_-]?token|id[_-]?token|refresh[_-]?token|api[_-]?key|apikey|token|secret|password)=/i;
const MAX_LINKS = 10;
const TOKEN_ERROR = "Don't put a token in a link. Keep the file in a private repo and share the GitHub address.";

export function urlHasCredential(value) {
  const raw = String(value || "");
  if (TOKEN_QUERY.test(raw)) return true;
  if (/ghp_[A-Za-z0-9]{8,}/.test(raw) || /github_pat_/.test(raw)) return true;
  try {
    const url = new URL(raw);
    if (url.username || url.password) return true;
  } catch {
    return false;
  }
  return false;
}

function decodePart(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function cleanTitle(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 140);
}

export function extractUrls(text) {
  const found = [];
  const re = /https:\/\/[^\s<>"']+/gi;
  for (const match of String(text || "").matchAll(re)) {
    let raw = match[0].replace(/[),.;:!?]+$/g, "");
    if (raw.endsWith(")") && !raw.slice(0, -1).includes("(")) raw = raw.slice(0, -1);
    if (raw) found.push(raw);
  }
  return found;
}

export function parseGithubLink(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "github.com") return null;
  const parts = url.pathname.split("/").filter(Boolean).map(decodePart);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;
  const area = (parts[2] || "").toLowerCase();
  const repoName = `${owner}/${repo}`;
  if (area === "blob" || area === "tree" || area === "raw") {
    const path = parts.slice(4).join("/");
    const fileName = path ? path.split("/").pop() : repo;
    return { kind: "github", githubType: area, repo: repoName, path, fileName, domain: "github.com" };
  }
  if (area === "pull" || area === "pulls") {
    const number = /^\d+$/.test(parts[3] || "") ? parts[3] : "";
    return {
      kind: "github",
      githubType: "pull",
      repo: repoName,
      path: number ? `#${number}` : "",
      fileName: number ? `Pull request #${number}` : "Pull requests",
      domain: "github.com"
    };
  }
  if (area === "issues" || area === "issue") {
    const number = /^\d+$/.test(parts[3] || "") ? parts[3] : "";
    return {
      kind: "github",
      githubType: "issue",
      repo: repoName,
      path: number ? `#${number}` : "",
      fileName: number ? `Issue #${number}` : "Issues",
      domain: "github.com"
    };
  }
  return null;
}

function addLink(ordered, raw, title) {
  if (urlHasCredential(raw)) return { ok: false, error: TOKEN_ERROR };
  const inspected = inspectLink(raw);
  if (!inspected.ok) return { ok: false, error: inspected.error || "Use a full https link." };
  if (inspected.empty) return { ok: true };
  if (ordered.some((item) => item.url === inspected.url)) return { ok: true };
  const github = parseGithubLink(inspected.url);
  const supplied = cleanTitle(title);
  if (github) {
    ordered.push({
      url: inspected.url,
      title: supplied || github.fileName,
      domain: "github.com",
      kind: "github",
      repo: github.repo,
      path: github.path,
      fileName: github.fileName,
      githubType: github.githubType
    });
  } else {
    ordered.push({
      url: inspected.url,
      title: supplied,
      domain: inspected.domain,
      kind: "link",
      repo: "",
      path: "",
      fileName: "",
      githubType: ""
    });
  }
  return { ok: true };
}

export function linkExtras(body) {
  const value = body?.links ?? body?.attachments ?? [];
  if (value == null) return { ok: true, extras: [] };
  if (!Array.isArray(value)) return { ok: false, error: "Links must be a list." };
  const extras = [];
  for (const item of value) {
    if (typeof item === "string") extras.push({ url: item, title: "" });
    else if (item && typeof item.url === "string") extras.push({ url: item.url, title: item.title || "" });
    else return { ok: false, error: "Each link needs a url." };
  }
  return { ok: true, extras };
}

export function collectLinkInputs({ text = "", extras = [], legacy = "", legacyTitle = "", strict = true } = {}) {
  const ordered = [];
  const sources = [
    ...extras.map((item) => [item.url, item.title]),
    ...(legacy ? [[legacy, legacyTitle]] : []),
    ...extractUrls(text).map((url) => [url, ""])
  ];
  for (const [raw, title] of sources) {
    if (!strict && (urlHasCredential(raw) || !inspectLink(raw).ok)) continue;
    const added = addLink(ordered, raw, title);
    if (!added.ok) return added;
  }
  if (ordered.length > MAX_LINKS) return { ok: false, error: "Attach up to 10 links." };
  return { ok: true, links: ordered };
}

export async function resolveLinks(input) {
  const collected = collectLinkInputs({ ...input, strict: true });
  if (!collected.ok) return collected;
  const links = [];
  for (const link of collected.links) {
    if (link.kind === "github" || link.title) {
      links.push(link);
      continue;
    }
    const title = await readPageTitle(link.url);
    links.push({ ...link, title: title || "" });
  }
  return { ok: true, links };
}

export function displayLinks(input) {
  return collectLinkInputs({ ...input, strict: false }).links || [];
}

export function splitText(text) {
  const source = String(text || "");
  const re = /https:\/\/[^\s<>"']+/gi;
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(re)) {
    let raw = match[0];
    let end = match.index + raw.length;
    const trimmed = raw.replace(/[),.;:!?]+$/g, "");
    const cut = raw.length - trimmed.length;
    raw = trimmed;
    if (raw.endsWith(")") && !raw.slice(0, -1).includes("(")) {
      raw = raw.slice(0, -1);
      end -= 1;
    }
    end -= cut;
    if (match.index > last) parts.push({ text: source.slice(last, match.index) });
    const inspected = inspectLink(raw);
    if (!urlHasCredential(raw) && inspected.ok && !inspected.empty) parts.push({ text: raw, href: inspected.url });
    else parts.push({ text: source.slice(match.index, end) });
    last = end;
  }
  if (last < source.length) parts.push({ text: source.slice(last) });
  return parts.length ? parts : [{ text: source }];
}

export function publicLink(link) {
  return {
    url: link.url,
    title: link.title || link.fileName || "",
    domain: link.domain,
    kind: link.kind,
    repo: link.repo || "",
    path: link.path || "",
    fileName: link.fileName || "",
    githubType: link.githubType || ""
  };
}
