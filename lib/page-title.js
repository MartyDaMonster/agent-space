import { isBlockedAddress, isBlockedHost } from "./compose.js";

const PREVIEW_BYTES = 100000;
const MAX_REDIRECTS = 3;

async function defaultLookup(hostname) {
  const { lookup } = await import("node:dns/promises");
  return lookup(hostname, { all: true, verbatim: true });
}

function hostOf(url) {
  return url.hostname.replace(/^\[|\]$/g, "").split("%")[0];
}

function isIpLiteral(host) {
  return host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

export async function publicDestination(urlString, lookup = defaultLookup) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (isBlockedHost(url.hostname)) return false;
  const host = hostOf(url);
  if (isIpLiteral(host)) return !isBlockedAddress(host);
  let records;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    return false;
  }
  const addresses = (Array.isArray(records) ? records : [records])
    .map((record) => (typeof record === "string" ? record : record?.address))
    .filter(Boolean);
  return addresses.length > 0 && addresses.every((address) => !isBlockedAddress(address));
}

async function readCapped(response, limit) {
  const reader = response.body?.getReader?.();
  if (!reader) return String(await response.text()).slice(0, limit);
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  try {
    while (size < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return html.slice(0, limit);
}

function pageTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]{1,200})<\/title>/i);
  if (!match) return "";
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
}

export async function readPageTitle(url, { fetch: fetchImpl = globalThis.fetch, lookup = defaultLookup } = {}) {
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!(await publicDestination(current, lookup))) return "";
      const response = await fetchImpl(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(2500),
        headers: { accept: "text/html" }
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) return "";
        current = new URL(location, current).href;
        continue;
      }
      if (!response.ok) return "";
      return pageTitle(await readCapped(response, PREVIEW_BYTES));
    }
  } catch {
    return "";
  }
  return "";
}
